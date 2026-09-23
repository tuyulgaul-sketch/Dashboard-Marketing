import type { TargetEntry, User } from '@/types';
import { COMPACT_TARGET_HEADERS, LEGACY_TARGET_HEADERS } from './targetCompact';
import type ExcelJS from 'exceljs';

export type SpreadsheetRow = Record<string, string>;
export type MarketingTemplateRow = Record<string, string | number | boolean | null | undefined>;
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
export type MarketingProductionFunction = 'Captive Marketing' | 'Corporate & Retail Marketing' | 'Advisor';
const PRODUCTION_UNITS = new Set<MarketingProductionFunction>(['Captive Marketing', 'Corporate & Retail Marketing', 'Advisor']);

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
  if (unit === 'advisor' || unit === 'advisor pemasaran' || unit === 'advisor marketing' || unit === 'advisor to direktur pemasaran') return 'Advisor';
  if (unit === 'captive marketing') return 'Captive Marketing';
  if (unit === 'corporate & retail marketing' || unit === 'corporate retail marketing') return 'Corporate & Retail Marketing';
  return String(value ?? '').trim();
};

export const normalizeMarketingFunction = (value: unknown): MarketingProductionFunction | null => {
  const normalized = normalizeMarketingUnit(value);
  if (PRODUCTION_UNITS.has(normalized as MarketingProductionFunction)) return normalized as MarketingProductionFunction;
  return null;
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
  const reportingUnit = user.role === 'ADVISOR_MARKETING_DIRECTOR' ? 'Advisor' : normalizeMarketingUnit(user.unit);
  if (options.production && !PRODUCTION_UNITS.has(reportingUnit as MarketingProductionFunction)) {
    errors.push(`User ID ${id} bukan pemilik realisasi Captive Marketing, Corporate & Retail Marketing, atau Advisor.`);
  }
  if (options.unit && normalizeMarketingUnit(options.unit) !== reportingUnit) {
    errors.push(`Fungsi Marketing tidak sesuai User ID ${id}. Seharusnya ${reportingUnit}.`);
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
  return [...COMPACT_TARGET_HEADERS];
};

const loadExcelJS = async () => (await import('exceljs')).default;

export interface SpreadsheetReadOptions {
  sheetName?: string;
  requiredHeaders?: string[];
  /** 1-based worksheet row containing the column headers. Defaults to row 1. */
  headerRow?: number;
  /** Read at most this many rows immediately below headerRow. */
  dataRowCount?: number;
  /** Formula-derived columns that may be rebuilt by domain logic when Excel omitted the cached result. */
  allowFormulaWithoutResultHeaders?: string[];
}

const getCellText = (value: ExcelJS.CellValue, allowFormulaWithoutResult = false): string => {
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
      if (result === undefined || result === null || (typeof result === 'object' && !(result instanceof Date))) {
        if (allowFormulaWithoutResult) return '';
        throw new Error('Sel formula tidak memiliki hasil tersimpan yang valid. Simpan ulang file setelah perhitungan Excel selesai.');
      }
      return getCellText(result, allowFormulaWithoutResult);
    }
    if ('error' in value) throw new Error(`Sel Excel berisi error: ${value.error}`);
    if ('richText' in value) return value.richText.map(part => part.text).join('');
    if ('text' in value) return value.text;
  }
  throw new Error('Tipe sel Excel tidak didukung untuk data upload.');
};

/** Actual OOXML parsing. Only the named data sheet is imported, never the directory sheet. */
export const readNativeXlsxRows = async (
  binary: ArrayBuffer | Uint8Array,
  options: SpreadsheetReadOptions = {}
): Promise<SpreadsheetRow[]> => {
  const Excel = await loadExcelJS();
  const workbook = new Excel.Workbook();
  await workbook.xlsx.load(new Uint8Array(binary) as Parameters<typeof workbook.xlsx.load>[0]);
  const sheet = options.sheetName ? workbook.getWorksheet(options.sheetName) : workbook.worksheets[0];
  if (sheet && (sheet.rowCount > 100001 || sheet.columnCount > 200)) throw new Error('Workbook melebihi batas 100.000 baris data atau 200 kolom.');
  if (!sheet) throw new Error(`Sheet data ${options.sheetName || 'pertama'} tidak ditemukan. Gunakan template XLSX terbaru.`);
  if (sheet.rowCount < 1) return [];

  const headerRowNumber = options.headerRow ?? 1;
  if (!Number.isInteger(headerRowNumber) || headerRowNumber < 1 || headerRowNumber > sheet.rowCount) {
    throw new Error(`Baris header ${headerRowNumber} tidak valid untuk sheet ${sheet.name}.`);
  }
  if (options.dataRowCount !== undefined && (!Number.isInteger(options.dataRowCount) || options.dataRowCount < 0)) {
    throw new Error('Jumlah baris data XLSX tidak valid.');
  }

  const headerRow = sheet.getRow(headerRowNumber);
  const headers = Array.from({ length: headerRow.cellCount }, (_, index) => getCellText(headerRow.getCell(index + 1).value).trim());
  const normalized = headers.filter(Boolean).map(normalizeMarketingHeader);
  if (new Set(normalized).size !== normalized.length) throw new Error('Header Excel memiliki nama kolom duplikat.');
  const required = options.requiredHeaders || [];
  const missing = required.filter(header => !normalized.includes(normalizeMarketingHeader(header)));
  if (missing.length) throw new Error(`Kolom wajib tidak ditemukan: ${missing.join(', ')}.`);

  const formulaFallbackHeaders = new Set((options.allowFormulaWithoutResultHeaders || []).map(normalizeMarketingHeader));
  const result: SpreadsheetRow[] = [];
  const firstDataRow = headerRowNumber + 1;
  const lastDataRow = options.dataRowCount === undefined
    ? sheet.rowCount
    : Math.min(sheet.rowCount, headerRowNumber + options.dataRowCount);

  for (let rowNumber = firstDataRow; rowNumber <= lastDataRow; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const record: SpreadsheetRow = {};
    headers.forEach((header, index) => {
      if (!header) return;
      try {
        record[header] = getCellText(
          row.getCell(index + 1).value,
          formulaFallbackHeaders.has(normalizeMarketingHeader(header))
        ).replace(/\u00A0/g, ' ').replace(/[\u200B-\u200D\u2060]/g, '').trim();
      } catch (error) {
        throw new Error(`Sheet ${sheet.name}, baris ${rowNumber}, kolom ${header}: ${error instanceof Error ? error.message : 'Nilai tidak valid.'}`);
      }
    });
    if (Object.values(record).some(value => value !== '')) result.push(record);
  }
  return result;
};

export const PRODUCTION_MASTER_SHEET = 'RINCIAN PREMI';
export const PRODUCTION_MASTER_REQUIRED_HEADERS = [
  'Bulan Produksi', 'NO POLIS', 'PRODUK', 'GROSS PREMI',
  'DISTRIBUSI PEMASARAN', 'STATUS PREMI', 'USERID', 'USERNAME',
] as const;

