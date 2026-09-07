import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import Module from 'node:module';
import { resolve, dirname } from 'node:path';
import ts from 'typescript';
import ExcelJS from 'exceljs';

function loadTs(path, overrides = {}) {
  const filename = resolve(path);
  const source = readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(source, { fileName: filename, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } });
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(dirname(filename));
  const original = mod.require.bind(mod);
  mod.require = id => Object.hasOwn(overrides, id) ? overrides[id] : original(id);
  mod._compile(compiled.outputText, filename);
  return mod.exports;
}
const csv = loadTs('src/utils/excelExport.ts', { './marketingWorkbook': { readNativeXlsxRows: () => { throw new Error('Not used by CSV fixture'); } } });
const workbook = loadTs('src/utils/marketingWorkbook.ts', { './excelExport': csv });
const users = [
  { id: 'USR-000025', name: 'Marketing A', role: 'STAFF_MARKETING', position: 'Staff Captive I', unit: 'Captive Marketing', department: 'Captive I', status: 'Active', superiorId: 'USR-000004' },
  { id: 'USR-000026', name: 'Marketing B', role: 'STAFF_MARKETING', position: 'Staff CRM I', unit: 'Corporate & Retail Marketing', department: 'CRM I', status: 'Active', superiorId: 'USR-000015' },
  { id: 'USR-000027', name: 'Marketing Tidak Aktif', role: 'STAFF_MARKETING', position: 'Staff', unit: 'Captive Marketing', department: 'Captive I', status: 'Inactive', superiorId: null },
  { id: 'USR-000024', name: 'Arianie', role: 'TEAM_LEADER_MARKETING_SUPPORT', position: 'TL', unit: 'Marketing Support', department: 'None', status: 'Active', superiorId: null },
  { id: 'USR-SYSADMIN', name: 'System', role: 'SYSTEM_ADMIN', position: 'Admin', unit: 'Administrasi Sistem', department: 'None', status: 'Active', superiorId: null },
];
const owner = (id, options = {}) => workbook.resolveMarketingOwner(id, users, { production: true, ...options });
assert.equal(owner(' usr-000025 ', { name: 'Marketing A', unit: 'Captive Marketing' }).user.id, 'USR-000025');
assert.equal(owner('USR-000025', { name: 'Marketing B' }).user.id, 'USR-000025');
assert.equal(owner('USR-000025', { name: 'Marketing B' }).warnings.length, 1);
assert.ok(owner('').errors.length);
assert.ok(owner('USR-999999').errors.length);
assert.ok(owner('USR-000027').errors.length);
assert.ok(owner('USR-000024').errors.length);
assert.ok(owner('USR-000025', { unit: 'Corporate & Retail Marketing' }).errors.length);
assert.ok(workbook.resolveMarketingOwner('USR-000025', [...users, users[0]]).errors.length);
assert.equal(workbook.getMarketingDirectoryRows(users).length, 4);
assert.equal(workbook.getMarketingDirectoryRows(users).some(row => row['User ID'] === 'USR-SYSADMIN'), false);
assert.throws(() => workbook.getMarketingDirectoryRows([...users, users[0]]), /duplikat/);

async function roundtrip(kind, input, required) {
  const bytes = await workbook.buildMarketingWorkbook(kind, input, users);
  assert.equal(bytes[0], 0x50);
  assert.equal(bytes[1], 0x4b);
  const actual = new ExcelJS.Workbook();
  await actual.xlsx.load(bytes);
  assert.deepEqual(actual.worksheets.map(sheet => sheet.name), [workbook.MARKETING_SHEETS[kind], workbook.USER_DIRECTORY_SHEET]);
  const data = actual.worksheets[0];
  assert.deepEqual(data.getRow(1).values.slice(1), workbook.getMarketingTemplateHeaders(kind));
  assert.equal(actual.worksheets[1].getCell('A2').value, 'USR-000024');
  assert.equal(actual.worksheets[1].getColumn(1).numFmt, '@');
  const ownerColumn = kind === 'target' ? 2 : kind === 'pipeline' ? 12 : 9;
  assert.equal(data.getColumn(ownerColumn).numFmt, '@');
  assert.ok(data.getCell(2, ownerColumn).dataValidation.formulae.includes('MarketingUserIDs'));
  assert.equal(actual.definedNames.getRanges('MarketingUserIDs').length, 1);
  const parsed = await workbook.readNativeXlsxRows(bytes, { sheetName: workbook.MARKETING_SHEETS[kind], requiredHeaders: required });
  assert.equal(parsed.length, input.length);
  if (input.length) for (const [key, value] of Object.entries(input[0])) assert.equal(parsed[0][key], String(value));
  assert.equal(parsed.some(row => Object.hasOwn(row, 'Nama') && Object.hasOwn(row, 'Status')), false);
  await assert.rejects(workbook.readNativeXlsxRows(bytes, { sheetName: 'Tidak Ada' }), /tidak ditemukan/);
  return { bytes, actual };
}
const production = { 'Tahun Produksi': 2026, 'Bulan Produksi': 8, 'Nomor Polis': 'POL-0001', 'Nama Nasabah': 'PT Contoh', 'Nama Produk': 'PLife Shield', 'Realisasi Produksi (Rp)': 150000000, 'Fungsi Marketing': 'Captive Marketing', 'Jenis Bisnis': 'New Business', 'User ID Pemilik Realisasi': 'USR-000025', 'PIC Marketing': 'Marketing A' };
const prod = await roundtrip('production', [production], workbook.getMarketingTemplateHeaders('production'));
const target = Object.fromEntries(workbook.getMarketingTemplateHeaders('target').map(header => [header, header === 'Tahun' ? 2026 : '']));
target['User ID Penerima'] = 'USR-000025';
target['Nama Penerima'] = 'Marketing A';
target['Target Tahunan'] = 150000000;
await roundtrip('target', [target], workbook.getMarketingTemplateHeaders('target'));
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
const targetSource = readFileSync('src/pages/TargetRkapPage.tsx', 'utf8');
assert.match(productionSource, /readMarketingSpreadsheet\(uploadFile/);
assert.match(productionSource, /User ID Pemilik Realisasi/);
assert.match(productionSource, /picUserId:\s*picMatch!\.id/);
assert.doesNotMatch(productionSource, /users\.find\(\s*user\s*=>\s*user\.name/);
assert.match(productionSource, /validatedFile !== uploadFile/);
assert.match(targetSource, /downloadMarketingWorkbook\('target'/);
assert.match(targetSource, /downloadMarketingWorkbook\('pipeline'/);
assert.match(targetSource, /resolveMarketingOwner\(picUserId/);
assert.match(targetSource, /getMarketingTemplateHeaders\('pipeline'\)/);
console.log('Native XLSX roundtrip, both sheet contracts, real numeric values, owner ID validation, CSV compatibility and malformed workbook checks passed.');
