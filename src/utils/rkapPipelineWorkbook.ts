import type { User } from '@/types';
import { getMarketingDirectoryRows } from './marketingWorkbook';
import { MATRIX_CHANNELS, MATRIX_CURRENCIES, MATRIX_PAYMENT_MODES, RKAP_PIPELINE_HEADERS } from './rkapPipelineMatrix';

/** Native OOXML workbook, never a CSV with a renamed extension. */
export const buildRkapPipelineWorkbook = async (users: User[], year: number): Promise<Uint8Array> => {
  const directory = getMarketingDirectoryRows(users);
  if (!directory.length) throw new Error('User Master belum tersedia. Template tidak dapat dibuat.');
  const Excel = (await import('exceljs')).default;
  const workbook = new Excel.Workbook();
  workbook.creator = 'PertaLife Marketing Dashboard';
  workbook.calcProperties.fullCalcOnLoad = true;
  const data = workbook.addWorksheet('Data Pipeline', { views: [{ state: 'frozen', xSplit: 2, ySplit: 1 }] });
  const reference = workbook.addWorksheet('Daftar User ID', { views: [{ state: 'frozen', ySplit: 1 }] });
  const styleHeader = (row: import('exceljs').Row) => {
    row.height = 32;
    row.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF163C72' } };
      cell.alignment = { vertical: 'middle', wrapText: true };
    });
  };
  data.addRow(RKAP_PIPELINE_HEADERS);
  styleHeader(data.getRow(1));
  data.columns = RKAP_PIPELINE_HEADERS.map((header, index) => ({ key: header, width: index === 1 ? 34 : index >= 7 && index <= 18 ? 17 : /Product|Asuransi|Catatan|Coverage|Closing|Policy|Pengadaan|Kurs/.test(header) ? 25 : 19 }));
  data.getColumn(1).width = 8;
  data.getColumn(21).width = 21;
  data.getColumn(21).numFmt = '@';
  data.getColumn(5).numFmt = '@';
  data.getColumn(22).numFmt = '0';
  const firstRow = Object.fromEntries(RKAP_PIPELINE_HEADERS.map(header => [header, header === 'Tahun' ? year : header === 'Currency' ? 'IDR' : header === 'No.' ? 1 : '']));
  data.addRow(RKAP_PIPELINE_HEADERS.map(header => firstRow[header]));
  reference.addRow(['User ID', 'Nama', 'Jabatan', 'Unit', 'Department', 'Status']);
  styleHeader(reference.getRow(1));
  reference.columns = [21, 36, 36, 32, 28, 16].map(width => ({ width }));
  directory.forEach(row => reference.addRow(Object.values(row)));
  reference.getColumn(1).numFmt = '@';
  reference.autoFilter = { from: 'A1', to: `F${directory.length + 1}` };
  workbook.definedNames.add(`'Daftar User ID'!$A$2:$A$${directory.length + 1}`, 'MarketingUserIDs');
  const list = (column: number, values: readonly string[], rowNumber: number) => {
    data.getCell(rowNumber, column).dataValidation = {
      type: 'list', allowBlank: false, formulae: [`"${values.join(',')}"`],
      showErrorMessage: true, errorTitle: 'Pilihan tidak valid', error: 'Gunakan pilihan yang tersedia.',
    };
  };
  for (let rowNumber = 2; rowNumber <= 1001; rowNumber += 1) {
    data.getCell(rowNumber, 21).dataValidation = {
      type: 'list', allowBlank: false, formulae: ['MarketingUserIDs'],
      showErrorMessage: true, errorTitle: 'User ID tidak valid', error: 'Pilih User ID dari sheet Daftar User ID.',
    };
    list(4, MATRIX_CHANNELS, rowNumber);
    list(5, MATRIX_CURRENCIES, rowNumber);
    list(6, ['NB', 'RN'], rowNumber);
    list(7, ['Asuransi Jiwa', 'Asuransi Kesehatan'], rowNumber);
    list(23, MATRIX_PAYMENT_MODES, rowNumber);
    list(24, ['Individu', 'Kumpulan'], rowNumber);
    list(26, ['Tender', 'Non Tender'], rowNumber);
    for (let column = 8; column <= 19; column += 1) {
      const cell = data.getCell(rowNumber, column);
      cell.numFmt = '#,##0.##;[Red](#,##0.##)';
      cell.dataValidation = { type: 'decimal', operator: 'greaterThanOrEqual', formulae: [0], allowBlank: true, showErrorMessage: true, error: 'Premi tidak boleh negatif.' };
    }
    const total = data.getCell(rowNumber, 20);
    total.numFmt = '#,##0.##;[Red](#,##0.##)';
    total.value = { formula: `SUM(H${rowNumber}:S${rowNumber})`, result: 0 };
    total.font = { bold: true, color: { argb: 'FF163C72' } };
    data.getCell(rowNumber, 25).numFmt = 'yyyy-mm-dd';
    data.getCell(rowNumber, 29).numFmt = 'yyyy-mm-dd';
    data.getCell(rowNumber, 30).numFmt = 'yyyy-mm-dd';
    data.getCell(rowNumber, 35).numFmt = 'yyyy-mm-dd';
    data.getCell(rowNumber, 33).numFmt = '#,##0.000000';
  }
  data.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1001, column: RKAP_PIPELINE_HEADERS.length } };
  data.getCell('T1').note = 'Total premi dalam Currency asli. Formula menjumlahkan bulan 1–12. Sistem menghitung ulang dan menolak jika tidak sama.';
  data.getCell('Y1').note = 'Tanggal estimasi closing opportunity, bukan tanggal jatuh tempo masing-masing premi. Gunakan YYYY-MM-DD.';
  data.getCell('AG1').note = 'Untuk Currency selain IDR, isi kurs IDR per satu unit mata uang asing yang sudah disetujui, beserta sumber dan tanggalnya. Sistem tidak menebak kurs.';
  data.getCell('W1').note = 'Jadwal 1–12 diisi sesuai rencana pembayaran aktual. Cara Bayar tidak membuat premi otomatis dan tidak menggandakan opportunity.';
  return new Uint8Array(await workbook.xlsx.writeBuffer());
};

export const downloadRkapPipelineWorkbook = async (users: User[], year: number): Promise<void> => {
  const binary = await buildRkapPipelineWorkbook(users, year);
  const blob = new Blob([binary as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `Template_Bulk_Pipeline_${year}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};
