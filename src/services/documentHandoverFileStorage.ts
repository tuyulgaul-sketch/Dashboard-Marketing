/**
 * IndexedDB storage for physical document handover receipt evidence.
 * Prototype note: files remain browser-local until shared backend/storage exists.
 */

const DB_NAME = 'pertalife_document_handover_files';
const DB_VERSION = 1;
const STORE_NAME = 'files';

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

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('transactionId', 'transactionId', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Gagal membuka penyimpanan foto Tanda Terima.'));
  });

export const saveDocumentHandoverFile = async (
  record: DocumentHandoverStoredFile
): Promise<void> => {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Gagal menyimpan foto Tanda Terima.'));
  });
  db.close();
};

export const getDocumentHandoverFile = async (
  fileId: string
): Promise<DocumentHandoverStoredFile | undefined> => {
  const db = await openDb();
  const result = await new Promise<DocumentHandoverStoredFile | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(fileId);
    request.onsuccess = () => resolve(request.result as DocumentHandoverStoredFile | undefined);
    request.onerror = () => reject(request.error || new Error('Gagal membaca foto Tanda Terima.'));
  });
  db.close();
  return result;
};

export const openDocumentHandoverFile = async (fileId: string): Promise<void> => {
  const file = await getDocumentHandoverFile(fileId);
  if (!file) {
    throw new Error('Foto bukti penerimaan tidak ditemukan pada browser ini.');
  }
  const url = URL.createObjectURL(file.blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
};
