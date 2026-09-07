import type { User } from '@/types';
import type ExcelJS from 'exceljs';

export type SpreadsheetRow = Record<string, string>;
export type MarketingTemplateKind = 'target' | 'pipeline' | 'production';

export const MARKETING_SHEETS = {
  target: 'Data Target',
  pipeline: 'Data Pipeline',
  production: 'Data Realisasi',
} as const;

export const USER_DIRECTORY_SHEET = 'Daftar User ID';
export const SPREADSHEET_ACCEPT = '.xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv';

const TARGET_ROLES = new Set([
  'DIRECTOR_MARKETING', 'ADVISOR_MARKETING_DIRECTOR',
  'VP_CAPTIVE_MARKETING', 'VP_CORPORATE_RETAIL_MARKETING',
  'DEPARTMENT_HEAD_MARKETING', 'SUPERVISOR_MARKETING', 'STAFF_MARKETING',
]);
const PRODUCTION_UNITS = new Set(['Captive Marketing', 'Corporate & Retail Marketing']);

export const normalizeMarketingUserId = (value: unknown): string =>
  String(value ?? '').replace(/\u00A0/g, ' ').replace(/[\u200B-\u200D\u2060]/g, '').trim().toUpperCase();

export const normalizeMarketingText = (value: unknown): string =>
  String(value ?? '').replace(/\u00A0/g, ' ').replace(/[\u200B-\u200D\u2060]/g, '').trim().replace(/\s+/g, ' ').toLowerCase();

export const normalizeMarketingHeader = (value: unknown): string =>
  normalizeMarketingText(value).replace(/[^a-z0-9]/g, '');

export const normalizeMarketingUnit = (value: unknown): string => {
  const unit = normalizeMarketingText(value);
  if (/^captive (i|ii|iii)$/.test(unit)) return 'Captive Marketing';
  if (/^crm (i|ii|iii)$/.test(unit)) return 'Corporate & Retail Marketing';
  if (unit === 'captive marketing') return 'Captive Marketing';
  if (unit === 'corporate & retail marketing' || unit === 'corporate retail marketing') return 'Corporate & Retail Marketing';
  return String(value ?? '').trim();
};

export interface OwnerResolution {
  user?: User;
  errors: string[];
  warnings: string[];
}

/** The current central user directory is authoritative; display names never choose an owner. */
export const resolveMarketingOwner = (
  rawId: unknown,
  users: User[],
  options: { unit?: string; name?: string; production?: boolean } = {}
): OwnerResolution => {
  const id = normalizeMarketingUserId(rawId);
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!/^USR-\d{6}$/.test(id)) {
    return { errors: ['User ID wajib diisi dengan format USR-000000 yang terdaftar di User Master.'], warnings };
  }
  const matches = users.filter(user => normalizeMarketingUserId(user.id) === id);
  if (matches.length !== 1) {
    return { errors: [`User ID ${id} tidak ditemukan secara unik di User Master pusat.`], warnings };
  }
  const user = matches[0];
  if (user.status !== 'Active') errors.push(`User ID ${id} tidak aktif.`);
  if (!TARGET_ROLES.has(user.role)) errors.push(`User ID ${id} bukan pemilik target/pipeline Marketing yang berwenang.`);
  if (options.production && !PRODUCTION_UNITS.has(normalizeMarketingUnit(user.unit))) {
    errors.push(`User ID ${id} bukan pemilik realisasi Captive Marketing atau Corporate & Retail Marketing.`);
  }
  if (options.unit && normalizeMarketingUnit(options.unit) !== normalizeMarketingUnit(user.unit)) {
    errors.push(`Fungsi Marketing tidak sesuai User ID ${id}. Seharusnya ${user.unit}.`);
  }
  if (options.name && normalizeMarketingText(options.name) !== normalizeMarketingText(user.name)) {
    warnings.push(`Nama PIC berbeda dari User Master. Pemilik resmi ${user.name} (${id}); nama pada file tidak digunakan untuk lookup.`);
  }
  return { user: errors.length === 0 ? user : undefined, errors, warnings };
};

export const getMarketingDirectoryRows = (users: User[]): SpreadsheetRow[] => {
  const eligible = users.filter(user =>
    /^USR-\d{6}$/.test(normalizeMarketingUserId(user.id)) &&
    user.role !== 'SYSTEM_ADMIN' && user.unit !== 'Administrasi Sistem'
  );
  const ids = new Set<string>();
  for (const user of eligible) {
    const id = normalizeMarketingUserId(user.id);
    if (ids.has(id)) throw new Error(`User Master memiliki User ID duplikat: ${id}. Template tidak dapat dibuat.`);
    ids.add(id);
  }
  return eligible.sort((a, b) => a.id.localeCompare(b.id)).map(user => ({
    'User ID': normalizeMarketingUserId(user.id),
    Nama: user.name,
    Jabatan: user.position,
    Unit: user.unit,
    Department: user.department,
    Status: user.status,
  }));
};

