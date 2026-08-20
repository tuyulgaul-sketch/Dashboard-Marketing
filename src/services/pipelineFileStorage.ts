const PIPELINE_FILE_DB_NAME =
  'pertalife_pipeline_files';

const PIPELINE_FILE_DB_VERSION =
  3;

const QUOTATION_FILE_STORE =
  'quotation_files';

const OUTCOME_FILE_STORE =
  'outcome_files';

const QUOTATION_REVISION_FILE_STORE =
  'quotation_revision_files';

interface StoredPipelineFile {
  id: string;
  blob: Blob;
  fileName: string;
  mimeType: string;
  savedAt: string;
}

const openPipelineFileDb =
  (): Promise<IDBDatabase> =>
    new Promise(
      (
        resolve,
        reject
      ) => {
        const request =
          indexedDB.open(
            PIPELINE_FILE_DB_NAME,
            PIPELINE_FILE_DB_VERSION
          );

        request.onupgradeneeded =
          () => {
            const db =
              request.result;

            if (
              !db.objectStoreNames.contains(
                QUOTATION_FILE_STORE
              )
            ) {
              db.createObjectStore(
                QUOTATION_FILE_STORE,
                {
                  keyPath:
                    'id',
                }
              );
            }

            if (
              !db.objectStoreNames.contains(
                OUTCOME_FILE_STORE
              )
            ) {
              db.createObjectStore(
                OUTCOME_FILE_STORE,
                {
                  keyPath:
                    'id',
                }
              );
            }

            if (
              !db.objectStoreNames.contains(
                QUOTATION_REVISION_FILE_STORE
              )
            ) {
              db.createObjectStore(
                QUOTATION_REVISION_FILE_STORE,
                {
                  keyPath:
                    'id',
                }
              );
            }
          };

        request.onsuccess =
          () =>
            resolve(
              request.result
            );

        request.onerror =
          () =>
            reject(
              request.error
            );
      }
    );

export const saveQuotationFile =
  async (
    quotationId: string,
    file: File
  ) => {
    const db =
      await openPipelineFileDb();

    await new Promise<void>(
      (
        resolve,
        reject
      ) => {
        const transaction =
          db.transaction(
            QUOTATION_FILE_STORE,
            'readwrite'
          );

        const store =
          transaction.objectStore(
            QUOTATION_FILE_STORE
          );

        const payload:
          StoredPipelineFile = {
            id:
              quotationId,
            blob:
              file,
            fileName:
              file.name,
            mimeType:
              file.type ||
              'application/octet-stream',
            savedAt:
              new Date().toISOString(),
          };

        store.put(
          payload
        );

        transaction.oncomplete =
          () => {
            db.close();
            resolve();
          };

        transaction.onerror =
          () => {
            db.close();
            reject(
              transaction.error
            );
          };
      }
    );
  };

export const getQuotationFile =
  async (
    quotationId: string
  ): Promise<StoredPipelineFile | null> => {
    const db =
      await openPipelineFileDb();

    return new Promise(
      (
        resolve,
        reject
      ) => {
        const transaction =
          db.transaction(
            QUOTATION_FILE_STORE,
            'readonly'
          );

        const store =
          transaction.objectStore(
            QUOTATION_FILE_STORE
          );

        const request =
          store.get(
            quotationId
          );

        request.onsuccess =
          () => {
            db.close();
            resolve(
              request.result ||
              null
            );
          };

        request.onerror =
          () => {
            db.close();
            reject(
              request.error
            );
          };
      }
    );
  };

