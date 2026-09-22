import {
  BUSINESS_FILE_MAX_BYTES,
  MARKETING_SUPPORT_KARINA_FILE_MAX_BYTES,
  deleteCentralBusinessFile,
  getCentralBusinessFile,
  getCentralBusinessFileMetadata,
  uploadCentralBusinessFile,
} from "@/services/businessFileStorage";

export interface StoredMarketingSupportFile {
  id: string;
  blob: Blob;
  fileName: string;
  mimeType: string;
  savedAt: string;
}

const KARINA_LEGACY_USER_ID =
  "USR-000031";

const MARKETING_SUPPORT_CHUNK_BYTES =
  5 * 1024 * 1024;

const MARKETING_SUPPORT_CHUNK_VERSION =
  1;

type ChunkMetadata = {
  chunked?:
    boolean;
  chunkIds?:
    unknown;
  originalFileName?:
    unknown;
  originalMimeType?:
    unknown;
  logicalFileSize?:
    unknown;
};

export const getMarketingSupportFileMaxBytes =
  () =>
    localStorage.getItem(
      "pertalife_current_user_id"
    ) ===
    KARINA_LEGACY_USER_ID
      ? MARKETING_SUPPORT_KARINA_FILE_MAX_BYTES
      : BUSINESS_FILE_MAX_BYTES;

const getChunkIds =
  (
    metadata?:
      Record<string, unknown>
  ) => {
    const chunkMetadata =
      (metadata ||
        {}) as
        ChunkMetadata;

    if (
      chunkMetadata.chunked !==
        true ||
      !Array.isArray(
        chunkMetadata.chunkIds
      )
    ) {
      return [];
    }

    return chunkMetadata.chunkIds.filter(
      (
        value
      ): value is string =>
        typeof value ===
          "string" &&
        Boolean(
          value.trim()
        )
    );
  };

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

const deleteChunkFilesBestEffort =
  async (
    chunkIds:
      string[]
  ) => {
    await Promise.allSettled(
      chunkIds.map(
        chunkId =>
          deleteCentralBusinessFile(
            chunkId
          )
      )
    );
  };

export const saveMarketingSupportFile =
  async (
    id:
      string,
    file:
      File
  ) => {
    const maxBytes =
      getMarketingSupportFileMaxBytes();

    if (
      file.size >
      maxBytes
    ) {
      throw new Error(
        `Ukuran file maksimum ${Math.round(
          maxBytes /
            1024 /
            1024
        )} MB untuk akun ini.`
      );
    }

    const context =
      findDocumentContext(
        id
      );

    const previousMetadata =
      await getCentralBusinessFileMetadata(
        id
      );

    const previousChunkIds =
      getChunkIds(
        previousMetadata?.metadata
      );

    if (
      file.size <=
      BUSINESS_FILE_MAX_BYTES
    ) {
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
          chunked:
            false,
        },
      });

      if (
        previousChunkIds.length >
        0
      ) {
        await deleteChunkFilesBestEffort(
          previousChunkIds
        );
      }

      return;
    }

    const chunkIds:
      string[] = [];

    try {
      const chunkCount =
        Math.ceil(
          file.size /
            MARKETING_SUPPORT_CHUNK_BYTES
        );

      for (
        let index = 0;
        index <
        chunkCount;
        index +=
        1
      ) {
        const start =
          index *
          MARKETING_SUPPORT_CHUNK_BYTES;

        const end =
          Math.min(
            file.size,
            start +
              MARKETING_SUPPORT_CHUNK_BYTES
          );

        const chunkId =
          `${id}::chunk::${String(
            index +
              1
          ).padStart(
            3,
            "0"
          )}::${crypto.randomUUID()}`;

        const chunkFile =
          new File(
            [
              file.slice(
                start,
                end
              ),
            ],
            `${file.name}.part-${String(
              index +
                1
            ).padStart(
              3,
              "0"
            )}`,
            {
              type:
                "application/octet-stream",
            }
          );

        await uploadCentralBusinessFile({
          fileId:
            chunkId,
          module:
            "MARKETING_SUPPORT",
          storageKey:
            context.storageKey,
          entityId:
            context.entityId,
          file:
            chunkFile,
          visibilityPayload:
            context.visibilityPayload,
          metadata: {
            source:
              "marketingSupportFileStorage",
            chunked:
              true,
            chunkVersion:
              MARKETING_SUPPORT_CHUNK_VERSION,
            parentFileId:
              id,
            chunkIndex:
              index,
            chunkCount,
            originalFileName:
              file.name,
            originalMimeType:
              file.type ||
              "application/octet-stream",
            logicalFileSize:
              file.size,
          },
        });

        chunkIds.push(
          chunkId
        );
      }

      const manifestFile =
        new File(
          [
            JSON.stringify({
              version:
                MARKETING_SUPPORT_CHUNK_VERSION,
              chunkIds,
            }),
          ],
          `${file.name}.manifest.json`,
          {
            type:
              "application/json",
          }
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
        file:
          manifestFile,
        visibilityPayload:
          context.visibilityPayload,
        registeredFileSize:
          file.size,
        registeredFileName:
          file.name,
        registeredMimeType:
          file.type ||
          "application/octet-stream",
        metadata: {
          source:
            "marketingSupportFileStorage",
          chunked:
            true,
          chunkVersion:
            MARKETING_SUPPORT_CHUNK_VERSION,
          chunkIds,
          originalFileName:
            file.name,
          originalMimeType:
            file.type ||
            "application/octet-stream",
          logicalFileSize:
            file.size,
        },
      });
    } catch (
      error
    ) {
      await deleteChunkFilesBestEffort(
        chunkIds
      );

      throw error;
    }

    if (
      previousChunkIds.length >
      0
    ) {
      await deleteChunkFilesBestEffort(
        previousChunkIds
      );
    }
  };

export const getMarketingSupportFile =
  async (
    id:
      string
  ): Promise<
    StoredMarketingSupportFile | null
  > => {
    const metadata =
      await getCentralBusinessFileMetadata(
        id
      );

    if (
      !metadata
    ) {
      return null;
    }

    const chunkIds =
      getChunkIds(
        metadata.metadata
      );

    if (
      chunkIds.length ===
      0
    ) {
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
    }

    const chunks:
      Blob[] = [];

    for (
      const chunkId of chunkIds
    ) {
      const storedChunk =
        await getCentralBusinessFile(
          chunkId
        );

      if (
        !storedChunk
      ) {
        throw new Error(
          "Salah satu bagian file tidak ditemukan di penyimpanan pusat."
        );
      }

      chunks.push(
        storedChunk.blob
      );
    }

    const mimeType =
      metadata.mime_type ||
      "application/octet-stream";

    return {
      id,
      blob:
        new Blob(
          chunks,
          {
            type:
              mimeType,
          }
        ),
      fileName:
        metadata.file_name,
      mimeType,
      savedAt:
        metadata.uploaded_at,
    };
  };

export const downloadMarketingSupportFile =
  async (
    id:
      string,
    fallbackFileName?:
      string
  ) => {
    const stored =
      await getMarketingSupportFile(
        id
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
      stored.fileName ||
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
  };

export const deleteMarketingSupportFile =
  async (
    id:
      string
  ) => {
    const metadata =
      await getCentralBusinessFileMetadata(
        id
      );

    if (
      !metadata
    ) {
      return;
    }

    const chunkIds =
      getChunkIds(
        metadata.metadata
      );

    for (
      const chunkId of chunkIds
    ) {
      await deleteCentralBusinessFile(
        chunkId
      );
    }

    await deleteCentralBusinessFile(
      id
    );
  };
