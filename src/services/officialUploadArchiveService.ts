import { supabase } from '@/lib/supabase';
import { CENTRAL_BUSINESS_STORAGE_KEYS } from '@/services/centralBusinessService';
import { refreshCentralBusinessRuntime, waitForCentralBusinessStorageSync } from '@/services/centralBusinessStorageRuntime';
import { refreshCentralTargetRuntime } from '@/services/centralTargetRuntime';

export type OfficialUploadKind = 'target' | 'pipeline' | 'realization';
export interface OfficialUploadBatch {
  kind: OfficialUploadKind;
  id: string;
  label: string;
  year: number | null;
  uploadedAt: string | null;
  recordCount: number;
  amount: number;
  status: string;
  periods?: string[];
}
export interface OfficialUploadPreview extends OfficialUploadBatch {
  hash: string;
  blocked: number;
  periods: string[];
}
export interface OfficialUploadArchiveReceipt {
  archiveId: string;
  kind: OfficialUploadKind;
  id: string;
  recordCount: number;
  status: 'Archived';
}

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Respons pengelolaan upload tidak valid.');
  return value as Record<string, unknown>;
};
const asText = (value: unknown): string => typeof value === 'string' ? value : '';
const asNumber = (value: unknown): number => {
  const n = Number(value);
  if (value === null || value === undefined || value === '' || !Number.isFinite(n)) throw new Error('Angka pengelolaan upload tidak valid.');
  return n;
};
const normalize = (value: unknown): OfficialUploadBatch => {
  const row = asRecord(value);
  if (!['target', 'pipeline', 'realization'].includes(asText(row.kind))) throw new Error('Jenis upload tidak dikenal.');
  const id = asText(row.id);
  if (!id) throw new Error('ID batch tidak tersedia.');
  return {
    kind: row.kind as OfficialUploadKind,
    id,
    label: asText(row.label) || id,
    year: row.year === null || row.year === undefined ? null : asNumber(row.year),
    uploadedAt: asText(row.uploadedAt) || null,
    recordCount: asNumber(row.recordCount),
    amount: asNumber(row.amount),
    status: asText(row.status),
    periods: Array.isArray(row.periods) ? row.periods.filter((item): item is string => typeof item === 'string') : [],
  };
};

export const listOfficialUploadBatches = async (): Promise<OfficialUploadBatch[]> => {
  const { data, error } = await supabase.rpc('list_official_uploads_v1');
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error('Daftar batch tidak valid.');
  return data.map(normalize);
};

export const previewOfficialUploadRemoval = async (kind: OfficialUploadKind, id: string): Promise<OfficialUploadPreview> => {
  const { data, error } = await supabase.rpc('preview_official_upload_removal_v1', { p_kind: kind, p_id: id });
  if (error) throw error;
  const row = asRecord(data);
  const preview = normalize({ ...row, status: 'Published' });
  const hash = asText(row.hash);
  const blocked = asNumber(row.blocked);
  if (preview.kind !== kind || preview.id !== id || !/^[a-f0-9]{64}$/.test(hash) || !Number.isInteger(blocked) || blocked < 0) throw new Error('Token preview tidak valid.');
  return { ...preview, hash, blocked, periods: preview.periods || [] };
};

/** The server archives exact current rows atomically. Nothing is deleted by a local browser snapshot. */
export const archiveOfficialUpload = async (preview: OfficialUploadPreview, reason: string): Promise<OfficialUploadArchiveReceipt> => {
  const trimmed = reason.trim();
  if (trimmed.length < 10 || trimmed.length > 1000) throw new Error('Alasan wajib diisi, 10–1000 karakter.');
  // Finish all queued local mutations before the server rechecks the selected snapshot.
  await Promise.all(CENTRAL_BUSINESS_STORAGE_KEYS.map(key => waitForCentralBusinessStorageSync(key)));
  const { data, error } = await supabase.rpc('archive_official_upload_v1', {
    p_kind: preview.kind,
    p_id: preview.id,
    p_expected_hash: preview.hash,
    p_reason: trimmed,
  });
  if (error) throw error;
  const row = asRecord(data);
  const receipt: OfficialUploadArchiveReceipt = {
    archiveId: asText(row.archiveId),
    kind: preview.kind,
    id: preview.id,
    recordCount: asNumber(row.recordCount),
    status: 'Archived',
  };
  if (!receipt.archiveId || row.status !== 'Archived') throw new Error('Server tidak mengembalikan bukti arsip yang valid. Periksa status sebelum mencoba lagi.');
  // The deletion is committed at this point. A refresh failure must not trigger a second deletion.
  return receipt;
};

export const refreshOfficialUploadReaders = async (): Promise<void> => {
  await Promise.all([refreshCentralTargetRuntime(), refreshCentralBusinessRuntime()]);
};