export const getMarketingTemplateHeaders = (kind: MarketingTemplateKind): string[] => {
  if (kind === 'production') return [
    'Tahun Produksi', 'Bulan Produksi', 'Nomor Polis', 'Nama Nasabah',
    'Nama Produk', 'Realisasi Produksi (Rp)', 'Fungsi Marketing', 'Jenis Bisnis',
    'User ID Pemilik Realisasi', 'PIC Marketing',
  ];
  if (kind === 'pipeline') return [
    'Tahun', 'Bulan Pipeline', 'Jenis Bisnis', 'Jenis Asuransi', 'Kategori Nasabah',
    'Produk', 'Nama Calon Nasabah', 'Estimasi Premi', 'Target Closing',
    'Metode Pengadaan', 'Distribution Channel', 'PIC User ID', 'PIC Marketing',
    'Unit', 'Department', 'Direct Superior', 'Catatan', 'Existing Policy Number',
    'Original Policy Year', 'Coverage Start', 'Coverage End', 'Renewal Type',
  ];
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  return [
    'Tahun', 'User ID Penerima', 'Nama Penerima', 'Jabatan', 'Department Umum',
    'Department Sub', 'Target Tahunan', 'Target Tahunan NB', 'Target Tahunan RN',
    'Target Pribadi', 'Target Pribadi NB', 'Target Pribadi RN',
    ...months.flatMap(month => [`${month} NB`, `${month} RN`]), 'Catatan',
  ];
};

const loadExcelJS = async () => (await import('exceljs')).default;

const getCellText = (value: ExcelJS.CellValue): string => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new Error('Tanggal Excel tidak valid.');
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Angka Excel tidak valid.');
    return String(value);
  }
  if (typeof value === 'string' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    if ('formula' in value || 'sharedFormula' in value) {
      const result = value.result;
      if (result === undefined || result === null || typeof result === 'object') {
        throw new Error('Sel formula tidak memiliki hasil tersimpan yang valid. Simpan ulang file setelah perhitungan Excel selesai.');
      }
      return getCellText(result);
    }
    if ('error' in value) throw new Error(`Sel Excel berisi error: ${value.error}`);
    if ('richText' in value) return value.richText.map(part => part.text).join('');
    if ('text' in value) return value.text;
    if ('hyperlink' in value) return value.text;
  }
  throw new Error('Tipe sel Excel tidak didukung untuk data upload.');
};

/** Actual OOXML parsing. Only the named data sheet is imported, never the directory sheet. */
export const readNativeXlsxRows = async (
  binary: ArrayBuffer | Uint8Array,
  options: { sheetName?: string; requiredHeaders?: string[] } = {}
): Promise<SpreadsheetRow[]> => {
  const Excel = await loadExcelJS();
  const workbook = new Excel.Workbook();
  await workbook.xlsx.load(new Uint8Array(binary instanceof Uint8Array ? binary : binary) as Parameters<typeof workbook.xlsx.load>[0]);
  const sheet = options.sheetName ? workbook.getWorksheet(options.sheetName) : workbook.worksheets[0];
  if (!sheet) throw new Error(`Sheet data ${options.sheetName || 'pertama'} tidak ditemukan. Gunakan template XLSX terbaru.`);
  if (sheet.rowCount < 1) return [];
  const headerRow = sheet.getRow(1);
  const headers = Array.from({ length: headerRow.cellCount }, (_, index) => getCellText(headerRow.getCell(index + 1).value).trim());
  const normalized = headers.filter(Boolean).map(normalizeMarketingHeader);
  if (new Set(normalized).size !== normalized.length) throw new Error('Header Excel memiliki nama kolom duplikat.');
  const required = options.requiredHeaders || [];
  const missing = required.filter(header => !normalized.includes(normalizeMarketingHeader(header)));
  if (missing.length) throw new Error(`Kolom wajib tidak ditemukan: ${missing.join(', ')}.`);
  const result: SpreadsheetRow[] = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const record: SpreadsheetRow = {};
    headers.forEach((header, index) => {
      if (!header) return;
      try {
        record[header] = getCellText(row.getCell(index + 1).value).replace(/\u00A0/g, ' ').replace(/[\u200B-\u200D\u2060]/g, '').trim();
      } catch (error) {
        throw new Error(`Sheet ${sheet.name}, baris ${rowNumber}, kolom ${header}: ${error instanceof Error ? error.message : 'Nilai tidak valid.'}`);
      }
    });
    if (Object.values(record).some(value => value !== '')) result.push(record);
  }
  return result;
};

