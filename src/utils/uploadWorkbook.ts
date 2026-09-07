import type { User } from '@/types';

export type UploadCell = string | number | boolean | null | undefined;
export type UploadRow = Record<string, UploadCell>;

const DIRECTORY_HEADERS = ['User ID', 'Nama User', 'Jabatan', 'Department Umum', 'Department Sub', 'Status'];
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const loadExcel = async () => (await import('exceljs')).default;

const cleanFilename = (value: string) => value.replace(/\.(xlsx|xls|csv)$/i, '').replace(/[^a-zA-Z0-9_. -]/g, '_');

const safeCell = (value: UploadCell): string | number | boolean => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? value : '';
  return value;
};

/** A workbook is necessary because CSV has no concept of multiple sheets. */
export const downloadUploadWorkbook = async (
  headers: readonly string[],
  data: readonly UploadRow[],
  users: readonly User[],
  filename: string,
  sheetName = 'Data Upload',
): Promise<void> => {
  const ExcelJS = await loadExcel();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PertaLife Marketing Dashboard';
  workbook.subject = 'Template upload dan referensi User ID';
  const sheet = workbook.addWorksheet(sheetName);
  sheet.addRow([...headers]);
  data.forEach(row => sheet.addRow(headers.map(header => safeCell(row[header]))));
  const reference = workbook.addWorksheet('Daftar User ID');
  reference.addRow(DIRECTORY_HEADERS);
  const directory = users.filter(user => user.role !== 'SYSTEM_ADMIN' && user.status === 'Active')
    .slice().sort((a, b) => a.id.localeCompare(b.id));
  directory.forEach(user => reference.addRow([user.id, user.name, user.position, user.unit, user.department, user.status]));
  const formatSheet = (target: import('exceljs').Worksheet, widths: number[]) => {
    target.views = [{ state: 'frozen', ySplit: 1 }];
    target.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(2, target.rowCount), column: widths.length } };
    target.getRow(1).height = 30;
    target.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF123B65' } };
      cell.alignment = { vertical: 'middle', wrapText: true };
    });
    widths.forEach((width, i) => { target.getColumn(i + 1).width = width; });
  };
  formatSheet(sheet, headers.map(header => /nama|catatan|produk|nasabah/i.test(header) ? 32 : /user id/i.test(header) ? 24 : 22));
  formatSheet(reference, [24, 34, 38, 34, 30, 16]);
  reference.getColumn(1).numFmt = '@';
  headers.forEach((header, index) => {
    if (!/user\s*id/i.test(header)) return;
    const column = sheet.getColumn(index + 1);
    column.numFmt = '@';
    if (directory.length > 0) {
      // A quoted sheet reference works in Excel without exposing any extra user data.
      const listRange = `'Daftar User ID'!$A$2:$A$${directory.length + 1}`;
      for (let row = 2; row <= Math.max(201, sheet.rowCount); row += 1) {
        sheet.getCell(row, index + 1).dataValidation = {
          type: 'list', allowBlank: true, formulae: [listRange],
          showErrorMessage: true, errorTitle: 'User ID tidak dikenal',
          error: 'Pilih User ID dari sheet Daftar User ID.',
        };
      }
    }
  });
  const bytes = await workbook.xlsx.writeBuffer();
  const blob = new Blob([bytes], { type: XLSX_MIME });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${cleanFilename(filename)}.xlsx`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
};

const textFromCell = (cell: import('exceljs').Cell): string => {
  const value = cell.value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if ('formula' in value || 'sharedFormula' in value) {
      const result = value.result;
      if (result === null || result === undefined || typeof result === 'object') {
        throw new Error('Formula Excel tidak memiliki hasil tersimpan. Paste as Values lalu simpan file kembali.');
      }
      return String(result);
    }
    if ('richText' in value) return value.richText.map(part => part.text).join('');
    if ('text' in value) return String(value.text);
  }
  throw new Error('Tipe sel Excel tidak didukung. Gunakan nilai biasa pada template.');
};

export const readUploadWorkbookMatrix = async (file: File): Promise<string[][]> => {
  if (!/\.xlsx$/i.test(file.name)) throw new Error('File harus berformat XLSX.');
  if (file.size > 25 * 1024 * 1024) throw new Error('File XLSX melebihi batas 25 MB.');
  const ExcelJS = await loadExcel();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('Workbook tidak memiliki sheet data.');
  if (sheet.rowCount > 200000 || sheet.columnCount > 200) throw new Error('Ukuran worksheet melebihi batas import.');
  const rows: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, row => {
    const values: string[] = [];
    for (let column = 1; column <= sheet.columnCount; column += 1) {
      values.push(textFromCell(row.getCell(column)).trim());
    }
    if (values.some(Boolean)) rows.push(values);
  });
  return rows;
};

export const readUploadWorkbookRecords = async (file: File): Promise<Record<string, string>[]> => {
  const matrix = await readUploadWorkbookMatrix(file);
  if (matrix.length < 2) return [];
  const headers = matrix[0];
  return matrix.slice(1).map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
};
