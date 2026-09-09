import type { SpreadsheetRow } from '@/utils/marketingWorkbook';
import type { AgentMaster } from '@/data/agentMasterData';
import type { BrokerMaster } from '@/data/brokerMasterData';

export const AGENT_BULK_HEADERS = [
  'No.',
  'Kode Agen',
  'Nama Agen Asuransi',
  'Perusahaan Asuransi',
  'Nomor Lisensi',
  'Tanggal Lisensi',
  'Tanggal Masa Berlaku Lisensi',
  'Email',
  'Status',
] as const;

export const BROKER_BULK_HEADERS = [
  'Nomor',
  'Nama Perusahaan',
  'Nomor Izin Usaha',
  'Tanggal Izin Usaha',
  'Alamat',
  'Kota',
  'Kode Pos',
  'Nomor Telepon 1',
  'Nomor Telepon 2',
  'Nomor Fax',
  'Alamat Email',
  'Website',
] as const;

export type MasterBulkKind = 'agent' | 'broker';
export type MasterBulkStatus = 'Active' | 'Inactive';
export type MasterBulkDisposition = 'ADD' | 'SKIP' | 'ERROR';

export type MasterBulkIssue = {
  rowNumber: number;
  field: string;
  message: string;
};

export type AgentBulkCandidate = {
  rowNumber: number;
  agentCode: string;
  agentName: string;
  insuranceCompany: string;
  licenseNumber: string;
  licenseDate: string;
  licenseExpiryDate: string;
  email: string;
  status: MasterBulkStatus;
  disposition: MasterBulkDisposition;
  issues: MasterBulkIssue[];
};

export type BrokerBulkCandidate = {
  rowNumber: number;
  companyName: string;
  licenseNumber: string;
  licenseDate: string;
  address: string;
  city: string;
  postalCode: string;
  phone1: string;
  phone2: string;
  fax: string;
  email: string;
  website: string;
  disposition: MasterBulkDisposition;
  issues: MasterBulkIssue[];
};

export type MasterBulkReview<T> = {
  rows: T[];
  issues: MasterBulkIssue[];
  addCount: number;
  skipCount: number;
  errorCount: number;
};

const clean = (value: unknown): string =>
  String(value ?? '')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u200B-\u200D\u2060]/g, '')
    .trim()
    .replace(/\s+/g, ' ');

const key = (value: unknown): string => clean(value).toLocaleLowerCase('id-ID');

const safeTextIdentity = (value: string, label: string): string | null => {
  if (!value) return `${label} wajib diisi.`;
  if (/[eE][+-]?\d+$/.test(value)) {
    return `${label} terbaca sebagai notasi ilmiah. Format kolom sebagai Text di Excel agar kode tidak berubah.`;
  }
  return null;
};

const isoFromParts = (year: number, month: number, day: number): string | null => {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
};