export const downloadQuotationFile =
  async (
    quotationId: string,
    fallbackFileName?: string
  ) => {
    const stored =
      await getQuotationFile(
        quotationId
      );

    if (!stored) {
      throw new Error(
        'File binary penawaran tidak tersedia pada browser ini. Data dummy/legacy hanya memiliki metadata file.'
      );
    }

    const url =
      URL.createObjectURL(
        stored.blob
      );

    const anchor =
      document.createElement(
        'a'
      );

    anchor.href =
      url;

    anchor.download =
      stored.fileName ||
      fallbackFileName ||
      'Penawaran';

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


export const saveOutcomeDocumentFile =
  async (
    documentId: string,
    file: File
  ) => {
    const db =
      await openPipelineFileDb();

    await new Promise<void>(
      (
        resolve,
        reject
      ) => {
        const transaction =
          db.transaction(
            OUTCOME_FILE_STORE,
            'readwrite'
          );

        const store =
          transaction.objectStore(
            OUTCOME_FILE_STORE
          );

        const payload:
          StoredPipelineFile = {
            id:
              documentId,
            blob:
              file,
            fileName:
              file.name,
            mimeType:
              file.type ||
              'application/octet-stream',
            savedAt:
              new Date().toISOString(),
          };

        store.put(
          payload
        );

        transaction.oncomplete =
          () => {
            db.close();
            resolve();
          };

        transaction.onerror =
          () => {
            db.close();
            reject(
              transaction.error
            );
          };
      }
    );
  };

export const getOutcomeDocumentFile =
  async (
    documentId: string
  ): Promise<StoredPipelineFile | null> => {
    const db =
      await openPipelineFileDb();

    return new Promise(
      (
        resolve,
        reject
      ) => {
        const transaction =
          db.transaction(
            OUTCOME_FILE_STORE,
            'readonly'
          );

        const store =
          transaction.objectStore(
            OUTCOME_FILE_STORE
          );

        const request =
          store.get(
            documentId
          );

        request.onsuccess =
          () => {
            db.close();

            resolve(
              request.result ||
              null
            );
          };

        request.onerror =
          () => {
            db.close();

            reject(
              request.error
            );
          };
      }
    );
  };

export const downloadOutcomeDocumentFile =
  async (
    documentId: string,
    fallbackFileName?: string
  ) => {
    const stored =
      await getOutcomeDocumentFile(
        documentId
      );

    if (!stored) {
      throw new Error(
        'File binary dokumen usulan WIN/LOSE tidak tersedia pada browser ini. Metadata dokumen tetap tercatat.'
      );
    }

    const url =
      URL.createObjectURL(
        stored.blob
      );

    const anchor =
      document.createElement(
        'a'
      );

    anchor.href =
      url;

    anchor.download =
      stored.fileName ||
      fallbackFileName ||
      'Dokumen Outcome';

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


export const saveQuotationRevisionFile =
  async (
    documentId: string,
    file: File
  ) => {
    const db =
      await openPipelineFileDb();

    await new Promise<void>(
      (
        resolve,
        reject
      ) => {
        const transaction =
          db.transaction(
            QUOTATION_REVISION_FILE_STORE,
            'readwrite'
          );

        const store =
          transaction.objectStore(
            QUOTATION_REVISION_FILE_STORE
          );

        const payload:
          StoredPipelineFile = {
            id:
              documentId,
            blob:
              file,
            fileName:
              file.name,
            mimeType:
              file.type ||
              'application/octet-stream',
            savedAt:
              new Date().toISOString(),
          };

        store.put(
          payload
        );

        transaction.oncomplete =
          () => {
            db.close();
            resolve();
          };

        transaction.onerror =
          () => {
            db.close();
            reject(
              transaction.error
            );
          };
      }
    );
  };

export const getQuotationRevisionFile =
  async (
    documentId: string
  ): Promise<StoredPipelineFile | null> => {
    const db =
      await openPipelineFileDb();

    return new Promise(
      (
        resolve,
        reject
      ) => {
        const transaction =
          db.transaction(
            QUOTATION_REVISION_FILE_STORE,
            'readonly'
          );

        const store =
          transaction.objectStore(
            QUOTATION_REVISION_FILE_STORE
          );

        const request =
          store.get(
            documentId
          );

        request.onsuccess =
          () => {
            db.close();

            resolve(
              request.result ||
              null
            );
          };

        request.onerror =
          () => {
            db.close();

            reject(
              request.error
            );
          };
      }
    );
  };

export const downloadQuotationRevisionFile =
  async (
    documentId: string,
    fallbackFileName?: string
  ) => {
    const stored =
      await getQuotationRevisionFile(
        documentId
      );

    if (!stored) {
      throw new Error(
        'File lampiran revisi penawaran tidak tersedia pada browser ini. Metadata file tetap tercatat.'
      );
    }

    const url =
      URL.createObjectURL(
        stored.blob
      );

    const anchor =
      document.createElement(
        'a'
      );

    anchor.href =
      url;

    anchor.download =
      stored.fileName ||
      fallbackFileName ||
      'Lampiran Revisi Penawaran';

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