export const PRODUCTION_MASTER_TEMPLATE_HEADERS = [
  'No.',
  'Bulan Produksi',
  'NO POLIS',
  'NAMA PEMEGANG POLIS',
  'PERUSAHAAN',
  'NO. NOTA',
  'PRODUK',
  'GROSS PREMI',
  'DISTRIBUSI PEMASARAN',
  'STATUS PREMI',
  'USERID',
  'USERNAME',
] as const;

const getCompatibilityRowValue = (row: SpreadsheetRow, ...aliases: string[]): string => {
  for (const alias of aliases) {
    const key = Object.keys(row).find(candidate => normalizeMarketingHeader(candidate) === normalizeMarketingHeader(alias));
    if (key) return String(row[key] ?? '').trim();
  }
  return '';
};

const mapProductionMasterRows = (rows: SpreadsheetRow[]): SpreadsheetRow[] => rows.map((row, index) => {
  const rawPeriod = getCompatibilityRowValue(row, 'Bulan Produksi');
  const periodMatch = /^(\\d{4})\\s*[\\/-]\\s*0*(\\d{1,3})$/.exec(rawPeriod);
  const productionYear = periodMatch ? Number(periodMatch[1]) : Number.NaN;
  const productionMonth = periodMatch ? Number(periodMatch[2]) : Number.NaN;
  if (!Number.isInteger(productionYear) || productionYear < 2000 || productionYear > 2100 ||
      !Number.isInteger(productionMonth) || productionMonth < 1 || productionMonth > 12) {
    throw new Error(`Sheet ${PRODUCTION_MASTER_SHEET}, baris ${index + 2}: Bulan Produksi "${rawPeriod}" tidak valid. Gunakan format YYYY/NNN, contoh 2026/001.`);
  }

  const company = getCompatibilityRowValue(row, 'PERUSAHAAN');
  const policyHolder = getCompatibilityRowValue(row, 'NAMA PEMEGANG POLIS');

  return {
    'Tahun Produksi': String(productionYear),
    'Bulan Produksi': String(productionMonth),
    'Nomor Polis': getCompatibilityRowValue(row, 'NO POLIS'),
    'Nama Nasabah': company || policyHolder,
    'Nomor Nota': getCompatibilityRowValue(row, 'NO. NOTA', 'NO NOTA'),
    'Nama Produk': getCompatibilityRowValue(row, 'PRODUK'),
    'Realisasi Produksi (Rp)': getCompatibilityRowValue(row, 'GROSS PREMI'),
    'Fungsi Marketing': getCompatibilityRowValue(row, 'DISTRIBUSI PEMASARAN'),
    'Jenis Bisnis': getCompatibilityRowValue(row, 'STATUS PREMI'),
    'User ID Pemilik Realisasi': getCompatibilityRowValue(row, 'USERID'),
    'PIC Marketing': getCompatibilityRowValue(row, 'USERNAME'),
  };
});

const readProductionXlsxCompatibility = async (
  binary: ArrayBuffer | Uint8Array,
  options: SpreadsheetReadOptions
): Promise<SpreadsheetRow[]> => {
  try {
    return await readNativeXlsxRows(binary, options);
  } catch (primaryError) {
    try {
      const masterRows = await readNativeXlsxRows(binary, {
        sheetName: PRODUCTION_MASTER_SHEET,
        requiredHeaders: [...PRODUCTION_MASTER_REQUIRED_HEADERS],
      });
      return mapProductionMasterRows(masterRows);
    } catch (masterError) {
      const primaryMessage = primaryError instanceof Error ? primaryError.message : 'format Data Realisasi tidak valid';
      const masterMessage = masterError instanceof Error ? masterError.message : 'format RINCIAN PREMI tidak valid';
      throw new Error(`File Realisasi tidak dikenali. Template Dashboard: ${primaryMessage}. Master RINCIAN PREMI: ${masterMessage}`);
    }
  }
};

export const readMarketingSpreadsheet = async (
  file: File,
  options: SpreadsheetReadOptions = {}
): Promise<SpreadsheetRow[]> => {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (file.size === 0) throw new Error('File kosong.');
  if (file.size > 15 * 1024 * 1024) throw new Error('Ukuran file maksimal 15 MB.');
  if (extension === 'xlsx') {
    const binary = await file.arrayBuffer();
    if (options.sheetName === MARKETING_SHEETS.production) {
      return readProductionXlsxCompatibility(binary, options);
    }
    return readNativeXlsxRows(binary, options);
  }
  if (extension !== 'csv') throw new Error('Gunakan file XLSX asli atau CSV. Format XLS lama dan file yang hanya diganti ekstensinya tidak didukung.');
  // Reuse the existing locale-aware CSV parser without changing unrelated exports.
  const { parseExcelOrCsvFile } = await import('./excelExport');
  const rows = await parseExcelOrCsvFile(file);
  const normalized = rows.length ? Object.keys(rows[0]).map(normalizeMarketingHeader) : [];
  const missing = (options.requiredHeaders || []).filter(header => !normalized.includes(normalizeMarketingHeader(header)));
  if (missing.length) throw new Error(`Kolom wajib tidak ditemukan: ${missing.join(', ')}.`);
  return rows;
};

/**
 * Target Direktorat in the official setup workbook is presentation-friendly:
 * title rows 1-2, headers on row 4, and exactly 12 monthly rows on 5-16.
 * Older upload files with headers on row 1 remain supported.
 */