export const readMarketingSpreadsheet = async (
  file: File,
  options: { sheetName?: string; requiredHeaders?: string[] } = {}
): Promise<SpreadsheetRow[]> => {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (file.size > 15 * 1024 * 1024) throw new Error('Ukuran file maksimal 15 MB.');
  if (extension === 'xlsx') return readNativeXlsxRows(await file.arrayBuffer(), options);
  if (extension !== 'csv') throw new Error('Gunakan file XLSX asli atau CSV. Format XLS lama dan file yang hanya diganti ekstensinya tidak didukung.');
  // Reuse the existing locale-aware CSV parser without changing unrelated exports.
  const { parseExcelOrCsvFile } = await import('./excelExport');
  const rows = await parseExcelOrCsvFile(file);
  const normalized = rows.length ? Object.keys(rows[0]).map(normalizeMarketingHeader) : [];
  const missing = (options.requiredHeaders || []).filter(header => !normalized.includes(normalizeMarketingHeader(header)));
  if (missing.length) throw new Error(`Kolom wajib tidak ditemukan: ${missing.join(', ')}.`);
  return rows;
};

export const buildMarketingWorkbook = async (
  kind: MarketingTemplateKind,
  rows: SpreadsheetRow[],
  users: User[]
): Promise<Uint8Array> => {
  const directory = getMarketingDirectoryRows(users);
  if (!directory.length) throw new Error('User Master pusat belum tersedia. Template tidak dapat dibuat.');
  const Excel = await loadExcelJS();
  const workbook = new Excel.Workbook();
  workbook.creator = 'PertaLife Marketing Dashboard';
  workbook.created = new Date();
  const headers = getMarketingTemplateHeaders(kind);
  const sheet = workbook.addWorksheet(MARKETING_SHEETS[kind], { views: [{ state: 'frozen', ySplit: 1 }] });
  const directorySheet = workbook.addWorksheet(USER_DIRECTORY_SHEET, { views: [{ state: 'frozen', ySplit: 1 }] });
  const headerStyle = (row: ExcelJS.Row) => {
    row.height = 28;
    row.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF163C72' } };
      cell.alignment = { vertical: 'middle', wrapText: true };
    });
  };
  sheet.addRow(headers);
  headerStyle(sheet.getRow(1));
  sheet.columns = headers.map(header => ({ key: header, width: /Nama|Catatan|Produk|Department|Fungsi/.test(header) ? 28 : 20 }));
  // Preserve exact existing header order and values. No fabricated transactions.
  rows.forEach(row => sheet.addRow(headers.map(header => row[header] ?? '')));
  const dataEnd = Math.max(rows.length + 1, 2);
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: dataEnd, column: headers.length } };
  sheet.getColumn(headers.findIndex(header => /User ID/.test(header)) + 1).numFmt = '@';
  directorySheet.addRow(['User ID', 'Nama', 'Jabatan', 'Unit', 'Department', 'Status']);
  headerStyle(directorySheet.getRow(1));
  directorySheet.columns = [18, 36, 34, 32, 28, 16].map(width => ({ width }));
  directory.forEach(row => directorySheet.addRow(Object.values(row)));
  directorySheet.getColumn(1).numFmt = '@';
  directorySheet.autoFilter = { from: 'A1', to: `F${directory.length + 1}` };
  // A named range makes the ID picker valid across worksheets in desktop Excel.
  workbook.definedNames.add(`'${USER_DIRECTORY_SHEET}'!$A$2:$A$${directory.length + 1}`, 'MarketingUserIDs');
  const ownerColumn = kind === 'production' ? 9 : kind === 'pipeline' ? 12 : 2;
  for (let rowNumber = 2; rowNumber <= Math.max(1001, dataEnd); rowNumber += 1) {
    sheet.getCell(rowNumber, ownerColumn).dataValidation = {
      type: 'list', allowBlank: kind !== 'target', formulae: ['MarketingUserIDs'],
      showErrorMessage: true, errorTitle: 'User ID tidak valid', error: 'Pilih User ID dari Daftar User ID.',
    };
  }
  const moneyHeaders = kind === 'production' ? ['Realisasi Produksi (Rp)'] : kind === 'pipeline' ? ['Estimasi Premi'] : headers.filter(header => header.startsWith('Target ') || / (NB|RN)$/.test(header));
  moneyHeaders.forEach(header => { const column = sheet.getColumn(headers.indexOf(header) + 1); column.numFmt = '#,##0;[Red](#,##0)'; });
  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
};

export const downloadMarketingWorkbook = async (
  kind: MarketingTemplateKind,
  rows: SpreadsheetRow[],
  users: User[],
  filename: string
): Promise<void> => {
  const binary = await buildMarketingWorkbook(kind, rows, users);
  const blob = new Blob([binary as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${filename.replace(/\.(xlsx|csv)$/i, '')}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};