/** Accept ISO, DD/MM/YYYY variants, or an Excel 1900-system serial date. */
export const normalizeMasterDate = (raw: unknown): string => {
  const value = clean(raw);
  if (!value) return '';

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (iso) {
    const result = isoFromParts(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    if (!result) throw new Error(`Tanggal tidak valid: ${value}.`);
    return result;
  }

  const local = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/.exec(value);
  if (local) {
    const result = isoFromParts(Number(local[3]), Number(local[2]), Number(local[1]));
    if (!result) throw new Error(`Tanggal tidak valid: ${value}.`);
    return result;
  }

  if (/^\d+(?:\.\d+)?$/.test(value)) {
    const serial = Number(value);
    if (!Number.isFinite(serial) || serial < 1 || serial > 2958465) {
      throw new Error(`Serial tanggal Excel tidak valid: ${value}.`);
    }
    const millis = Date.UTC(1899, 11, 30) + Math.floor(serial) * 86_400_000;
    const date = new Date(millis);
    if (Number.isNaN(date.getTime())) throw new Error(`Serial tanggal Excel tidak valid: ${value}.`);
    return date.toISOString().slice(0, 10);
  }

  throw new Error(`Format tanggal tidak dikenali: ${value}. Gunakan tanggal Excel atau DD/MM/YYYY.`);
};

export const normalizeAgentStatus = (raw: unknown): MasterBulkStatus => {
  const value = key(raw).replace(/[\s_-]+/g, ' ');
  if (value === 'active' || value === 'aktif') return 'Active';
  if (value === 'inactive' || value === 'nonaktif' || value === 'non aktif' || value === 'tidak aktif') return 'Inactive';
  throw new Error('Status Agent wajib Active/Inactive (atau Aktif/Tidak Aktif).');
};

const validEmail = (value: string): boolean => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const sameAgent = (candidate: AgentBulkCandidate, existing: AgentMaster): boolean =>
  key(candidate.agentCode) === key(existing.agentCode) &&
  key(candidate.agentName) === key(existing.agentName) &&
  key(candidate.insuranceCompany) === key(existing.insuranceCompany) &&
  key(candidate.licenseNumber) === key(existing.licenseNumber) &&
  clean(candidate.licenseDate) === clean(existing.licenseDate) &&
  clean(candidate.licenseExpiryDate) === clean(existing.licenseExpiryDate) &&
  key(candidate.email) === key(existing.email) &&
  candidate.status === existing.status;

/**
 * Broker equality deliberately excludes the legacy `status` compatibility field.
 * Broker licensing/authorization is determined by OJK, not by a PertaLife
 * Active/Inactive flag. Source identity and contact fields remain exact.
 */
const sameBroker = (candidate: BrokerBulkCandidate, existing: BrokerMaster): boolean =>
  key(candidate.companyName) === key(existing.companyName) &&
  key(candidate.licenseNumber) === key(existing.licenseNumber) &&
  clean(candidate.licenseDate) === clean(existing.licenseDate) &&
  key(candidate.address) === key(existing.address) &&
  key(candidate.city) === key(existing.city) &&
  clean(candidate.postalCode) === clean(existing.postalCode) &&
  clean(candidate.phone1) === clean(existing.phone1) &&
  clean(candidate.phone2) === clean(existing.phone2) &&
  clean(candidate.fax) === clean(existing.fax) &&
  key(candidate.email) === key(existing.email) &&
  key(candidate.website) === key(existing.website);

const summarize = <T extends { disposition: MasterBulkDisposition; issues: MasterBulkIssue[] }>(rows: T[]): MasterBulkReview<T> => ({
  rows,
  issues: rows.flatMap(row => row.issues),
  addCount: rows.filter(row => row.disposition === 'ADD').length,
  skipCount: rows.filter(row => row.disposition === 'SKIP').length,
  errorCount: rows.filter(row => row.disposition === 'ERROR').length,
});

const addIssue = <T extends { issues: MasterBulkIssue[]; disposition: MasterBulkDisposition }>(
  row: T,
  rowNumber: number,
  field: string,
  message: string
) => {
  row.issues.push({ rowNumber, field, message });
  row.disposition = 'ERROR';
};

export const reviewAgentBulkRows = (
  sourceRows: SpreadsheetRow[],
  existingAgents: AgentMaster[]
): MasterBulkReview<AgentBulkCandidate> => {
  const rows: AgentBulkCandidate[] = sourceRows.map((source, index) => {
    const rowNumber = index + 2;
    const candidate: AgentBulkCandidate = {
      rowNumber,
      agentCode: clean(source['Kode Agen']),
      agentName: clean(source['Nama Agen Asuransi']),
      insuranceCompany: clean(source['Perusahaan Asuransi']),
      licenseNumber: clean(source['Nomor Lisensi']),
      licenseDate: '',
      licenseExpiryDate: '',
      email: clean(source.Email),
      status: 'Inactive',
      disposition: 'ADD',
      issues: [],
    };

    for (const [field, value] of [
      ['Kode Agen', candidate.agentCode],
      ['Nama Agen Asuransi', candidate.agentName],
      ['Perusahaan Asuransi', candidate.insuranceCompany],
      ['Nomor Lisensi', candidate.licenseNumber],
    ] as const) {
      const issue = safeTextIdentity(value, field);
      if (issue) addIssue(candidate, rowNumber, field, issue);
    }

    try { candidate.licenseDate = normalizeMasterDate(source['Tanggal Lisensi']); }
    catch (error) { addIssue(candidate, rowNumber, 'Tanggal Lisensi', error instanceof Error ? error.message : 'Tanggal lisensi tidak valid.'); }
    try { candidate.licenseExpiryDate = normalizeMasterDate(source['Tanggal Masa Berlaku Lisensi']); }
    catch (error) { addIssue(candidate, rowNumber, 'Tanggal Masa Berlaku Lisensi', error instanceof Error ? error.message : 'Tanggal masa berlaku lisensi tidak valid.'); }
    try { candidate.status = normalizeAgentStatus(source.Status); }
    catch (error) { addIssue(candidate, rowNumber, 'Status', error instanceof Error ? error.message : 'Status tidak valid.'); }
    if (!validEmail(candidate.email)) addIssue(candidate, rowNumber, 'Email', 'Format email tidak valid.');

    return candidate;
  });

  const codeRows = new Map<string, AgentBulkCandidate[]>();
  const licenseRows = new Map<string, AgentBulkCandidate[]>();
  for (const row of rows) {
    const codeKey = key(row.agentCode);
    const licenseKey = key(row.licenseNumber);
    if (codeKey) codeRows.set(codeKey, [...(codeRows.get(codeKey) || []), row]);
    if (licenseKey) licenseRows.set(licenseKey, [...(licenseRows.get(licenseKey) || []), row]);
  }
  for (const group of codeRows.values()) if (group.length > 1) {
    for (const row of group) addIssue(row, row.rowNumber, 'Kode Agen', 'Kode Agen duplikat di dalam file.');
  }
  for (const group of licenseRows.values()) if (group.length > 1) {
    for (const row of group) addIssue(row, row.rowNumber, 'Nomor Lisensi', 'Nomor Lisensi duplikat di dalam file.');
  }

  for (const row of rows) {
    if (row.disposition === 'ERROR') continue;
    const matches = existingAgents.filter(existing =>
      key(existing.agentCode) === key(row.agentCode) ||
      (!!row.licenseNumber && key(existing.licenseNumber) === key(row.licenseNumber))
    );
    if (matches.length === 0) continue;
    if (matches.length === 1 && sameAgent(row, matches[0])) {
      row.disposition = 'SKIP';
      continue;
    }
    addIssue(row, row.rowNumber, 'Existing Master', 'Kode Agen atau Nomor Lisensi sudah ada dengan data berbeda. Bulk import tidak menimpa data existing; gunakan Edit untuk rekonsiliasi.');
  }

  return summarize(rows);
};

export const reviewBrokerBulkRows = (
  sourceRows: SpreadsheetRow[],
  existingBrokers: BrokerMaster[]
): MasterBulkReview<BrokerBulkCandidate> => {
  const rows: BrokerBulkCandidate[] = sourceRows.map((source, index) => {
    const rowNumber = index + 2;
    const candidate: BrokerBulkCandidate = {
      rowNumber,
      companyName: clean(source['Nama Perusahaan']),
      licenseNumber: clean(source['Nomor Izin Usaha']),
      licenseDate: '',
      address: clean(source.Alamat),
      city: clean(source.Kota),
      postalCode: clean(source['Kode Pos']),
      phone1: clean(source['Nomor Telepon 1']),
      phone2: clean(source['Nomor Telepon 2']),
      fax: clean(source['Nomor Fax']),
      email: clean(source['Alamat Email']),
      website: clean(source.Website),
      disposition: 'ADD',
      issues: [],
    };

    for (const [field, value] of [
      ['Nama Perusahaan', candidate.companyName],
      ['Nomor Izin Usaha', candidate.licenseNumber],
    ] as const) {
      const issue = safeTextIdentity(value, field);
      if (issue) addIssue(candidate, rowNumber, field, issue);
    }
    try { candidate.licenseDate = normalizeMasterDate(source['Tanggal Izin Usaha']); }
    catch (error) { addIssue(candidate, rowNumber, 'Tanggal Izin Usaha', error instanceof Error ? error.message : 'Tanggal izin tidak valid.'); }
    if (!validEmail(candidate.email)) addIssue(candidate, rowNumber, 'Alamat Email', 'Format email tidak valid.');

    return candidate;
  });

  const companyRows = new Map<string, BrokerBulkCandidate[]>();
  const licenseRows = new Map<string, BrokerBulkCandidate[]>();
  for (const row of rows) {
    const companyKey = key(row.companyName);
    const licenseKey = key(row.licenseNumber);
    if (companyKey) companyRows.set(companyKey, [...(companyRows.get(companyKey) || []), row]);
    if (licenseKey) licenseRows.set(licenseKey, [...(licenseRows.get(licenseKey) || []), row]);
  }
  for (const group of companyRows.values()) if (group.length > 1) {
    for (const row of group) addIssue(row, row.rowNumber, 'Nama Perusahaan', 'Nama perusahaan duplikat di dalam file.');
  }
  for (const group of licenseRows.values()) if (group.length > 1) {
    for (const row of group) addIssue(row, row.rowNumber, 'Nomor Izin Usaha', 'Nomor izin usaha duplikat di dalam file dan wajib direkonsiliasi sebelum import.');
  }

  for (const row of rows) {
    if (row.disposition === 'ERROR') continue;
    const matches = existingBrokers.filter(existing =>
      key(existing.companyName) === key(row.companyName) ||
      (!!row.licenseNumber && key(existing.licenseNumber) === key(row.licenseNumber))
    );
    if (matches.length === 0) continue;
    if (matches.length === 1 && sameBroker(row, matches[0])) {
      row.disposition = 'SKIP';
      continue;
    }
    addIssue(row, row.rowNumber, 'Existing Master', 'Nama perusahaan atau Nomor Izin Usaha sudah ada dengan data berbeda. Bulk import tidak menimpa data existing; gunakan Edit untuk rekonsiliasi.');
  }

  return summarize(rows);
};
