import { supabase } from "@/lib/supabase";

export const BUSINESS_FILE_BUCKET =
  "business-files";

export const BUSINESS_FILE_MAX_BYTES =
  10 * 1024 * 1024;

export type BusinessFileModule =
  | "PIPELINE_QUOTATION"
  | "PIPELINE_OUTCOME"
  | "PIPELINE_REVISION"
  | "MARKETING_SUPPORT"
  | "TANDA_TERIMA";

export type CentralBusinessFileRow = {
  file_id: string;
  module: BusinessFileModule;
  storage_key: string;
  entity_id: string | null;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  file_size: number;
  visibility_payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
  uploaded_by_name: string | null;
  uploaded_at: string;
};

const safeSegment = (
  value: string
) =>
  String(value || "unlinked")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120) ||
  "unlinked";

const safeFileName = (
  value: string
) =>
  String(value || "file")
    .replace(/[^\w.\-() ]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 160) ||
  "file";

const describeSupabaseError = (
  error: unknown
): string => {
  if (
    error instanceof Error
  ) {
    return error.message;
  }

  if (
    error &&
    typeof error === "object"
  ) {
    const candidate =
      error as {
        message?: unknown;
        details?: unknown;
        hint?: unknown;
        code?: unknown;
      };

    const parts = [
      typeof candidate.message === "string"
        ? candidate.message
        : "",
      typeof candidate.details === "string" &&
      candidate.details
        ? `details: ${candidate.details}`
        : "",
      typeof candidate.hint === "string" &&
      candidate.hint
        ? `hint: ${candidate.hint}`
        : "",
      typeof candidate.code === "string" &&
      candidate.code
        ? `code: ${candidate.code}`
        : "",
    ].filter(Boolean);

    if (
      parts.length > 0
    ) {
      return parts.join(" | ");
    }

    try {
      return JSON.stringify(
        error
      );
    } catch {
      return "Error Supabase tidak dapat dibaca.";
    }
  }

  return String(
    error ||
      "Error tidak diketahui."
  );
};

const stageError = (
  stage: string,
  error: unknown
) =>
  new Error(
    `${stage}: ${describeSupabaseError(
      error
    )}`
  );

export async function uploadCentralBusinessFile(input: {
  fileId: string;
  module: BusinessFileModule;
  storageKey: string;
  entityId?: string;
  file: File;
  visibilityPayload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}): Promise<CentralBusinessFileRow> {
  const {
    fileId,
    module,
    storageKey,
    entityId,
    file,
    visibilityPayload = {},
    metadata = {},
  } = input;

  if (!fileId.trim()) {
    throw new Error(
      "File ID wajib tersedia."
    );
  }

  if (
    file.size >
    BUSINESS_FILE_MAX_BYTES
  ) {
    throw new Error(
      "Ukuran file maksimum 10 MB."
    );
  }

  const existingMetadata =
    await getCentralBusinessFileMetadata(
      fileId
    );

  const storagePath = [
    module,
    safeSegment(
      entityId ||
        fileId
    ),
    `${crypto.randomUUID()}-${safeFileName(
      file.name
    )}`,
  ].join("/");

  const {
    error:
      uploadError,
  } =
    await supabase.storage
      .from(
        BUSINESS_FILE_BUCKET
      )
      .upload(
        storagePath,
        file,
        {
          upsert: false,
          contentType:
            file.type ||
            undefined,
        }
      );

  if (
    uploadError
  ) {
    throw stageError(
      "Gagal upload file evidence",
      uploadError
    );
  }

  const {
    data,
    error:
      metadataError,
  } =
    await supabase.rpc(
      "register_central_business_file",
      {
        p_file_id:
          fileId,
        p_module:
          module,
        p_storage_key:
          storageKey,
        p_entity_id:
          entityId ||
          fileId,
        p_storage_path:
          storagePath,
        p_file_name:
          file.name,
        p_mime_type:
          file.type ||
          "application/octet-stream",
        p_file_size:
          file.size,
        p_visibility_payload:
          visibilityPayload,
        p_metadata:
          metadata,
      }
    );

  if (
    metadataError
  ) {
    // Avoid leaving an orphaned object when DB registration fails.
    await supabase.storage
      .from(
        BUSINESS_FILE_BUCKET
      )
      .remove([
        storagePath,
      ]);

    throw stageError(
      "Gagal register metadata file evidence",
      metadataError
    );
  }

  if (
    existingMetadata &&
    existingMetadata.storage_path !==
      storagePath
  ) {
    await supabase.storage
      .from(
        BUSINESS_FILE_BUCKET
      )
      .remove([
        existingMetadata.storage_path,
      ]);
  }

  return data as CentralBusinessFileRow;
}

