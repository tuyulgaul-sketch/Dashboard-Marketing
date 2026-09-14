import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import ExcelJS from 'exceljs';

const tsSource = readFileSync('src/utils/marketingWorkbook.ts', 'utf8');
const transformed = transformSync(tsSource, { loader: 'ts', format: 'esm', target: 'es2022' }).code;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(transformed).toString('base64')}`;
const workbook = await import(moduleUrl);

const users = [
  { id: 'USR-000025', name: 'Marketing Admin', email: 'ma@pertalife.com', role: 'STAFF_MARKETING_ADMINISTRATION', position: 'Staff', unit: 'Marketing Support', department: 'Marketing Administration', status: 'Active' },
  { id: 'USR-000002', name: 'Advisor', email: 'advisor@pertalife.com', role: 'ADVISOR_MARKETING_DIRECTOR', position: 'Advisor', unit: 'Direktorat Pemasaran', department: 'None', status: 'Active' },
  { id: 'USR-000001', name: 'Director', email: 'director@pertalife.com', role: 'DIRECTOR_MARKETING', position: 'Director', unit: 'Direktorat Pemasaran', department: 'None', status: 'Active' },
];

const roundtrip = async (kind, rows, headers = workbook.getMarketingTemplateHeaders(kind)) => {
  const bytes = await workbook.buildMarketingWorkbook(kind, rows, users);
  const parsed = await workbook.readNativeXlsxRows(bytes, { sheetName: workbook.MARKETING_SHEETS[kind], requiredHeaders: headers });
  const actual = new ExcelJS.Workbook();
  await actual.xlsx.load(bytes);
  return { bytes, parsed, actual };
};

const prod = Object.fromEntries(workbook.getMarketingTemplateHeaders('production').map(header => [header, '']));
prod['Tahun Produksi'] = 2026;
prod['Bulan Produksi'] = 8;
prod['User ID Pemilik Realisasi'] = 'USR-000025';
prod['PIC Marketing'] = 'Marketing Admin';
prod['Realisasi Produksi (Rp)'] = 150000000;
const prodRoundtrip = await roundtrip('production', [prod]);
assert.equal(prodRoundtrip.parsed[0]['User ID Pemilik Realisasi'], 'USR-000025');
assert.equal(prodRoundtrip.actual.worksheets[0].getCell('A2').value, 2026);
assert.ok(prodRoundtrip.actual.worksheets[0].getCell('I2').dataValidation.formulae.length);
assert.equal(prodRoundtrip.actual.getWorksheet(workbook.USER_DIRECTORY_SHEET).getCell('A2').value, 'USR-000001');

const compactTarget = Object.fromEntries(workbook.getMarketingTemplateHeaders('target').map(header => [header, '']));
compactTarget.Tahun = 2026;
compactTarget['User ID Penerima'] = 'USR-000002';
compactTarget.Periode = 8;
compactTarget['NB/RN'] = 'NB';
compactTarget['Target (Rp)'] = 150000000;
const targetRoundtrip = await roundtrip('target', [compactTarget]);
assert.equal(targetRoundtrip.parsed[0]['User ID Penerima'], 'USR-000002');
assert.equal(targetRoundtrip.parsed[0].Periode, '8');
assert.equal(targetRoundtrip.parsed[0]['NB/RN'], 'NB');
assert.equal(targetRoundtrip.parsed[0]['Target (Rp)'], '150000000');
assert.equal(targetRoundtrip.actual.worksheets[0].getCell('C2').value, 8);
assert.equal(targetRoundtrip.actual.worksheets[0].getCell('D2').value, 'NB');
assert.equal(targetRoundtrip.actual.worksheets[0].getCell('E2').value, 150000000);
assert.ok(targetRoundtrip.actual.worksheets[0].getCell('C2').dataValidation.formulae.length);
assert.ok(targetRoundtrip.actual.worksheets[0].getCell('D2').dataValidation.formulae.length);

const targetSetupUsers = [
  { id: 'USR-000001', name: 'Direktur', role: 'DIRECTOR_MARKETING', position: 'Director Marketing', unit: 'Direktorat Pemasaran', department: 'None', status: 'Active', superiorId: null },
  { id: 'USR-000002', name: 'Advisor', role: 'ADVISOR_MARKETING_DIRECTOR', position: 'Advisor', unit: 'Direktorat Pemasaran', department: 'None', status: 'Active', superiorId: 'USR-000001' },
  { id: 'USR-000003', name: 'VP Captive', role: 'VP_CAPTIVE_MARKETING', position: 'VP', unit: 'Captive Marketing', department: 'None', status: 'Active', superiorId: 'USR-000001' },
  { id: 'USR-000004', name: 'Staff Captive', role: 'STAFF_MARKETING', position: 'Staff', unit: 'Captive Marketing', department: 'Captive I', status: 'Active', superiorId: 'USR-000003' },
];
const setupBytes = await workbook.buildTargetSetupWorkbook(targetSetupUsers, 2027, []);
const setupBook = new ExcelJS.Workbook();
await setupBook.xlsx.load(setupBytes);
assert.deepEqual(setupBook.worksheets.map(sheet => sheet.name), [
  workbook.MARKETING_SHEETS.target,
  workbook.USER_DIRECTORY_SHEET,
  workbook.TARGET_DIRECTORATE_SHEET,
  workbook.TARGET_VALIDATION_ENGINE_SHEET,
  workbook.TARGET_VALIDATION_SHEET,
  workbook.TARGET_RECONCILIATION_SHEET,
  workbook.TARGET_GUIDE_SHEET,
]);
const setupData = setupBook.getWorksheet(workbook.MARKETING_SHEETS.target);
assert.equal(setupData.getCell('A2').value, 2027);
assert.equal(setupData.getCell('B2').value, 'USR-000001');
assert.ok(setupData.getCell('G2').value.formula);
assert.ok(setupData.getCell('K2').value.formula);
assert.equal(setupData.getCell('M2').value, 0);
assert.equal(setupBook.getWorksheet(workbook.TARGET_DIRECTORATE_SHEET).getCell('A5').value, 'Januari');
assert.ok(setupBook.getWorksheet(workbook.TARGET_VALIDATION_SHEET).getCell('B6').value.formula);
assert.equal(setupBook.getWorksheet(workbook.TARGET_VALIDATION_ENGINE_SHEET).state, 'veryHidden');
// Formula cells in a freshly generated blank template deliberately require Excel recalculation.
// The parser's cached-result safety is covered below with an explicit formula result fixture.
const pipeline = Object.fromEntries(workbook.getMarketingTemplateHeaders('pipeline').map(header => [header, '']));
pipeline.Tahun = 2026;
pipeline['PIC User ID'] = 'USR-000025';
pipeline['Nama Calon Nasabah'] = 'PT Contoh';
pipeline['Estimasi Premi'] = 150000000;
pipeline['Target Closing'] = '2026-08-20';
await roundtrip('pipeline', [pipeline], workbook.getMarketingTemplateHeaders('pipeline'));

const file = (name, bytes) => ({ name, size: bytes.length, arrayBuffer: async () => Uint8Array.from(bytes).buffer, text: async () => new TextDecoder().decode(bytes) });
const imported = await workbook.readMarketingSpreadsheet(file('production.xlsx', prod.bytes), { sheetName: workbook.MARKETING_SHEETS.production, requiredHeaders: workbook.getMarketingTemplateHeaders('production') });
assert.equal(imported[0]['User ID Pemilik Realisasi'], 'USR-000025');
const legacy = await workbook.readMarketingSpreadsheet(file('production.csv', new TextEncoder().encode('Tahun Produksi;User ID Pemilik Realisasi;PIC Marketing\r\n2026;USR-000025;"Marketing, A"')), { requiredHeaders: ['User ID Pemilik Realisasi'] });
assert.equal(legacy[0]['PIC Marketing'], 'Marketing, A');
assert.equal(legacy[0]['User ID Pemilik Realisasi'], 'USR-000025');
await assert.rejects(workbook.readMarketingSpreadsheet(file('old.csv', new TextEncoder().encode('PIC Marketing\nMarketing A')), { requiredHeaders: ['User ID Pemilik Realisasi'] }), /Kolom wajib/);
await assert.rejects(workbook.readMarketingSpreadsheet(file('renamed.xlsx', new TextEncoder().encode('a,b\n1,2')), { sheetName: workbook.MARKETING_SHEETS.production }), /./);
await assert.rejects(workbook.readMarketingSpreadsheet(file('old.xls', prod.bytes)), /Gunakan file XLSX/);
await assert.rejects(workbook.readMarketingSpreadsheet({ name: 'large.xlsx', size: 16 * 1024 * 1024, arrayBuffer: async () => new ArrayBuffer(0) }), /15 MB/);
const malformed = new ExcelJS.Workbook();
const sheet = malformed.addWorksheet('Data Realisasi');
sheet.addRow(['User ID Pemilik Realisasi', 'Nominal']);
sheet.addRow(['USR-000025', { formula: '1+1' }]);
await assert.rejects(workbook.readNativeXlsxRows(await malformed.xlsx.writeBuffer(), { sheetName: 'Data Realisasi' }), /hasil tersimpan/);
sheet.getCell('B2').value = { formula: '1+1', result: 2 };
assert.equal((await workbook.readNativeXlsxRows(await malformed.xlsx.writeBuffer(), { sheetName: 'Data Realisasi' }))[0].Nominal, '2');
sheet.getCell('A1').value = 'Nominal';
await assert.rejects(workbook.readNativeXlsxRows(await malformed.xlsx.writeBuffer(), { sheetName: 'Data Realisasi' }), /duplikat/);

const productionSource = readFileSync('src/pages/ProduksiPage.tsx', 'utf8');
assert.match(productionSource, /readMarketingSpreadsheet/);
assert.match(productionSource, /resolveMarketingOwner/);
const targetSource = readFileSync('src/pages/TargetRkapPage.tsx', 'utf8');
assert.match(targetSource, /readMarketingSpreadsheet/);
assert.match(targetSource, /normalizeTargetUploadRows/);
assert.match(targetSource, /resolveMarketingOwner/);
assert.match(targetSource, /TARGET_DIRECTORATE_SHEET/);
assert.match(targetSource, /Target Direktorat .* tidak balance/);
console.log('Marketing XLSX regression passed.');
