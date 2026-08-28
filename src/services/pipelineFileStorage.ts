import {
  downloadCentralBusinessFile,
  getCentralBusinessFile,
  uploadCentralBusinessFile,
} from "@/services/businessFileStorage";

interface StoredPipelineFile {
  id: string;
  blob: Blob;
  fileName: string;
  mimeType: string;
  savedAt: string;
}

type PipelineLike = {
  id?: string;
  picUserId?: string;
  documents?: Array<{ id?: string }>;
  closingDocuments?: Array<{ id?: string }>;
  quotations?: Array<{ id?: string }>;
  outcomeDocuments?: Array<{ id?: string }>;
  quotationRevisionDocuments?: Array<{ id?: string }>;
  quotationRevisionRequests?: Array<{
    documents?: Array<{ id?: string }>;
  }>;
};

const getCentralPipelineRows =
  (): PipelineLike[] => {
    try {
      const raw =
        localStorage.getItem(
          "pertalife_pipelines"
        );

      const parsed =
        raw
          ? JSON.parse(raw)
          : [];

      return Array.isArray(parsed)
        ? parsed
        : [];
    } catch {
      return [];
    }
  };

const containsFileId = (
  pipeline:
    PipelineLike,
  fileId:
    string
) => {
  const directArrays = [
    pipeline.documents,
    pipeline.closingDocuments,
    pipeline.quotations,
    pipeline.outcomeDocuments,
    pipeline.quotationRevisionDocuments,
  ];

  if (
    directArrays.some(
      list =>
        Array.isArray(list) &&
        list.some(
          item =>
            item?.id ===
            fileId
        )
    )
  ) {
    return true;
  }

  return (
    pipeline.quotationRevisionRequests ||
    []
  ).some(
    request =>
      (
        request.documents ||
        []
      ).some(
        item =>
          item?.id ===
          fileId
      )
  );
};

const findPipelineContext = (
  fileId:
    string
) => {
  const pipeline =
    getCentralPipelineRows()
      .find(
        item =>
          containsFileId(
            item,
            fileId
          )
      );

  return {
    entityId:
      pipeline?.id ||
      fileId,
    visibilityPayload: {
      picUserId:
        pipeline?.picUserId ||
        "",
      pipelineId:
        pipeline?.id ||
        "",
    },
  };
};

const getStoredFile =
  async (
    fileId:
      string
  ): Promise<
    StoredPipelineFile | null
  > => {
    const stored =
      await getCentralBusinessFile(
        fileId
      );

    if (
      !stored
    ) {
      return null;
    }

    return {
      id:
        fileId,
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

const saveFile =
  async (
    module:
      | "PIPELINE_QUOTATION"
      | "PIPELINE_OUTCOME"
      | "PIPELINE_REVISION",
    fileId:
      string,
    file:
      File
  ) => {
    const context =
      findPipelineContext(
        fileId
      );

    await uploadCentralBusinessFile({
      fileId,
      module,
      storageKey:
        "pertalife_pipelines",
      entityId:
        context.entityId,
      file,
      visibilityPayload:
        context.visibilityPayload,
      metadata: {
        source:
          "pipelineFileStorage",
      },
    });
  };

export const saveQuotationFile =
  async (
    quotationId:
      string,
    file:
      File
  ) => {
    await saveFile(
      "PIPELINE_QUOTATION",
      quotationId,
      file
    );
  };

export const getQuotationFile =
  async (
    quotationId:
      string
  ): Promise<
    StoredPipelineFile | null
  > =>
    getStoredFile(
      quotationId
    );

export const downloadQuotationFile =
  async (
    quotationId:
      string,
    fallbackFileName?:
      string
  ) => {
    await downloadCentralBusinessFile(
      quotationId,
      fallbackFileName ||
        "Penawaran"
    );
  };

export const saveOutcomeDocumentFile =
  async (
    documentId:
      string,
    file:
      File
  ) => {
    await saveFile(
      "PIPELINE_OUTCOME",
      documentId,
      file
    );
  };

export const getOutcomeDocumentFile =
  async (
    documentId:
      string
  ): Promise<
    StoredPipelineFile | null
  > =>
    getStoredFile(
      documentId
    );

export const downloadOutcomeDocumentFile =
  async (
    documentId:
      string,
    fallbackFileName?:
      string
  ) => {
    await downloadCentralBusinessFile(
      documentId,
      fallbackFileName ||
        "Dokumen Outcome"
    );
  };

export const saveQuotationRevisionFile =
  async (
    documentId:
      string,
    file:
      File
  ) => {
    await saveFile(
      "PIPELINE_REVISION",
      documentId,
      file
    );
  };

export const getQuotationRevisionFile =
  async (
    documentId:
      string
  ): Promise<
    StoredPipelineFile | null
  > =>
    getStoredFile(
      documentId
    );

export const downloadQuotationRevisionFile =
  async (
    documentId:
      string,
    fallbackFileName?:
      string
  ) => {
    await downloadCentralBusinessFile(
      documentId,
      fallbackFileName ||
        "Lampiran Revisi Penawaran"
    );
  };