export async function getCentralBusinessFileMetadata(
  fileId: string
): Promise<CentralBusinessFileRow | null> {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        "central_business_files"
      )
      .select("*")
      .eq(
        "file_id",
        fileId
      )
      .maybeSingle();

  if (
    error
  ) {
    throw stageError(
      "Gagal membaca metadata file evidence",
      error
    );
  }

  return data
    ? (
        data as
          CentralBusinessFileRow
      )
    : null;
}

export async function getCentralBusinessFile(
  fileId: string
): Promise<{
  metadata:
    CentralBusinessFileRow;
  blob:
    Blob;
} | null> {
  const metadata =
    await getCentralBusinessFileMetadata(
      fileId
    );

  if (
    !metadata
  ) {
    return null;
  }

  const {
    data,
    error,
  } =
    await supabase.storage
      .from(
        BUSINESS_FILE_BUCKET
      )
      .download(
        metadata.storage_path
      );

  if (
    error
  ) {
    throw stageError(
      "Gagal download file evidence",
      error
    );
  }

  return {
    metadata,
    blob:
      data,
  };
}

export async function downloadCentralBusinessFile(
  fileId: string,
  fallbackFileName?: string
) {
  const stored =
    await getCentralBusinessFile(
      fileId
    );

  if (
    !stored
  ) {
    throw new Error(
      "File tidak ditemukan di penyimpanan pusat."
    );
  }

  const url =
    URL.createObjectURL(
      stored.blob
    );

  const anchor =
    document.createElement(
      "a"
    );

  anchor.href =
    url;

  anchor.download =
    stored.metadata
      .file_name ||
    fallbackFileName ||
    "dokumen";

  document.body.appendChild(
    anchor
  );

  anchor.click();
  anchor.remove();

  window.setTimeout(
    () =>
      URL.revokeObjectURL(
        url
      ),
    1000
  );
}

export async function openCentralBusinessFile(
  fileId: string
) {
  const stored =
    await getCentralBusinessFile(
      fileId
    );

  if (
    !stored
  ) {
    throw new Error(
      "File tidak ditemukan di penyimpanan pusat."
    );
  }

  const url =
    URL.createObjectURL(
      stored.blob
    );

  window.open(
    url,
    "_blank",
    "noopener,noreferrer"
  );

  window.setTimeout(
    () =>
      URL.revokeObjectURL(
        url
      ),
    60_000
  );
}

export async function deleteCentralBusinessFile(
  fileId: string
) {
  const metadata =
    await getCentralBusinessFileMetadata(
      fileId
    );

  if (
    !metadata
  ) {
    return;
  }

  const {
    error:
      removeError,
  } =
    await supabase.storage
      .from(
        BUSINESS_FILE_BUCKET
      )
      .remove([
        metadata.storage_path,
      ]);

  if (
    removeError
  ) {
    throw stageError(
      "Gagal menghapus file evidence",
      removeError
    );
  }

  const {
    error:
      metadataError,
  } =
    await supabase.rpc(
      "delete_central_business_file_metadata",
      {
        p_file_id:
          fileId,
      }
    );

  if (
    metadataError
  ) {
    throw stageError(
      "Gagal menghapus metadata file evidence",
      metadataError
    );
  }
}
