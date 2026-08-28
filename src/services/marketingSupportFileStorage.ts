import {
  deleteCentralBusinessFile,
  downloadCentralBusinessFile,
  getCentralBusinessFile,
  uploadCentralBusinessFile,
} from "@/services/businessFileStorage";

export interface StoredMarketingSupportFile {
  id: string;
  blob: Blob;
  fileName: string;
  mimeType: string;
  savedAt: string;
}

const findDocumentContext =
  (
    id:
      string
  ) => {
    const keys = [
      "pertalife_service_documents",
      "pertalife_supporting_docs",
      "pertalife_marcomm_requests",
    ];

    for (
      const key of keys
    ) {
      try {
        const raw =
          localStorage.getItem(
            key
          );

        const parsed =
          raw
            ? JSON.parse(raw)
            : [];

        if (
          !Array.isArray(
            parsed
          )
        ) {
          continue;
        }

        const record =
          parsed.find(
            item =>
              item?.id === id ||
              item?.documentId === id ||
              item?.fileId === id
          );

        if (
          record
        ) {
          return {
            storageKey:
              key,
            entityId:
              String(
                record.id ||
                id
              ),
            visibilityPayload: {
              picUserId:
                record.picUserId ||
                record.userId ||
                "",
              requesterUserId:
                record.requesterUserId ||
                record.requestedByUserId ||
                "",
            },
          };
        }
      } catch {
        // Continue to the next central collection.
      }
    }

    return {
      storageKey:
        "pertalife_service_documents",
      entityId:
        id,
      visibilityPayload:
        {},
    };
  };

export const saveMarketingSupportFile =
  async (
    id:
      string,
    file:
      File
  ) => {
    const context =
      findDocumentContext(
        id
      );

    await uploadCentralBusinessFile({
      fileId:
        id,
      module:
        "MARKETING_SUPPORT",
      storageKey:
        context.storageKey,
      entityId:
        context.entityId,
      file,
      visibilityPayload:
        context.visibilityPayload,
      metadata: {
        source:
          "marketingSupportFileStorage",
      },
    });
  };

export const getMarketingSupportFile =
  async (
    id:
      string
  ): Promise<
    StoredMarketingSupportFile | null
  > => {
    const stored =
      await getCentralBusinessFile(
        id
      );

    if (
      !stored
    ) {
      return null;
    }

    return {
      id,
      blob:
        stored.blob,
      fileName:
        stored.metadata
          .file_name,
      mimeType:
        stored.metadata
          .mime_type ||
        "application/octet-stream",
      savedAt:
        stored.metadata
          .uploaded_at,
    };
  };

export const downloadMarketingSupportFile =
  async (
    id:
      string,
    fallbackFileName?:
      string
  ) => {
    await downloadCentralBusinessFile(
      id,
      fallbackFileName ||
        "dokumen"
    );
  };

export const deleteMarketingSupportFile =
  async (
    id:
      string
  ) => {
    await deleteCentralBusinessFile(
      id
    );
  };
