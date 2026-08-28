import {
  getCentralBusinessFile,
  openCentralBusinessFile,
  uploadCentralBusinessFile,
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
  blob: Blob;
}

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

    await uploadCentralBusinessFile({
      fileId:
        record.id,
      module:
        "TANDA_TERIMA",
      storageKey:
        "pertalife_document_handovers",
      entityId:
        record.transactionId,
      file,
      visibilityPayload: {
        senderUserId:
          context.senderUserId,
        receiverUserId:
          context.receiverUserId,
        uploadedByUserId:
          record.uploadedByUserId,
      },
      metadata: {
        transactionId:
          record.transactionId,
        uploadedByUserId:
          record.uploadedByUserId,
        uploadedByName:
          record.uploadedByName,
        uploadedAt:
          record.uploadedAt,
      },
    });
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

export const openDocumentHandoverFile =
  async (
    fileId:
      string
  ): Promise<void> => {
    await openCentralBusinessFile(
      fileId
    );
  };