export const readTargetDirectorateSpreadsheet = async (file: File): Promise<SpreadsheetRow[]> => {
  const requiredHeaders = ['Bulan', 'Target Direktorat NB', 'Target Direktorat RN'];
  const baseOptions: SpreadsheetReadOptions = {
    sheetName: TARGET_DIRECTORATE_SHEET,
    requiredHeaders,
    dataRowCount: 12,
    allowFormulaWithoutResultHeaders: ['Total'],
  };
  try {
    return await readMarketingSpreadsheet(file, { ...baseOptions, headerRow: 4 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (!/Kolom wajib tidak ditemukan/i.test(message)) throw error;
    return readMarketingSpreadsheet(file, { ...baseOptions, headerRow: 1 });
  }
};

export const buildProductionMasterWorkbook = async (
  rows: MarketingTemplateRow[],
  users: User[]
): Promise<Uint8Array> => {
  const productionUsers = users.filter(user => {
    if (
      user.status !== 'Active' ||
      !TARGET_ROLES.has(user.role) ||
      !/^USR-\d{6}$/.test(normalizeMarketingUserId(user.id))
    ) {
      return false;
    }
    const reportingUnit = user.role === 'ADVISOR_MARKETING_DIRECTOR'
      ? 'Advisor'
      : normalizeMarketingUnit(user.unit);
    return PRODUCTION_UNITS.has(reportingUnit as MarketingProductionFunction);
  });
  const directory = getMarketingDirectoryRows(productionUsers);
  if (!directory.length) throw new Error('User Master Realisasi belum tersedia. Template tidak dapat dibuat.');

  const Excel = await loadExcelJS();
  const workbook = new Excel.Workbook();
  workbook.creator = 'PertaLife Marketing Dashboard';
  workbook.created = new Date();

  const headers = [...PRODUCTION_MASTER_TEMPLATE_HEADERS];
  const sheet = workbook.addWorksheet(PRODUCTION_MASTER_SHEET, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  const directorySheet = workbook.addWorksheet(USER_DIRECTORY_SHEET, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

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
  const columnWidths = [8, 16, 20, 34, 34, 20, 32, 20, 32, 20, 18, 28];
  sheet.columns = columnWidths.map(width => ({ width }));

  rows.forEach((row, index) => {
    const year = String(row['Tahun Produksi'] ?? '').trim();
    const rawMonth = String(row['Bulan Produksi'] ?? '').trim();
    const normalizedPeriod = /^\d{4}\s*[\/-]\s*0*\d{1,3}$/.test(rawMonth)
      ? rawMonth
      : year && /^\d{1,2}$/.test(rawMonth)
        ? `${year}/${String(Number(rawMonth)).padStart(3, '0')}`
        : rawMonth;
    const rawBusiness = String(row['STATUS PREMI'] ?? row['Jenis Bisnis'] ?? '').trim();
    const normalizedBusiness = /^new\s*business$/i.test(rawBusiness)
      ? 'NEW BUSINESS'
      : /^(renewal|renewal\s*business)$/i.test(rawBusiness)
        ? 'RENEWAL'
        : rawBusiness;

    const masterRow: MarketingTemplateRow = {
      'No.': row['No.'] ?? (index + 1),
      'Bulan Produksi': normalizedPeriod,
      'NO POLIS': row['NO POLIS'] ?? row['Nomor Polis'] ?? '',
      'NAMA PEMEGANG POLIS': row['NAMA PEMEGANG POLIS'] ?? row['Nama Nasabah'] ?? '',
      'PERUSAHAAN': row['PERUSAHAAN'] ?? row['Nama Nasabah'] ?? '',
      'NO. NOTA': row['NO. NOTA'] ?? row['Nomor Nota'] ?? '',
      'PRODUK': row['PRODUK'] ?? row['Nama Produk'] ?? '',
      'GROSS PREMI': row['GROSS PREMI'] ?? row['Realisasi Produksi (Rp)'] ?? '',
      'DISTRIBUSI PEMASARAN': row['DISTRIBUSI PEMASARAN'] ?? row['Fungsi Marketing'] ?? '',
      'STATUS PREMI': normalizedBusiness,
      'USERID': row['USERID'] ?? row['User ID Pemilik Realisasi'] ?? '',
      'USERNAME': row['USERNAME'] ?? row['PIC Marketing'] ?? '',
    };
    sheet.addRow(headers.map(header => masterRow[header] ?? ''));
  });

  const dataEnd = Math.max(rows.length + 1, 2);
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: dataEnd, column: headers.length },
  };
  sheet.getColumn(2).numFmt = '@';
  sheet.getColumn(3).numFmt = '@';
  sheet.getColumn(6).numFmt = '@';
  sheet.getColumn(8).numFmt = '#,##0.########;[Red](#,##0.########)';
  sheet.getColumn(11).numFmt = '@';

  directorySheet.addRow(['User ID', 'Nama', 'Jabatan', 'Unit', 'Department', 'Status']);
  headerStyle(directorySheet.getRow(1));
  directorySheet.columns = [18, 36, 34, 32, 28, 16].map(width => ({ width }));
  directory.forEach(row => directorySheet.addRow(Object.values(row)));
  directorySheet.getColumn(1).numFmt = '@';
  directorySheet.autoFilter = { from: 'A1', to: `F${directory.length + 1}` };
  workbook.definedNames.add(
    `'${USER_DIRECTORY_SHEET}'!$A$2:$A${directory.length + 1}`,
    'MarketingUserIDs'
  );

  for (let rowNumber = 2; rowNumber <= Math.max(1001, dataEnd); rowNumber += 1) {
    sheet.getCell(rowNumber, 9).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: ['"CAPTIVE MARKETING,CORPORATE & RETAIL MARKETING,ADVISOR"'],
      showErrorMessage: true,
      errorTitle: 'Distribusi pemasaran tidak valid',
      error: 'Pilih CAPTIVE MARKETING, CORPORATE & RETAIL MARKETING, atau ADVISOR.',
    };
    sheet.getCell(rowNumber, 10).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: ['"NEW BUSINESS,RENEWAL"'],
      showErrorMessage: true,
      errorTitle: 'Status premi tidak valid',
      error: 'Pilih NEW BUSINESS atau RENEWAL.',
    };
    sheet.getCell(rowNumber, 11).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: ['MarketingUserIDs'],
      showErrorMessage: true,
      errorTitle: 'User ID tidak valid',
      error: 'Pilih User ID dari User Master.',
    };
  }

  // Helper directory is kept inside the workbook for validation but hidden
  // so the visible upload template stays focused on the RINCIAN PREMI master.
  directorySheet.state = 'veryHidden';

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
};

export const buildMarketingWorkbook = async (
  kind: MarketingTemplateKind,
  rows: MarketingTemplateRow[],
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
  if (kind === 'target') {
    [12, 22, 12, 12, 24].forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
    sheet.getColumn(1).numFmt = '0';
    sheet.getColumn(3).numFmt = '0';
    for (let rowNumber = 2; rowNumber <= Math.max(1001, dataEnd); rowNumber += 1) {
      sheet.getCell(rowNumber, 3).dataValidation = {
        type: 'list', allowBlank: false, formulae: ['"1,2,3,4,5,6,7,8,9,10,11,12"'],
        showErrorMessage: true, errorTitle: 'Periode tidak valid', error: 'Pilih bulan 1 sampai 12.',
      };
      sheet.getCell(rowNumber, 4).dataValidation = {
        type: 'list', allowBlank: false, formulae: ['"NB,RN"'],
        showErrorMessage: true, errorTitle: 'Jenis bisnis tidak valid', error: 'Pilih NB atau RN.',
      };
    }
  }
  const moneyHeaders = kind === 'production' ? ['Realisasi Produksi (Rp)'] : kind === 'pipeline' ? ['Estimasi Premi'] : headers.filter(header => header.startsWith('Target ') || / (NB|RN)$/.test(header));
  moneyHeaders.forEach(header => { const column = sheet.getColumn(headers.indexOf(header) + 1); column.numFmt = '#,##0;[Red](#,##0)'; });
  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
};


export const TARGET_DIRECTORATE_SHEET = 'Target Direktorat';
export const TARGET_VALIDATION_SHEET = 'Ringkasan Validasi';
export const TARGET_RECONCILIATION_SHEET = 'Rekonsiliasi Bulanan';
export const TARGET_VALIDATION_ENGINE_SHEET = 'Mesin Validasi';
export const TARGET_GUIDE_SHEET = 'Petunjuk';

const TARGET_MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
] as const;

