import type { User, ProductMaster } from '@/types';
import { loadExcelJS } from './exceljsLoader';
import { getMarketingDirectoryRows, resolveMarketingOwner } from './marketingWorkbook';
import { COMPACT_PIPELINE_HEADERS, resolveReportingGroup } from './rkapPipelineCompact';
import { MATRIX_CHANNELS, MATRIX_CURRENCIES } from './rkapPipelineMatrix';

/** The operational and FX fields intentionally do not appear in the upload sheet. */
export const buildCompactPipelineWorkbook = async (users: User[], products: ProductMaster[], year: number): Promise<Uint8Array> => {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error('Tahun RKAP tidak valid.');
  const eligible = users.filter(user => !!resolveMarketingOwner(user.id, users).user);
  if (!eligible.length) throw new Error('User Master belum tersedia.');
  const activeProducts = products.filter(product => product.status === 'Active');
  if (!activeProducts.length) throw new Error('Master Produk aktif belum tersedia.');
  const names = activeProducts.map(p => p.productName);
  if (new Set(names.map(name => name.trim().toLowerCase())).size !== names.length) throw new Error('Master Produk aktif memiliki nama duplikat. Perbaiki master sebelum membuat dropdown.');
  const Excel = await loadExcelJS();
  const book = new Excel.Workbook();
  book.creator = 'PertaLife Marketing Dashboard';
  const data = book.addWorksheet('Data Pipeline', { views: [{ state: 'frozen', xSplit: 2, ySplit: 1 }] });
  const directory = book.addWorksheet('Daftar User ID', { views: [{ state: 'frozen', ySplit: 1 }] });
  const productSheet = book.addWorksheet('Daftar Produk', { views: [{ state: 'frozen', ySplit: 1 }] });
  const header = (row: import('exceljs').Row) => { row.height = 30; row.eachCell(cell => { cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF163C72' } }; cell.alignment = { vertical: 'middle', wrapText: true }; }); };
  data.addRow(COMPACT_PIPELINE_HEADERS); header(data.getRow(1));
  data.columns = COMPACT_PIPELINE_HEADERS.map((name, index) => ({ key: name, width: index === 1 ? 36 : index >= 7 && index <= 18 ? 17 : name === 'Catatan' ? 45 : 19 }));
  data.getColumn(1).width = 8;
  data.getColumn(21).width = 20;
  data.getColumn(21).numFmt = '@';
  data.getColumn(22).numFmt = '0';
  data.addRow(COMPACT_PIPELINE_HEADERS.map(name => name === 'Tahun' ? year : name === 'Currency' ? 'IDR' : name === 'No.' ? 1 : ''));
  directory.addRow(['User ID', 'Nama', 'Jabatan', 'Unit', 'Department', 'Status', 'Grup Pelaporan']); header(directory.getRow(1));
  directory.columns = [21, 36, 36, 32, 28, 16, 36].map(width => ({ width }));
  const masterRows = getMarketingDirectoryRows(eligible);
  for (const row of masterRows) {
    const user = eligible.find(item => item.id === row['User ID']);
    if (!user) throw new Error('User Master berubah selama pembuatan template.');
    directory.addRow([...Object.values(row), resolveReportingGroup(user, users)]);
  }
  directory.getColumn(1).numFmt = '@';
  productSheet.addRow(['Product Code', 'Product Name', 'Jenis Asuransi', 'Kategori Nasabah']); header(productSheet.getRow(1));
  productSheet.columns = [19, 48, 28, 24].map(width => ({ width }));
  activeProducts.forEach(p => productSheet.addRow([p.productCode, p.productName, p.insuranceType, p.customerCategory]));
  productSheet.getColumn(1).numFmt = '@';
  book.definedNames.add(`'Daftar User ID'!$A$2:$A$${masterRows.length + 1}`, 'MarketingUserIDs');
  book.definedNames.add(`'Daftar Produk'!$B$2:$B$${activeProducts.length + 1}`, 'MarketingProductNames');
  const validated = data as typeof data & { dataValidations: { add: (address: string, rule: import('exceljs').DataValidation) => void } };
  const add = (range: string, rule: import('exceljs').DataValidation) => validated.dataValidations.add(range, rule);
  const list = (column: string, values: readonly string[]) => add(`${column}2:${column}1001`, { type: 'list', allowBlank: false, formulae: [`"${values.join(',')}"`], showErrorMessage: true, error: 'Gunakan pilihan yang tersedia.' });
  add('C2:C1001', { type: 'list', allowBlank: false, formulae: ['MarketingProductNames'], showErrorMessage: true, error: 'Pilih produk dari Master Produk.' });
  add('U2:U1001', { type: 'list', allowBlank: false, formulae: ['MarketingUserIDs'], showErrorMessage: true, error: 'Pilih User ID aktif dari User Master.' });
  list('D', MATRIX_CHANNELS); list('E', MATRIX_CURRENCIES); list('F', ['NB', 'RN']); list('G', ['Asuransi Jiwa', 'Asuransi Kesehatan']);
  for (let col = 8; col <= 19; col += 1) {
    const letter = String.fromCharCode(64 + col);
    data.getColumn(col).numFmt = '#,##0.##;[Red](#,##0.##)';
    add(`${letter}2:${letter}1001`, { type: 'decimal', operator: 'greaterThanOrEqual', formulae: [0], allowBlank: true, showErrorMessage: true, error: 'Premi tidak boleh negatif.' });
  }
  data.getColumn(20).numFmt = '#,##0.##;[Red](#,##0.##)';
  data.getCell('T2').value = 0;
  data.getCell('T1').note = 'Isi total numerik dalam Currency asli. Sistem menghitung ulang 12 bulan. Jika memakai formula, simpan setelah Excel selesai menghitung.';
  data.getCell('U1').note = 'Grup Captive/Corporate & Retail/Advisor diturunkan dari User Master. Tidak perlu kolom unit tambahan.';
  data.getCell('V1').note = 'Tahun RKAP, bukan tanggal closing. Bulan 1–12 adalah jadwal premi, bukan jadwal operasional.';
  data.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1001, column: COMPACT_PIPELINE_HEADERS.length } };
  return new Uint8Array(await book.xlsx.writeBuffer());
};

export const downloadCompactPipelineWorkbook = async (users: User[], products: ProductMaster[], year: number): Promise<void> => {
  const bytes = await buildCompactPipelineWorkbook(users, products, year);
  const blob = new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `Template_Bulk_Pipeline_${year}_Compact.xlsx`;
  document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
};
