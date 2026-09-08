export type TargetSpreadsheetRow = Record<string, string>;

export interface CompactTargetUser {
  id: string;
  name: string;
  role: string;
  status: string;
  superiorId?: string | null;
  position?: string;
  unit?: string;
  department?: string;
}

export const COMPACT_TARGET_HEADERS = [
  'Tahun', 'User ID Penerima', 'Periode', 'NB/RN', 'Target (Rp)',
] as const;

export const LEGACY_TARGET_HEADERS = [
  'Tahun', 'User ID Penerima', 'Nama Penerima', 'Jabatan', 'Department Umum',
  'Department Sub', 'Target Tahunan', 'Target Tahunan NB', 'Target Tahunan RN',
  'Target Pribadi', 'Target Pribadi NB', 'Target Pribadi RN',
  ...['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
    .flatMap(month => [`${month} NB`, `${month} RN`]),
  'Catatan',
];

const HOLDER_ROLES = new Set([
  'DIRECTOR_MARKETING', 'ADVISOR_MARKETING_DIRECTOR',
  'VP_CAPTIVE_MARKETING', 'VP_CORPORATE_RETAIL_MARKETING',
  'DEPARTMENT_HEAD_MARKETING', 'SUPERVISOR_MARKETING', 'STAFF_MARKETING',
]);
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const idOf = (value: unknown) => String(value ?? '').replace(/\u00a0/g, ' ').replace(/[\u200b-\u200d\u2060]/g, '').trim().toUpperCase();
const headerOf = (value: unknown) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const fields = (row: Record<string, unknown>) => new Map(Object.entries(row).map(([key, value]) => [headerOf(key), value]));
const valueOf = (row: Record<string, unknown>, key: string) => fields(row).get(headerOf(key));
const safeSum = (values: number[], label: string) => {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!Number.isSafeInteger(total)) throw new Error(`${label} melebihi batas bilangan bulat presisi Excel/JavaScript.`);
  return total;
};

/** Whole rupiah only. Reject scientific notation rather than silently accepting rounded source data. */
export const parseExactTargetRupiah = (raw: unknown): number => {
  if (typeof raw === 'number') {
    if (!Number.isSafeInteger(raw) || raw < 0) throw new Error('Target harus bilangan bulat rupiah yang tidak negatif dan presisi.');
    return raw;
  }
  let text = String(raw ?? '').replace(/\u00a0/g, ' ').replace(/\s/g, '').replace(/^Rp\.?/i, '');
  if (!text || /[eE]/.test(text)) throw new Error('Target wajib berupa angka rupiah lengkap; notasi ilmiah dan sel kosong tidak diperbolehkan.');
  if (/^\+/.test(text)) text = text.slice(1);
  if (/^-/.test(text)) throw new Error('Target tidak boleh negatif.');
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(text)) text = text.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(?:,\d{3})+\.\d+$/.test(text)) text = text.replace(/,/g, '');
  else if (/^\d{1,3}(?:,\d{3})+$/.test(text)) text = text.replace(/,/g, '');
  else if (/^\d+,\d+$/.test(text)) text = text.replace(',', '.');
  if (!/^\d+(?:\.0+)?$/.test(text)) throw new Error('Target harus bilangan bulat rupiah; periksa pemisah ribuan dan desimal.');
  const integer = BigInt(text.split('.')[0]);
  if (integer > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Target melebihi batas bilangan bulat presisi.');
  return Number(integer);
};

export const isCompactTargetRows = (rows: TargetSpreadsheetRow[]): boolean => {
  if (!rows.length) return false;
  const keys = new Set(Object.keys(rows[0]).map(headerOf));
  return ['periode', 'nbrn', 'targetrp'].some(key => keys.has(key));
};

const activeHolders = (users: CompactTargetUser[]) => users.filter(user => user.status === 'Active' && HOLDER_ROLES.has(user.role));