const TARGET_ROLE_ORDER: Record<string, number> = {
  DIRECTOR_MARKETING: 0,
  ADVISOR_MARKETING_DIRECTOR: 1,
  VP_CAPTIVE_MARKETING: 2,
  VP_CORPORATE_RETAIL_MARKETING: 3,
  DEPARTMENT_HEAD_MARKETING: 4,
  SUPERVISOR_MARKETING: 5,
  STAFF_MARKETING: 6,
};

const targetSetupUsersInHierarchyOrder = (users: User[]): User[] => {
  const holders = users.filter(user =>
    user.status === 'Active' &&
    TARGET_ROLES.has(user.role) &&
    /^USR-\d{6}$/.test(normalizeMarketingUserId(user.id))
  );
  const directors = holders.filter(user => user.role === 'DIRECTOR_MARKETING');
  if (directors.length !== 1) throw new Error('Template target membutuhkan tepat satu Direktur Marketing aktif.');
  const byId = new Map(holders.map(user => [normalizeMarketingUserId(user.id), user]));
  const children = new Map<string, User[]>();
  holders.forEach(user => children.set(normalizeMarketingUserId(user.id), []));
  for (const user of holders) {
    const id = normalizeMarketingUserId(user.id);
    if (user.role === 'DIRECTOR_MARKETING') continue;
    const parentId = normalizeMarketingUserId(user.superiorId);
    if (!parentId || !byId.has(parentId)) throw new Error(`Atasan ${user.name} (${id}) belum terhubung ke pemilik target aktif.`);
    children.get(parentId)!.push(user);
  }
  children.forEach(list => list.sort((a, b) =>
    (TARGET_ROLE_ORDER[a.role] ?? 99) - (TARGET_ROLE_ORDER[b.role] ?? 99) ||
    String(a.department || '').localeCompare(String(b.department || ''), 'id') ||
    a.name.localeCompare(b.name, 'id')
  ));
  const ordered: User[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const walk = (user: User) => {
    const id = normalizeMarketingUserId(user.id);
    if (visiting.has(id)) throw new Error(`Siklus struktur atasan terdeteksi pada ${id}.`);
    if (visited.has(id)) return;
    visiting.add(id);
    ordered.push(user);
    for (const child of children.get(id) || []) walk(child);
    visiting.delete(id);
    visited.add(id);
  };
  walk(directors[0]);
  if (visited.size !== holders.length) throw new Error('Ada pemilik target yang tidak terhubung ke Direktur Marketing.');
  return ordered;
};

const excelColumnName = (index: number): string => {
  let value = index;
  let result = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
};

const numericTarget = (value: unknown): number => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : 0;
};

