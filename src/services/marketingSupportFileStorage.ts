const MARKETING_SUPPORT_FILE_DB =
  'pertalife_marketing_os_files';

const MARKETING_SUPPORT_FILE_DB_VERSION =
  2;

const MARKETING_SUPPORT_FILE_STORE =
  'marketing_support_files';

const LEGACY_SUPPORTING_FILE_STORE =
  'supporting_document_files';

export interface StoredMarketingSupportFile {
  id: string;
  blob: Blob;
  fileName: string;
  mimeType: string;
  savedAt: string;
}

const openDb =
  (): Promise<IDBDatabase> =>
    new Promise(
      (
        resolve,
        reject
      ) => {
        const request =
          indexedDB.open(
            MARKETING_SUPPORT_FILE_DB,
            MARKETING_SUPPORT_FILE_DB_VERSION
          );

        request.onupgradeneeded =
          () => {
            const db =
              request.result;

            if (
              !db.objectStoreNames.contains(
                MARKETING_SUPPORT_FILE_STORE
              )
            ) {
              db.createObjectStore(
                MARKETING_SUPPORT_FILE_STORE,
                {
                  keyPath:
                    'id',
                }
              );
            }

            // Keep the old repository intact. Existing SPAJ/Proposal
            // binaries from previous UAT versions can still be read
            // through the fallback download method below.
            if (
              !db.objectStoreNames.contains(
                LEGACY_SUPPORTING_FILE_STORE
              )
            ) {
              db.createObjectStore(
                LEGACY_SUPPORTING_FILE_STORE,
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

const getFromStore =
  async (
    db:
      IDBDatabase,
    storeName:
      string,
    id:
      string
  ): Promise<
    StoredMarketingSupportFile | null
  > =>
    new Promise(
      (
        resolve,
        reject
      ) => {
        if (
          !db.objectStoreNames.contains(
            storeName
          )
        ) {
          resolve(
            null
          );

          return;
        }

        const transaction =
          db.transaction(
            storeName,
            'readonly'
          );

        const request =
          transaction
            .objectStore(
              storeName
            )
            .get(
              id
            );

        request.onsuccess =
          () =>
            resolve(
              request.result ||
              null
            );

        request.onerror =
          () =>
            reject(
              request.error
            );
      }
    );

export const saveMarketingSupportFile =
  async (
    id:
      string,
    file:
      File
  ) => {
    const db =
      await openDb();

    await new Promise<void>(
      (
        resolve,
        reject
      ) => {
        const transaction =
          db.transaction(
            MARKETING_SUPPORT_FILE_STORE,
            'readwrite'
          );

        transaction
          .objectStore(
            MARKETING_SUPPORT_FILE_STORE
          )
          .put({
            id,
            blob:
              file,
            fileName:
              file.name,
            mimeType:
              file.type ||
              'application/octet-stream',
            savedAt:
              new Date().toISOString(),
          } satisfies StoredMarketingSupportFile);

        transaction.oncomplete =
          () =>
            resolve();

        transaction.onerror =
          () =>
            reject(
              transaction.error
            );
      }
    );

    db.close();
  };

export const getMarketingSupportFile =
  async (
    id:
      string
  ): Promise<
    StoredMarketingSupportFile | null
  > => {
    const db =
      await openDb();

    try {
      const current =
        await getFromStore(
          db,
          MARKETING_SUPPORT_FILE_STORE,
          id
        );

      if (
        current
      ) {
        return current;
      }

      return await getFromStore(
        db,
        LEGACY_SUPPORTING_FILE_STORE,
        id
      );
    } finally {
      db.close();
    }
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
        'File binary tidak tersedia pada browser ini. Metadata dokumen tetap tercatat.'
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
      'dokumen';

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
    const db =
      await openDb();

    try {
      if (
        db.objectStoreNames.contains(
          MARKETING_SUPPORT_FILE_STORE
        )
      ) {
        await new Promise<void>(
          (
            resolve,
            reject
          ) => {
            const transaction =
              db.transaction(
                MARKETING_SUPPORT_FILE_STORE,
                'readwrite'
              );

            transaction
              .objectStore(
                MARKETING_SUPPORT_FILE_STORE
              )
              .delete(
                id
              );

            transaction.oncomplete =
              () =>
                resolve();

            transaction.onerror =
              () =>
                reject(
                  transaction.error
                );
          }
        );
      }
    } finally {
      db.close();
    }
  };
