import { supabase } from "@/lib/supabase";
import {
  BUSINESS_FILE_BUCKET,
  downloadCentralBusinessFile,
  getCentralBusinessFile,
  getCentralBusinessFileMetadata,
  openCentralBusinessFile,
} from "@/services/businessFileStorage";

export interface DocumentHandoverStoredFile {
  id: string;
  transactionId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedByUserId: string;
  uploadedByName: string;
  uploadedAt: string;

  // Dapat diisi eksplisit ketika file diupload sebelum registry dibuat.
  senderUserId?: string;
  receiverUserId?: string;

  blob: Blob;
}

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
) => {
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

    return [
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
    ]
      .filter(Boolean)
      .join(" | ") ||
      "Error Supabase tidak dapat dibaca.";
  }

  return String(
    error ||
      "Error tidak diketahui."
  );
};

const findHandoverContext =
  (
    transactionId:
      string
  ) => {
    try {
      const raw =
        localStorage.getItem(
          "pertalife_document_handovers"
        );

      const rows =
        raw
          ? JSON.parse(raw)
          : [];

      if (
        Array.isArray(
          rows
        )
      ) {
        const handover =
          rows.find(
            item =>
              item?.id ===
              transactionId
          );

        if (
          handover
        ) {
          return {
            senderUserId:
              handover.senderUserId ||
              "",
            receiverUserId:
              handover.receiverUserId ||
              "",
          };
        }
      }
    } catch {
      // Fall through to uploader-only visibility.
    }

    return {
      senderUserId:
        "",
      receiverUserId:
        "",
    };
  };

export const saveDocumentHandoverFile =
  async (
    record:
      DocumentHandoverStoredFile
  ): Promise<void> => {
    const context =
      findHandoverContext(
        record.transactionId
      );

    const file =
      new File(
        [
          record.blob,
        ],
        record.fileName,
        {
          type:
            record.fileType ||
            record.blob.type ||
            "application/octet-stream",
        }
      );

    const existingMetadata =
      await getCentralBusinessFileMetadata(
        record.id
      );

    const storagePath = [
      "TANDA_TERIMA",
      safeSegment(
        record.transactionId
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
      throw new Error(
        `Gagal upload file evidence Tanda Terima: ${describeSupabaseError(
          uploadError
        )}`
      );
    }

    const visibilityPayload = {
      senderUserId:
        record.senderUserId ||
        context.senderUserId,
      receiverUserId:
        record.receiverUserId ||
        context.receiverUserId,
      uploadedByUserId:
        record.uploadedByUserId,
    };

    const metadata = {
      transactionId:
        record.transactionId,
      uploadedByUserId:
        record.uploadedByUserId,
      uploadedByName:
        record.uploadedByName,
      uploadedAt:
        record.uploadedAt,
    };

    const {
      error:
        metadataError,
    } =
      await supabase.rpc(
        "register_tanda_terima_business_file_v18",
        {
          p_file_id:
            record.id,
          p_module:
            "TANDA_TERIMA",
          p_storage_key:
            "pertalife_document_handovers",
          p_entity_id:
            record.transactionId,
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
      await supabase.storage
        .from(
          BUSINESS_FILE_BUCKET
        )
        .remove([
          storagePath,
        ]);

      throw new Error(
        `Gagal register metadata file evidence Tanda Terima: ${describeSupabaseError(
          metadataError
        )}`
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
  };

export const getDocumentHandoverFile =
  async (
    fileId:
      string
  ): Promise<
    DocumentHandoverStoredFile | undefined
  > => {
    const stored =
      await getCentralBusinessFile(
        fileId
      );

    if (
      !stored
    ) {
      return undefined;
    }

    const metadata =
      stored.metadata
        .metadata ||
      {};

    return {
      id:
        fileId,
      transactionId:
        String(
          metadata.transactionId ||
          stored.metadata
            .entity_id ||
          ""
        ),
      fileName:
        stored.metadata
          .file_name,
      fileType:
        stored.metadata
          .mime_type ||
        "application/octet-stream",
      fileSize:
        Number(
          stored.metadata
            .file_size ||
          stored.blob.size
        ),
      uploadedByUserId:
        String(
          metadata.uploadedByUserId ||
          ""
        ),
      uploadedByName:
        String(
          metadata.uploadedByName ||
          stored.metadata
            .uploaded_by_name ||
          ""
        ),
      uploadedAt:
        String(
          metadata.uploadedAt ||
          stored.metadata
            .uploaded_at
        ),
      blob:
        stored.blob,
    };
  };

export const downloadDocumentHandoverFile =
  async (
    fileId: string,
    fallbackFileName?: string
  ): Promise<void> => {
    await downloadCentralBusinessFile(
      fileId,
      fallbackFileName
    );
  };

export const openDocumentHandoverFile =
  async (
    fileId:
      string
  ): Promise<void> => {
    await openCentralBusinessFile(
      fileId
    );
  };