export const buildTargetSetupWorkbook = async (
  users: User[],
  year: number,
  existingTargets: TargetEntry[] = []
): Promise<Uint8Array> => {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error('Tahun target tidak valid.');
  const holders = targetSetupUsersInHierarchyOrder(users);
  const Excel = await loadExcelJS();
  const workbook = new Excel.Workbook();
  workbook.creator = 'PertaLife Marketing Dashboard';
  workbook.created = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;
  workbook.calcProperties.forceFullCalc = true;

  const headerStyle = (row: ExcelJS.Row) => {
    row.height = 28;
    row.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF163C72' } };
      cell.alignment = { vertical: 'middle', wrapText: true };
    });
  };
  const inputFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
  const formulaFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
  const goodFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EAD3' } };
  const badFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4CCCC' } };
  const moneyFormat = '#,##0;[Red](#,##0)';

  const dataSheet = workbook.addWorksheet(MARKETING_SHEETS.target, { views: [{ state: 'frozen', ySplit: 1, xSplit: 2 }] });
  dataSheet.addRow([...LEGACY_TARGET_HEADERS]);
  headerStyle(dataSheet.getRow(1));
  dataSheet.autoFilter = { from: 'A1', to: `AK${holders.length + 1}` };
  const rowById = new Map<string, number>();
  const existingById = new Map(existingTargets.filter(row => row.year === year).map(row => [normalizeMarketingUserId(row.userId), row]));
  holders.forEach((user, index) => rowById.set(normalizeMarketingUserId(user.id), index + 2));

  const children = new Map<string, string[]>();
  holders.forEach(user => children.set(normalizeMarketingUserId(user.id), []));
  holders.forEach(user => {
    const parent = normalizeMarketingUserId(user.superiorId);
    if (parent && children.has(parent)) children.get(parent)!.push(normalizeMarketingUserId(user.id));
  });

  const personalCache = new Map<string, { NB: number; RN: number; monthlyNB: number[]; monthlyRN: number[] }>();
  holders.forEach(user => {
    const id = normalizeMarketingUserId(user.id);
    const existing = existingById.get(id);
    const monthlyNB = Array.from({ length: 12 }, (_, i) => numericTarget(existing?.monthlyNewBusiness?.[i]));
    const monthlyRN = Array.from({ length: 12 }, (_, i) => numericTarget(existing?.monthlyRenewal?.[i]));
    personalCache.set(id, {
      NB: monthlyNB.reduce((sum, value) => sum + value, 0),
      RN: monthlyRN.reduce((sum, value) => sum + value, 0),
      monthlyNB,
      monthlyRN,
    });
  });
  const teamCache = new Map<string, { NB: number; RN: number }>();
  const teamOf = (id: string): { NB: number; RN: number } => {
    const cached = teamCache.get(id);
    if (cached) return cached;
    const personal = personalCache.get(id)!;
    const total = (children.get(id) || []).reduce((sum, child) => {
      const childTotal = teamOf(child);
      return { NB: sum.NB + childTotal.NB, RN: sum.RN + childTotal.RN };
    }, { NB: personal.NB, RN: personal.RN });
    teamCache.set(id, total);
    return total;
  };
  holders.forEach(user => teamOf(normalizeMarketingUserId(user.id)));

  holders.forEach(user => {
    const id = normalizeMarketingUserId(user.id);
    const rowNumber = rowById.get(id)!;
    const personal = personalCache.get(id)!;
    const team = teamCache.get(id)!;
    const existing = existingById.get(id);
    const row = dataSheet.getRow(rowNumber);
    row.values = [
      year, id, user.name, user.position, user.unit, user.department,
      team.NB + team.RN, team.NB, team.RN,
      personal.NB + personal.RN, personal.NB, personal.RN,
      ...TARGET_MONTHS.flatMap((_, monthIndex) => [personal.monthlyNB[monthIndex], personal.monthlyRN[monthIndex]]),
      existing?.notes || '',
    ];

    const nbMonthlyRefs = TARGET_MONTHS.map((_, monthIndex) => `${excelColumnName(13 + monthIndex * 2)}${rowNumber}`);
    const rnMonthlyRefs = TARGET_MONTHS.map((_, monthIndex) => `${excelColumnName(14 + monthIndex * 2)}${rowNumber}`);
    row.getCell(11).value = { formula: `SUM(${nbMonthlyRefs.join(',')})`, result: personal.NB };
    row.getCell(12).value = { formula: `SUM(${rnMonthlyRefs.join(',')})`, result: personal.RN };
    row.getCell(10).value = { formula: `K${rowNumber}+L${rowNumber}`, result: personal.NB + personal.RN };

    const childRows = (children.get(id) || []).map(childId => rowById.get(childId)!);
    const childNB = childRows.map(childRow => `H${childRow}`);
    const childRN = childRows.map(childRow => `I${childRow}`);
    row.getCell(8).value = {
      formula: childNB.length ? `K${rowNumber}+SUM(${childNB.join(',')})` : `K${rowNumber}`,
      result: team.NB,
    };
    row.getCell(9).value = {
      formula: childRN.length ? `L${rowNumber}+SUM(${childRN.join(',')})` : `L${rowNumber}`,
      result: team.RN,
    };
    row.getCell(7).value = { formula: `H${rowNumber}+I${rowNumber}`, result: team.NB + team.RN };

    for (let column = 7; column <= 12; column += 1) row.getCell(column).fill = formulaFill;
    for (let column = 13; column <= 36; column += 1) row.getCell(column).fill = inputFill;
    row.getCell(37).fill = inputFill;
    for (let column = 7; column <= 36; column += 1) row.getCell(column).numFmt = moneyFormat;
    row.getCell(2).numFmt = '@';
  });

  dataSheet.columns = LEGACY_TARGET_HEADERS.map(header => ({
    width: /Nama|Jabatan|Department|Catatan/.test(header) ? 28 : /Target/.test(header) ? 18 : /(Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)/.test(header) ? 14 : 16,
  }));
  dataSheet.getColumn(2).width = 18;
  dataSheet.getColumn(37).width = 42;
  dataSheet.getColumn(1).numFmt = '0';
  dataSheet.eachRow(row => { row.alignment = { vertical: 'middle', wrapText: true }; });

  const directorySheet = workbook.addWorksheet(USER_DIRECTORY_SHEET, { views: [{ state: 'frozen', ySplit: 1 }] });
  directorySheet.addRow(['User ID', 'Nama', 'Jabatan', 'Unit', 'Department', 'Atasan User ID', 'Atasan', 'Status']);
  headerStyle(directorySheet.getRow(1));
  holders.forEach(user => {
    const parentId = normalizeMarketingUserId(user.superiorId);
    const parent = holders.find(candidate => normalizeMarketingUserId(candidate.id) === parentId);
    directorySheet.addRow([normalizeMarketingUserId(user.id), user.name, user.position, user.unit, user.department, parentId, parent?.name || '', user.status]);
  });
  directorySheet.columns = [18, 34, 34, 30, 24, 18, 34, 14].map(width => ({ width }));
  directorySheet.getColumn(1).numFmt = '@';
  directorySheet.getColumn(6).numFmt = '@';
  directorySheet.autoFilter = { from: 'A1', to: `H${holders.length + 1}` };
  workbook.definedNames.add(`'${USER_DIRECTORY_SHEET}'!$A$2:$A$${holders.length + 1}`, 'MarketingUserIDs');
  for (let rowNumber = 2; rowNumber <= holders.length + 1; rowNumber += 1) {
    dataSheet.getCell(rowNumber, 2).dataValidation = {
      type: 'list', allowBlank: false, formulae: ['MarketingUserIDs'],
      showErrorMessage: true, errorTitle: 'User ID tidak valid', error: 'Pilih User ID dari Daftar User ID.',
    };
  }

  const directorSheet = workbook.addWorksheet(TARGET_DIRECTORATE_SHEET, { views: [{ state: 'frozen', ySplit: 4 }] });
  directorSheet.mergeCells('A1:D2');
  directorSheet.getCell('A1').value = 'TARGET DIREKTORAT BULANAN — ACUAN VALIDASI';
  directorSheet.getCell('A1').font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 15 };
  directorSheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17324D' } };
  directorSheet.getCell('A1').alignment = { vertical: 'middle' };
  directorSheet.addRow([]);
  directorSheet.getRow(4).values = ['Bulan', 'Target Direktorat NB', 'Target Direktorat RN', 'Total'];
  headerStyle(directorSheet.getRow(4));
  TARGET_MONTHS.forEach((month, index) => {
    const rowNumber = index + 5;
    const nb = holders.reduce((sum, user) => sum + personalCache.get(normalizeMarketingUserId(user.id))!.monthlyNB[index], 0);
    const rn = holders.reduce((sum, user) => sum + personalCache.get(normalizeMarketingUserId(user.id))!.monthlyRN[index], 0);
    directorSheet.getRow(rowNumber).values = [month, nb, rn, nb + rn];
    directorSheet.getCell(rowNumber, 2).fill = inputFill;
    directorSheet.getCell(rowNumber, 3).fill = inputFill;
    directorSheet.getCell(rowNumber, 4).value = { formula: `B${rowNumber}+C${rowNumber}`, result: nb + rn };
    directorSheet.getCell(rowNumber, 4).fill = formulaFill;
  });
  directorSheet.getRow(18).values = ['TAHUNAN', '', '', ''];
  const annualNB = holders.reduce((sum, user) => sum + personalCache.get(normalizeMarketingUserId(user.id))!.NB, 0);
  const annualRN = holders.reduce((sum, user) => sum + personalCache.get(normalizeMarketingUserId(user.id))!.RN, 0);
  directorSheet.getCell('B18').value = { formula: 'SUM(B5:B16)', result: annualNB };
  directorSheet.getCell('C18').value = { formula: 'SUM(C5:C16)', result: annualRN };
  directorSheet.getCell('D18').value = { formula: 'B18+C18', result: annualNB + annualRN };
  directorSheet.getRow(18).fill = goodFill;
  directorSheet.getRow(18).font = { bold: true };
  directorSheet.columns = [{ width: 18 }, { width: 24 }, { width: 24 }, { width: 24 }];
  directorSheet.getColumn(2).numFmt = moneyFormat;
  directorSheet.getColumn(3).numFmt = moneyFormat;
  directorSheet.getColumn(4).numFmt = moneyFormat;
  directorSheet.getCell('A20').value = 'Isi target Direktorat Januari–Desember pada kolom kuning. Ringkasan Validasi akan menunjukkan bulan dan user yang belum balance.';
  directorSheet.mergeCells('A20:D21');
  directorSheet.getCell('A20').alignment = { wrapText: true, vertical: 'top' };

  const engineSheet = workbook.addWorksheet(TARGET_VALIDATION_ENGINE_SHEET);
  engineSheet.addRow([
    'User ID', 'Nama', 'Atasan ID', 'Jumlah Baris Data',
    'Target Tahunan', 'Target Tahunan NB', 'Target Tahunan RN',
    'Target Pribadi', 'Target Pribadi NB', 'Target Pribadi RN',
    'Sum Bulanan NB', 'Sum Bulanan RN',
    'Target Bawahan', 'Target Bawahan NB', 'Target Bawahan RN',
    'Selisih Split Tahunan', 'Selisih Split Pribadi',
    'Selisih Cascading Total', 'Selisih Cascading NB', 'Selisih Cascading RN',
    'Selisih Bulanan NB', 'Selisih Bulanan RN', 'Status', 'Lokasi Error',
  ]);
  headerStyle(engineSheet.getRow(1));
  holders.forEach((user, index) => {
    const rowNumber = index + 2;
    const id = normalizeMarketingUserId(user.id);
    const parentId = normalizeMarketingUserId(user.superiorId);
    const dataRow = rowById.get(id)!;
    const personal = personalCache.get(id)!;
    const team = teamCache.get(id)!;
    const subordinate = (children.get(id) || []).reduce((sum, childId) => {
      const childTeam = teamCache.get(childId)!;
      return { NB: sum.NB + childTeam.NB, RN: sum.RN + childTeam.RN };
    }, { NB: 0, RN: 0 });
    const row = engineSheet.getRow(rowNumber);
    row.values = [id, user.name, parentId];
    row.getCell(4).value = { formula: `COUNTIF('${MARKETING_SHEETS.target}'!$B$2:$B$200,A${rowNumber})`, result: 1 };
    const sourceColumns = ['G', 'H', 'I', 'J', 'K', 'L'];
    const initialValues = [team.NB + team.RN, team.NB, team.RN, personal.NB + personal.RN, personal.NB, personal.RN];
    sourceColumns.forEach((sourceColumn, i) => {
      row.getCell(5 + i).value = {
        formula: `SUMIF('${MARKETING_SHEETS.target}'!$B$2:$B$200,A${rowNumber},'${MARKETING_SHEETS.target}'!$${sourceColumn}$2:$${sourceColumn}$200)`,
        result: initialValues[i],
      };
    });
    const nbTerms = TARGET_MONTHS.map((_, monthIndex) => {
      const sourceColumn = excelColumnName(13 + monthIndex * 2);
      return `SUMIF('${MARKETING_SHEETS.target}'!$B$2:$B$200,A${rowNumber},'${MARKETING_SHEETS.target}'!$${sourceColumn}$2:$${sourceColumn}$200)`;
    });
    const rnTerms = TARGET_MONTHS.map((_, monthIndex) => {
      const sourceColumn = excelColumnName(14 + monthIndex * 2);
      return `SUMIF('${MARKETING_SHEETS.target}'!$B$2:$B$200,A${rowNumber},'${MARKETING_SHEETS.target}'!$${sourceColumn}$2:$${sourceColumn}$200)`;
    });
    row.getCell(11).value = { formula: nbTerms.join('+'), result: personal.NB };
    row.getCell(12).value = { formula: rnTerms.join('+'), result: personal.RN };
    row.getCell(13).value = { formula: `SUMIF($C$2:$C$${holders.length + 1},A${rowNumber},$E$2:$E$${holders.length + 1})`, result: subordinate.NB + subordinate.RN };
    row.getCell(14).value = { formula: `SUMIF($C$2:$C$${holders.length + 1},A${rowNumber},$F$2:$F$${holders.length + 1})`, result: subordinate.NB };
    row.getCell(15).value = { formula: `SUMIF($C$2:$C$${holders.length + 1},A${rowNumber},$G$2:$G$${holders.length + 1})`, result: subordinate.RN };
    row.getCell(16).value = { formula: `E${rowNumber}-(F${rowNumber}+G${rowNumber})`, result: 0 };
    row.getCell(17).value = { formula: `H${rowNumber}-(I${rowNumber}+J${rowNumber})`, result: 0 };
    row.getCell(18).value = { formula: `E${rowNumber}-(H${rowNumber}+M${rowNumber})`, result: 0 };
    row.getCell(19).value = { formula: `F${rowNumber}-(I${rowNumber}+N${rowNumber})`, result: 0 };
    row.getCell(20).value = { formula: `G${rowNumber}-(J${rowNumber}+O${rowNumber})`, result: 0 };
    row.getCell(21).value = { formula: `K${rowNumber}-I${rowNumber}`, result: 0 };
    row.getCell(22).value = { formula: `L${rowNumber}-J${rowNumber}`, result: 0 };
    row.getCell(23).value = { formula: `IF(AND(D${rowNumber}=1,P${rowNumber}=0,Q${rowNumber}=0,R${rowNumber}=0,S${rowNumber}=0,T${rowNumber}=0,U${rowNumber}=0,V${rowNumber}=0),"LOLOS","BELUM BALANCE")`, result: 'LOLOS' };
    row.getCell(24).value = {
      formula: `IF(D${rowNumber}<>1,"Baris User hilang/duplikat; ","")&IF(P${rowNumber}<>0,"Split Tahunan; ","")&IF(Q${rowNumber}<>0,"Split Pribadi; ","")&IF(R${rowNumber}<>0,"Cascading Total; ","")&IF(S${rowNumber}<>0,"Cascading NB; ","")&IF(T${rowNumber}<>0,"Cascading RN; ","")&IF(U${rowNumber}<>0,"Jumlah 12 Bulan NB; ","")&IF(V${rowNumber}<>0,"Jumlah 12 Bulan RN; ","")`,
      result: '',
    };
  });
  engineSheet.columns = Array.from({ length: 24 }, (_, index) => ({ width: index === 1 ? 30 : index === 23 ? 48 : 18 }));
  engineSheet.getColumn(1).numFmt = '@';
  engineSheet.state = 'veryHidden';

  const validationSheet = workbook.addWorksheet(TARGET_VALIDATION_SHEET, { views: [{ state: 'frozen', ySplit: 4 }] });
  validationSheet.mergeCells('A1:L2');
  validationSheet.getCell('A1').value = 'RINGKASAN VALIDASI SETUP TARGET';
  validationSheet.getCell('A1').font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 16 };
  validationSheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17324D' } };
  validationSheet.getCell('A1').alignment = { vertical: 'middle' };
  validationSheet.getRow(4).values = ['Indikator', 'Nilai', '', 'Bulan', 'Target Direktorat NB', 'Total Alokasi NB', 'Selisih NB', 'Status NB', 'Target Direktorat RN', 'Total Alokasi RN', 'Selisih RN', 'Status RN'];
  headerStyle(validationSheet.getRow(4));
  validationSheet.getCell('A5').value = 'Jumlah Pemegang Target';
  validationSheet.getCell('A6').value = 'User Belum Balance';
  validationSheet.getCell('A7').value = 'Bulan NB Belum Balance';
  validationSheet.getCell('A8').value = 'Bulan RN Belum Balance';
  validationSheet.getCell('B5').value = { formula: `COUNTA('${TARGET_VALIDATION_ENGINE_SHEET}'!$A$2:$A$${holders.length + 1})`, result: holders.length };
  validationSheet.getCell('B6').value = { formula: `COUNTIF('${TARGET_VALIDATION_ENGINE_SHEET}'!$W$2:$W$${holders.length + 1},"BELUM BALANCE")`, result: 0 };
  validationSheet.getCell('B7').value = { formula: 'COUNTIF(H5:H16,"BELUM BALANCE")', result: 0 };
  validationSheet.getCell('B8').value = { formula: 'COUNTIF(L5:L16,"BELUM BALANCE")', result: 0 };

  TARGET_MONTHS.forEach((month, index) => {
    const rowNumber = index + 5;
    const dataNBColumn = excelColumnName(13 + index * 2);
    const dataRNColumn = excelColumnName(14 + index * 2);
    const initialNB = holders.reduce((sum, user) => sum + personalCache.get(normalizeMarketingUserId(user.id))!.monthlyNB[index], 0);
    const initialRN = holders.reduce((sum, user) => sum + personalCache.get(normalizeMarketingUserId(user.id))!.monthlyRN[index], 0);
    validationSheet.getCell(rowNumber, 4).value = month;
    validationSheet.getCell(rowNumber, 5).value = { formula: `'${TARGET_DIRECTORATE_SHEET}'!B${rowNumber}`, result: initialNB };
    validationSheet.getCell(rowNumber, 6).value = { formula: `SUM('${MARKETING_SHEETS.target}'!$${dataNBColumn}$2:$${dataNBColumn}$200)`, result: initialNB };
    validationSheet.getCell(rowNumber, 7).value = { formula: `F${rowNumber}-E${rowNumber}`, result: 0 };
    validationSheet.getCell(rowNumber, 8).value = { formula: `IF(G${rowNumber}=0,"BALANCE","BELUM BALANCE")`, result: 'BALANCE' };
    validationSheet.getCell(rowNumber, 9).value = { formula: `'${TARGET_DIRECTORATE_SHEET}'!C${rowNumber}`, result: initialRN };
    validationSheet.getCell(rowNumber, 10).value = { formula: `SUM('${MARKETING_SHEETS.target}'!$${dataRNColumn}$2:$${dataRNColumn}$200)`, result: initialRN };
    validationSheet.getCell(rowNumber, 11).value = { formula: `J${rowNumber}-I${rowNumber}`, result: 0 };
    validationSheet.getCell(rowNumber, 12).value = { formula: `IF(K${rowNumber}=0,"BALANCE","BELUM BALANCE")`, result: 'BALANCE' };
  });
  validationSheet.getCell('A20').value = 'User ID';
  validationSheet.getCell('B20').value = 'Nama';
  validationSheet.getCell('C20').value = 'Atasan';
  validationSheet.getCell('D20').value = 'Status';
  validationSheet.getCell('E20').value = 'Lokasi Error';
  validationSheet.getCell('F20').value = 'Selisih Cascading Total';
  validationSheet.getCell('G20').value = 'Selisih Cascading NB';
  validationSheet.getCell('H20').value = 'Selisih Cascading RN';
  validationSheet.getCell('I20').value = 'Selisih 12 Bulan NB';
  validationSheet.getCell('J20').value = 'Selisih 12 Bulan RN';
  headerStyle(validationSheet.getRow(20));
  holders.forEach((user, index) => {
    const targetRow = index + 21;
    const engineRow = index + 2;
    validationSheet.getCell(targetRow, 1).value = { formula: `'${TARGET_VALIDATION_ENGINE_SHEET}'!A${engineRow}`, result: normalizeMarketingUserId(user.id) };
    validationSheet.getCell(targetRow, 2).value = { formula: `'${TARGET_VALIDATION_ENGINE_SHEET}'!B${engineRow}`, result: user.name };
    validationSheet.getCell(targetRow, 3).value = { formula: `'${TARGET_VALIDATION_ENGINE_SHEET}'!C${engineRow}`, result: normalizeMarketingUserId(user.superiorId) };
    validationSheet.getCell(targetRow, 4).value = { formula: `'${TARGET_VALIDATION_ENGINE_SHEET}'!W${engineRow}`, result: 'LOLOS' };
    validationSheet.getCell(targetRow, 5).value = { formula: `'${TARGET_VALIDATION_ENGINE_SHEET}'!X${engineRow}`, result: '' };
    ['R', 'S', 'T', 'U', 'V'].forEach((sourceColumn, offset) => {
      validationSheet.getCell(targetRow, 6 + offset).value = { formula: `'${TARGET_VALIDATION_ENGINE_SHEET}'!${sourceColumn}${engineRow}`, result: 0 };
    });
  });
  validationSheet.columns = [18, 28, 18, 18, 46, 22, 22, 22, 22, 22, 2, 2].map(width => ({ width }));
  [5, 6, 7, 9, 10, 11].forEach(column => { validationSheet.getColumn(column).numFmt = moneyFormat; });
  validationSheet.getColumn(6).numFmt = moneyFormat;
  validationSheet.getColumn(7).numFmt = moneyFormat;
  validationSheet.getColumn(8).numFmt = moneyFormat;
  validationSheet.getColumn(9).numFmt = moneyFormat;
  validationSheet.getColumn(10).numFmt = moneyFormat;
  validationSheet.addConditionalFormatting({ ref: `D21:D${holders.length + 20}`, rules: [
    { type: 'containsText', operator: 'containsText', text: 'LOLOS', formulae: ['NOT(ISERROR(SEARCH("LOLOS",D21)))'], style: { fill: goodFill } },
    { type: 'containsText', operator: 'containsText', text: 'BELUM BALANCE', formulae: ['NOT(ISERROR(SEARCH("BELUM BALANCE",D21)))'], style: { fill: badFill } },
  ] });
  validationSheet.addConditionalFormatting({ ref: 'H5:H16', rules: [
    { type: 'containsText', operator: 'containsText', text: 'BALANCE', formulae: ['NOT(ISERROR(SEARCH("BALANCE",H5)))'], style: { fill: goodFill } },
    { type: 'containsText', operator: 'containsText', text: 'BELUM BALANCE', formulae: ['NOT(ISERROR(SEARCH("BELUM BALANCE",H5)))'], style: { fill: badFill } },
  ] });
  validationSheet.addConditionalFormatting({ ref: 'L5:L16', rules: [
    { type: 'containsText', operator: 'containsText', text: 'BALANCE', formulae: ['NOT(ISERROR(SEARCH("BALANCE",L5)))'], style: { fill: goodFill } },
    { type: 'containsText', operator: 'containsText', text: 'BELUM BALANCE', formulae: ['NOT(ISERROR(SEARCH("BELUM BALANCE",L5)))'], style: { fill: badFill } },
  ] });

  const reconciliationSheet = workbook.addWorksheet(TARGET_RECONCILIATION_SHEET, { views: [{ state: 'frozen', ySplit: 4, xSplit: 2 }] });
  reconciliationSheet.mergeCells('A1:Z2');
  reconciliationSheet.getCell('A1').value = 'REKONSILIASI TARGET PRIBADI BULANAN PER USER';
  reconciliationSheet.getCell('A1').font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 15 };
  reconciliationSheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17324D' } };
  const reconciliationHeaders = ['User ID', 'Nama', ...TARGET_MONTHS.flatMap(month => [`${month} NB`, `${month} RN`])];
  reconciliationSheet.getRow(4).values = reconciliationHeaders;
  headerStyle(reconciliationSheet.getRow(4));
  holders.forEach((user, index) => {
    const rowNumber = index + 5;
    const id = normalizeMarketingUserId(user.id);
    const personal = personalCache.get(id)!;
    reconciliationSheet.getCell(rowNumber, 1).value = id;
    reconciliationSheet.getCell(rowNumber, 2).value = user.name;
    TARGET_MONTHS.forEach((_, monthIndex) => {
      const nbDest = 3 + monthIndex * 2;
      const rnDest = 4 + monthIndex * 2;
      const nbSource = excelColumnName(13 + monthIndex * 2);
      const rnSource = excelColumnName(14 + monthIndex * 2);
      reconciliationSheet.getCell(rowNumber, nbDest).value = { formula: `SUMIF('${MARKETING_SHEETS.target}'!$B$2:$B$200,$A${rowNumber},'${MARKETING_SHEETS.target}'!$${nbSource}$2:$${nbSource}$200)`, result: personal.monthlyNB[monthIndex] };
      reconciliationSheet.getCell(rowNumber, rnDest).value = { formula: `SUMIF('${MARKETING_SHEETS.target}'!$B$2:$B$200,$A${rowNumber},'${MARKETING_SHEETS.target}'!$${rnSource}$2:$${rnSource}$200)`, result: personal.monthlyRN[monthIndex] };
    });
  });
  const totalRow = holders.length + 6;
  const targetRow = totalRow + 1;
  const diffRow = totalRow + 2;
  const statusRow = totalRow + 3;
  reconciliationSheet.getCell(totalRow, 1).value = 'TOTAL ALOKASI';
  reconciliationSheet.getCell(targetRow, 1).value = 'TARGET DIREKTORAT';
  reconciliationSheet.getCell(diffRow, 1).value = 'SELISIH';
  reconciliationSheet.getCell(statusRow, 1).value = 'STATUS';
  TARGET_MONTHS.forEach((_, monthIndex) => {
    const nbColumn = 3 + monthIndex * 2;
    const rnColumn = 4 + monthIndex * 2;
    const nbLetter = excelColumnName(nbColumn);
    const rnLetter = excelColumnName(rnColumn);
    const initialNB = holders.reduce((sum, user) => sum + personalCache.get(normalizeMarketingUserId(user.id))!.monthlyNB[monthIndex], 0);
    const initialRN = holders.reduce((sum, user) => sum + personalCache.get(normalizeMarketingUserId(user.id))!.monthlyRN[monthIndex], 0);
    reconciliationSheet.getCell(totalRow, nbColumn).value = { formula: `SUM(${nbLetter}5:${nbLetter}${holders.length + 4})`, result: initialNB };
    reconciliationSheet.getCell(totalRow, rnColumn).value = { formula: `SUM(${rnLetter}5:${rnLetter}${holders.length + 4})`, result: initialRN };
    reconciliationSheet.getCell(targetRow, nbColumn).value = { formula: `'${TARGET_DIRECTORATE_SHEET}'!B${monthIndex + 5}`, result: initialNB };
    reconciliationSheet.getCell(targetRow, rnColumn).value = { formula: `'${TARGET_DIRECTORATE_SHEET}'!C${monthIndex + 5}`, result: initialRN };
    reconciliationSheet.getCell(diffRow, nbColumn).value = { formula: `${nbLetter}${totalRow}-${nbLetter}${targetRow}`, result: 0 };
    reconciliationSheet.getCell(diffRow, rnColumn).value = { formula: `${rnLetter}${totalRow}-${rnLetter}${targetRow}`, result: 0 };
    reconciliationSheet.getCell(statusRow, nbColumn).value = { formula: `IF(${nbLetter}${diffRow}=0,"BALANCE","BELUM BALANCE")`, result: 'BALANCE' };
    reconciliationSheet.getCell(statusRow, rnColumn).value = { formula: `IF(${rnLetter}${diffRow}=0,"BALANCE","BELUM BALANCE")`, result: 'BALANCE' };
  });
  reconciliationSheet.columns = [{ width: 18 }, { width: 28 }, ...Array.from({ length: 24 }, () => ({ width: 14 }))];
  for (let column = 3; column <= 26; column += 1) reconciliationSheet.getColumn(column).numFmt = moneyFormat;
  for (let row = totalRow; row <= statusRow; row += 1) reconciliationSheet.getRow(row).font = { bold: true };

  const guideSheet = workbook.addWorksheet(TARGET_GUIDE_SHEET);
  guideSheet.mergeCells('A1:F2');
  guideSheet.getCell('A1').value = 'PETUNJUK TEMPLATE SETUP TARGET + VALIDASI OTOMATIS';
  guideSheet.getCell('A1').font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 16 };
  guideSheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17324D' } };
  guideSheet.getRow(4).values = ['Sheet', 'Fungsi'];
  headerStyle(guideSheet.getRow(4));
  [
    [MARKETING_SHEETS.target, 'Isi target pribadi Januari–Desember pada kolom kuning. Kolom tahunan dihitung otomatis.'],
    [TARGET_DIRECTORATE_SHEET, 'Isi target Direktorat bulanan NB/RN sebagai acuan rekonsiliasi.'],
    [TARGET_VALIDATION_SHEET, 'Lihat siapa yang belum balance, jenis error, dan bulan yang belum balance.'],
    [TARGET_RECONCILIATION_SHEET, 'Lihat kontribusi target pribadi per user per bulan terhadap Target Direktorat.'],
    [USER_DIRECTORY_SHEET, 'Referensi User ID dan hierarchy atasan.'],
  ].forEach(row => guideSheet.addRow(row));
  guideSheet.addRow([]);
  guideSheet.addRow(['Rule', 'Keterangan']);
  headerStyle(guideSheet.getRow(11));
  [
    ['Cascading', 'Target Tahunan = Target Pribadi + total Target Tahunan bawahan langsung.'],
    ['NB/RN', 'NB dan RN diperiksa terpisah.'],
    ['Bulanan per user', 'Jumlah Januari–Desember NB = Target Pribadi NB; RN = Target Pribadi RN.'],
    ['Bulanan Direktorat', 'Total target pribadi seluruh pemegang target per bulan harus sama dengan Target Direktorat bulan tersebut.'],
    ['Final gate', 'Ringkasan Excel membantu diagnosis; sistem tetap menjalankan validasi ulang sebelum Publish.'],
  ].forEach(row => guideSheet.addRow(row));
  guideSheet.columns = [{ width: 30 }, { width: 90 }];
  guideSheet.getColumn(2).alignment = { wrapText: true, vertical: 'top' };

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
};

export const downloadTargetSetupWorkbook = async (
  users: User[],
  year: number,
  existingTargets: TargetEntry[],
  filename: string
): Promise<void> => {
  const binary = await buildTargetSetupWorkbook(users, year, existingTargets);
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

export const downloadMarketingWorkbook = async (
  kind: MarketingTemplateKind,
  rows: MarketingTemplateRow[],
  users: User[],
  filename: string
): Promise<void> => {
  const binary = kind === 'production'
    ? await buildProductionMasterWorkbook(rows, users)
    : await buildMarketingWorkbook(kind, rows, users);
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