export const buildCompactTargetTemplateRows = (users: CompactTargetUser[], year: number): TargetSpreadsheetRow[] => {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error('Tahun target tidak valid.');
  return activeHolders(users).flatMap(user => MONTHS.flatMap((_, month) => ['NB', 'RN'].map(kind => ({
    Tahun: String(year), 'User ID Penerima': idOf(user.id), Periode: String(month + 1), 'NB/RN': kind, 'Target (Rp)': '0',
  }))));
};

/** Convert the narrow input into the unchanged canonical annual/monthly upload contract. */
export const expandCompactTargetRows = (
  rows: TargetSpreadsheetRow[], users: CompactTargetUser[], year: number
): TargetSpreadsheetRow[] => {
  if (!rows.length) throw new Error('File target kosong.');
  const required = COMPACT_TARGET_HEADERS.filter(header => !fields(rows[0]).has(headerOf(header)));
  if (required.length) throw new Error(`Kolom wajib format ringkas tidak ditemukan: ${required.join(', ')}.`);
  const allUsers = new Map<string, CompactTargetUser>();
  for (const user of users) {
    const id = idOf(user.id);
    if (allUsers.has(id)) throw new Error(`User Master memiliki User ID duplikat: ${id}.`);
    allUsers.set(id, user);
  }
  const holders = activeHolders(users);
  if (!holders.length) throw new Error('Daftar pemilik target aktif belum tersedia.');
  const holderMap = new Map(holders.map(user => [idOf(user.id), user]));
  const amounts = new Map<string, { NB: number[]; RN: number[]; notes: Set<string> }>();
  const seen = new Set<string>();
  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2;
    const rowYear = String(valueOf(row, 'Tahun') ?? '').trim();
    if (!/^\d{4}$/.test(rowYear) || Number(rowYear) !== year) throw new Error(`Baris ${rowNumber}: Tahun harus ${year}.`);
    const id = idOf(valueOf(row, 'User ID Penerima'));
    if (!/^USR-\d{6}$/.test(id)) throw new Error(`Baris ${rowNumber}: User ID wajib berformat USR-000000.`);
    const user = allUsers.get(id);
    if (!user) throw new Error(`Baris ${rowNumber}: User ID ${id} tidak ditemukan di User Master.`);
    if (!holderMap.has(id)) throw new Error(`Baris ${rowNumber}: User ID ${id} bukan pemilik target Marketing aktif.`);
    const periodText = String(valueOf(row, 'Periode') ?? '').trim();
    if (!/^\d{1,2}$/.test(periodText) || Number(periodText) < 1 || Number(periodText) > 12) throw new Error(`Baris ${rowNumber}: Periode harus angka 1 sampai 12.`);
    const period = Number(periodText) - 1;
    const kind = String(valueOf(row, 'NB/RN') ?? '').trim().toUpperCase();
    if (kind !== 'NB' && kind !== 'RN') throw new Error(`Baris ${rowNumber}: NB/RN harus NB atau RN.`);
    const key = `${id}|${period}|${kind}`;
    if (seen.has(key)) throw new Error(`Baris ${rowNumber}: duplikat User ID, Periode, dan NB/RN (${key}).`);
    seen.add(key);
    let amount: number;
    try { amount = parseExactTargetRupiah(valueOf(row, 'Target (Rp)')); }
    catch (error) { throw new Error(`Baris ${rowNumber}: ${error instanceof Error ? error.message : 'Target tidak valid.'}`); }
    const current = amounts.get(id) || { NB: Array(12).fill(0), RN: Array(12).fill(0), notes: new Set<string>() };
    current[kind][period] = amount;
    const note = String(valueOf(row, 'Catatan') ?? '').trim();
    if (note) current.notes.add(note);
    amounts.set(id, current);
  }
  const missing = holders.filter(user => !amounts.has(idOf(user.id))).map(user => user.id);
  if (missing.length) throw new Error(`User target aktif belum tercakup. Sertakan minimal satu baris (boleh nol) untuk: ${missing.join(', ')}.`);

  const children = new Map<string, string[]>();
  for (const user of holders) {
    const id = idOf(user.id);
    children.set(id, []);
  }
  for (const user of holders) {
    const id = idOf(user.id);
    const parent = idOf(user.superiorId);
    if (!parent) {
      if (user.role !== 'DIRECTOR_MARKETING') throw new Error(`Struktur atasan ${id} belum terhubung ke Direktur Marketing.`);
      continue;
    }
    if (!holderMap.has(parent)) throw new Error(`Atasan ${parent} untuk ${id} bukan pemilik target Marketing aktif. Perbaiki User Master sebelum publish.`);
    children.get(parent)!.push(id);
  }
  const annual = new Map<string, { NB: number; RN: number }>();
  const visiting = new Set<string>();
  const calculate = (id: string): { NB: number; RN: number } => {
    if (annual.has(id)) return annual.get(id)!;
    if (visiting.has(id)) throw new Error(`Siklus struktur atasan terdeteksi pada ${id}.`);
    visiting.add(id);
    const own = amounts.get(id)!;
    const descendants = children.get(id)!.map(calculate);
    const total = {
      NB: safeSum([safeSum(own.NB, `${id} NB`), ...descendants.map(row => row.NB)], `${id} tahunan NB`),
      RN: safeSum([safeSum(own.RN, `${id} RN`), ...descendants.map(row => row.RN)], `${id} tahunan RN`),
    };
    safeSum([total.NB, total.RN], `${id} tahunan total`);
    annual.set(id, total);
    visiting.delete(id);
    return total;
  };
  holders.forEach(user => calculate(idOf(user.id)));
  const director = holders.find(user => user.role === 'DIRECTOR_MARKETING');
  if (!director) throw new Error('Direktur Marketing aktif tidak ditemukan.');
  const reachable = new Set<string>();
  const walk = (id: string) => { if (reachable.has(id)) return; reachable.add(id); children.get(id)!.forEach(walk); };
  walk(idOf(director.id));
  if (reachable.size !== holders.length) throw new Error('Ada pemilik target yang tidak terhubung ke struktur Direktur Marketing.');

  return holders.map(user => {
    const id = idOf(user.id);
    const own = amounts.get(id)!;
    const total = annual.get(id)!;
    const personalNB = safeSum(own.NB, `${id} pribadi NB`);
    const personalRN = safeSum(own.RN, `${id} pribadi RN`);
    const output: TargetSpreadsheetRow = {
      Tahun: String(year), 'User ID Penerima': id, 'Nama Penerima': user.name,
      Jabatan: user.position || '', 'Department Umum': user.unit || '', 'Department Sub': user.department || '',
      'Target Tahunan': String(safeSum([total.NB, total.RN], `${id} total`)),
      'Target Tahunan NB': String(total.NB), 'Target Tahunan RN': String(total.RN),
      'Target Pribadi': String(safeSum([personalNB, personalRN], `${id} pribadi`)),
      'Target Pribadi NB': String(personalNB), 'Target Pribadi RN': String(personalRN),
      Catatan: [...own.notes].join(' | '),
    };
    MONTHS.forEach((month, index) => { output[`${month} NB`] = String(own.NB[index]); output[`${month} RN`] = String(own.RN[index]); });
    return output;
  });
};

/** The legacy 37-column format stays readable. Incomplete compact headers must not fall back to it. */
export const normalizeTargetUploadRows = (
  rows: TargetSpreadsheetRow[], users: CompactTargetUser[], year: number
): TargetSpreadsheetRow[] => {
  if (!rows.length) return rows;
  if (isCompactTargetRows(rows)) return expandCompactTargetRows(rows, users, year);
  const keys = new Set(Object.keys(rows[0]).map(headerOf));
  const required = ['Tahun','User ID Penerima','Target Tahunan','Target Tahunan NB','Target Tahunan RN','Target Pribadi','Target Pribadi NB','Target Pribadi RN'];
  const missing = required.filter(header => !keys.has(headerOf(header)));
  if (missing.length) throw new Error(`Kolom wajib format lama tidak ditemukan: ${missing.join(', ')}.`);
  return rows;
};
