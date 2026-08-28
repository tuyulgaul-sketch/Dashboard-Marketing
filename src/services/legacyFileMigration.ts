import {
  saveMarketingSupportFile,
} from "@/services/marketingSupportFileStorage";

import {
  saveOutcomeDocumentFile,
  saveQuotationFile,
  saveQuotationRevisionFile,
} from "@/services/pipelineFileStorage";

import {
  DocumentHandoverStoredFile,
  saveDocumentHandoverFile,
} from "@/services/documentHandoverFileStorage";

type IndexedDbStoredFile = {
  id: string;
  blob: Blob;
  fileName: string;
  mimeType?: string;
  fileType?: string;
  fileSize?: number;
  savedAt?: string;
  transactionId?: string;
  uploadedByUserId?: string;
  uploadedByName?: string;
  uploadedAt?: string;
};

const MIGRATION_MARKER =
  "pertalife_central_file_migration_v1";

const openLegacyDb =
  (
    dbName:
      string
  ): Promise<
    IDBDatabase | null
  > =>
    new Promise(
      (
        resolve
      ) => {
        const request =
          indexedDB.open(
            dbName
          );

        let created =
          false;

        request.onupgradeneeded =
          () => {
            created =
              true;
          };

        request.onsuccess =
          () => {
            const db =
              request.result;

            if (
              created
            ) {
              db.close();

              indexedDB.deleteDatabase(
                dbName
              );

              resolve(
                null
              );

              return;
            }

            resolve(
              db
            );
          };

        request.onerror =
          () =>
            resolve(
              null
            );
      }
    );

const readAllFromStore =
  async (
    dbName:
      string,
    storeName:
      string
  ): Promise<
    IndexedDbStoredFile[]
  > => {
    const db =
      await openLegacyDb(
        dbName
      );

    if (
      !db
    ) {
      return [];
    }

    try {
      if (
        !db.objectStoreNames.contains(
          storeName
        )
      ) {
        return [];
      }

      return await new Promise<
        IndexedDbStoredFile[]
      >(
        (
          resolve,
          reject
        ) => {
          const tx =
            db.transaction(
              storeName,
              "readonly"
            );

          const request =
            tx.objectStore(
              storeName
            )
              .getAll();

          request.onsuccess =
            () =>
              resolve(
                (
                  request.result ||
                  []
                ) as IndexedDbStoredFile[]
              );

          request.onerror =
            () =>
              reject(
                request.error
              );
        }
      );
    } finally {
      db.close();
    }
  };

const toFile =
  (
    stored:
      IndexedDbStoredFile
  ) =>
    new File(
      [
        stored.blob,
      ],
      stored.fileName ||
        stored.id,
      {
        type:
          stored.mimeType ||
          stored.fileType ||
          stored.blob.type ||
          "application/octet-stream",
      }
    );

export const migrateLegacyIndexedDbFilesOnce =
  async (
    profileId:
      string
  ) => {
    const markerKey =
      `${MIGRATION_MARKER}:${profileId}`;

    if (
      localStorage.getItem(
        markerKey
      ) === "done"
    ) {
      return;
    }

    const errors:
      unknown[] =
      [];

    const run =
      async (
        action:
          () => Promise<void>
      ) => {
        try {
          await action();
        } catch (
          error
        ) {
          errors.push(
            error
          );

          console.error(
            "[Central File Migration]",
            error
          );
        }
      };

    // Marketing Support current + legacy file repositories.
    for (
      const storeName of [
        "marketing_support_files",
        "supporting_document_files",
      ]
    ) {
      const rows =
        await readAllFromStore(
          "pertalife_marketing_os_files",
          storeName
        );

      for (
        const row of rows
      ) {
        if (
          !row.id ||
          !row.blob
        ) {
          continue;
        }

        await run(
          () =>
            saveMarketingSupportFile(
              row.id,
              toFile(
                row
              )
            )
        );
      }
    }

    const pipelineStores = [
      {
        name:
          "quotation_files",
        save:
          saveQuotationFile,
      },
      {
        name:
          "outcome_files",
        save:
          saveOutcomeDocumentFile,
      },
      {
        name:
          "quotation_revision_files",
        save:
          saveQuotationRevisionFile,
      },
    ] as const;

    for (
      const definition of
      pipelineStores
    ) {
      const rows =
        await readAllFromStore(
          "pertalife_pipeline_files",
          definition.name
        );

      for (
        const row of rows
      ) {
        if (
          !row.id ||
          !row.blob
        ) {
          continue;
        }

        await run(
          () =>
            definition.save(
              row.id,
              toFile(
                row
              )
            )
        );
      }
    }

    const handoverRows =
      await readAllFromStore(
        "pertalife_document_handover_files",
        "files"
      );

    for (
      const row of handoverRows
    ) {
      if (
        !row.id ||
        !row.blob ||
        !row.transactionId
      ) {
        continue;
      }

      const record:
        DocumentHandoverStoredFile = {
          id:
            row.id,
          transactionId:
            row.transactionId,
          fileName:
            row.fileName ||
            row.id,
          fileType:
            row.fileType ||
            row.mimeType ||
            row.blob.type ||
            "application/octet-stream",
          fileSize:
            row.fileSize ||
            row.blob.size,
          uploadedByUserId:
            row.uploadedByUserId ||
            "",
          uploadedByName:
            row.uploadedByName ||
            "",
          uploadedAt:
            row.uploadedAt ||
            row.savedAt ||
            new Date().toISOString(),
          blob:
            row.blob,
        };

      await run(
        () =>
          saveDocumentHandoverFile(
            record
          )
      );
    }

    if (
      errors.length ===
      0
    ) {
      // This marker is only migration bookkeeping; it is not business data.
      localStorage.setItem(
        markerKey,
        "done"
      );
    } else {
      console.warn(
        `[Central File Migration] ${errors.length} file gagal dimigrasikan. Marker tidak dibuat agar dapat dicoba lagi.`
      );
    }
  };
