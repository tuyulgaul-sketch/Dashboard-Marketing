import type { TargetEntry, User } from '@/types';
import { normalizeTargetUploadRows, parseExactTargetRupiah } from './targetCompact';

export type TargetKind = 'NB' | 'RN';
export type TargetDraft = Record<string, { NB: string[]; RN: string[]; notes: string }>;
export type TargetBaseline = { NB: string; RN: string };

export const TARGET_MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'] as const;
export const TARGET_SETUP_ROLES = new Set([
  'DIRECTOR_MARKETING', 'ADVISOR_MARKETING_DIRECTOR', 'VP_CAPTIVE_MARKETING',
  'VP_CORPORATE_RETAIL_MARKETING', 'DEPARTMENT_HEAD_MARKETING',
  'SUPERVISOR_MARKETING', 'STAFF_MARKETING',
]);

export const targetSetupHolders = (users: User[]): User[] =>
  users.filter(user => user.status === 'Active' && TARGET_SETUP_ROLES.has(user.role));

const exact = (value: string, label: string): number => {
  try { return parseExactTargetRupiah(value); }
  catch (error) { throw new Error(`${label}: ${error instanceof Error ? error.message : 'Nilai tidak valid.'}`); }
};
const sum = (values: number[], label: string): number => {
  const value = values.reduce((total, amount) => total + amount, 0);
  if (!Number.isSafeInteger(value)) throw new Error(`${label} melebihi batas bilangan bulat presisi.`);
  return value;
};

export const seedTargetDraft = (users: User[], targets: TargetEntry[], year: number): {
  draft: TargetDraft; baseline: TargetBaseline; confirmed: string[];
} => {
  const draft: TargetDraft = {};
  const confirmed: string[] = [];
  const byId = new Map(targets.filter(row => row.year === year).map(row => [row.userId, row]));
  for (const user of targetSetupHolders(users)) {
    const existing = byId.get(user.id);
    const monthly = (kind: TargetKind) => Array.from({ length: 12 }, (_, index) =>
      String(existing?.[kind === 'NB' ? 'monthlyNewBusiness' : 'monthlyRenewal']?.[index] ?? 0));
    draft[user.id] = { NB: monthly('NB'), RN: monthly('RN'), notes: existing?.notes || '' };
    if (existing) confirmed.push(user.id);
  }
  const director = targets.find(row => row.year === year && users.some(user => user.id === row.userId && user.role === 'DIRECTOR_MARKETING'));
  return { draft, confirmed, baseline: { NB: director ? String(director.annualTargetNewBusiness) : '', RN: director ? String(director.annualTargetRenewal) : '' } };
};

export const calculateTargetSetup = (users: User[], draft: TargetDraft, year: number, baseline: TargetBaseline): {
  entries: TargetEntry[];
  director: TargetEntry;
  total: number;
  expectedTotal: number;
  differences: { NB: number; RN: number };
} => {
  const holders = targetSetupHolders(users);
  const rows = holders.flatMap(user => {
    const allocation = draft[user.id];
    if (!allocation || allocation.NB.length !== 12 || allocation.RN.length !== 12) throw new Error(`Alokasi ${user.name} belum lengkap.`);
    return TARGET_MONTHS.flatMap((_, index) => (['NB', 'RN'] as const).map(kind => ({
      Tahun: String(year), 'User ID Penerima': user.id, Periode: String(index + 1),
      'NB/RN': kind, 'Target (Rp)': String(exact(allocation[kind][index], `${user.name}, ${TARGET_MONTHS[index]} ${kind}`)),
      Catatan: allocation.notes,
    })));
  });
  const expanded = normalizeTargetUploadRows(rows, users, year);
  const byId = new Map(holders.map(user => [user.id, user]));
  const entries: TargetEntry[] = expanded.map(row => {
    const user = byId.get(row['User ID Penerima'])!;
    const number = (key: string) => exact(row[key], `${user.name} ${key}`);
    return {
      id: `TRG-${year}-${user.id}`, year, userId: user.id, userName: user.name,
      position: user.position, unit: user.unit, department: user.department,
      annualTargetTotal: number('Target Tahunan'),
      annualTargetNewBusiness: number('Target Tahunan NB'), annualTargetRenewal: number('Target Tahunan RN'),
      personalTargetTotal: number('Target Pribadi'),
      personalTargetNewBusiness: number('Target Pribadi NB'), personalTargetRenewal: number('Target Pribadi RN'),
      monthlyNewBusiness: TARGET_MONTHS.map(month => number(`${month} NB`)),
      monthlyRenewal: TARGET_MONTHS.map(month => number(`${month} RN`)),
      notes: row.Catatan || undefined, publishedAt: '', publishedBy: '',
    };
  });
  const director = entries.find(entry => byId.get(entry.userId)?.role === 'DIRECTOR_MARKETING');
  if (!director) throw new Error('Direktur Marketing aktif tidak ditemukan.');
  const expectedNB = exact(baseline.NB, 'Target Direktorat NB');
  const expectedRN = exact(baseline.RN, 'Target Direktorat RN');
  const expectedTotal = sum([expectedNB, expectedRN], 'Target Direktorat');
  return {
    entries, director, total: director.annualTargetTotal, expectedTotal,
    differences: { NB: director.annualTargetNewBusiness - expectedNB, RN: director.annualTargetRenewal - expectedRN },
  };
};

export const validateTargetSetup = (users: User[], draft: TargetDraft, year: number, baseline: TargetBaseline, confirmed: string[]) => {
  const result = calculateTargetSetup(users, draft, year, baseline);
  const missing = targetSetupHolders(users).filter(user => !confirmed.includes(user.id));
  if (missing.length) throw new Error(`Konfirmasi alokasi pribadi belum lengkap: ${missing.map(user => user.name).join(', ')}. Nilai nol harus dikonfirmasi secara sengaja.`);
  if (result.differences.NB !== 0 || result.differences.RN !== 0) throw new Error('Cascading NB/RN belum sama dengan target Direktorat. Periksa alokasi pribadi dan struktur atasan.');
  return result;
};
