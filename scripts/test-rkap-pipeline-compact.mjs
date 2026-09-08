import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Module from 'node:module';
import { resolve, dirname } from 'node:path';
import ts from 'typescript';
import ExcelJS from 'exceljs';

function loadTs(path, overrides = {}) {
  const filename = resolve(path);
  const source = readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(source, { fileName: filename, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } });
  const mod = new Module(filename);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(dirname(filename));
  const original = mod.require.bind(mod);
  mod.require = id => Object.hasOwn(overrides, id) ? overrides[id] : original(id);
  mod._compile(compiled.outputText, filename);
  return mod.exports;
}
const target = loadTs('src/utils/targetCompact.ts');
const marketing = loadTs('src/utils/marketingWorkbook.ts', { './targetCompact': target, './exceljsLoader': { loadExcelJS: async () => ExcelJS } });
const matrix = loadTs('src/utils/rkapPipelineMatrix.ts');
const compact = loadTs('src/utils/rkapPipelineCompact.ts', { './marketingWorkbook': marketing, './rkapPipelineMatrix': matrix });
const book = loadTs('src/utils/rkapPipelineCompactWorkbook.ts', { './exceljsLoader': { loadExcelJS: async () => ExcelJS }, './marketingWorkbook': marketing, './rkapPipelineCompact': compact, './rkapPipelineMatrix': matrix });
const importer = loadTs('src/utils/rkapPipelineCompactImport.ts');
const users = [
  { id:'USR-100001', name:'Director', email:'director@example.invalid', role:'DIRECTOR_MARKETING', position:'Director', unit:'Direktorat Pemasaran', department:'None', superiorId:null, status:'Active' },
  { id:'USR-100002', name:'Advisor', email:'advisor@example.invalid', role:'ADVISOR_MARKETING_DIRECTOR', position:'Advisor', unit:'Direktorat Pemasaran', department:'None', superiorId:'USR-100001', status:'Active' },
  { id:'USR-100003', name:'VP Captive', email:'vp@example.invalid', role:'VP_CAPTIVE_MARKETING', position:'VP', unit:'Captive Marketing', department:'None', superiorId:'USR-100001', status:'Active' },
  { id:'USR-100004', name:'Staff Captive', email:'staff@example.invalid', role:'STAFF_MARKETING', position:'Staff Captive I', unit:'Captive Marketing', department:'Captive I', superiorId:'USR-100003', status:'Active' },
  { id:'USR-100005', name:'VP CRM', email:'crm@example.invalid', role:'VP_CORPORATE_RETAIL_MARKETING', position:'VP', unit:'Corporate & Retail Marketing', department:'None', superiorId:'USR-100001', status:'Active' },
  { id:'USR-100006', name:'Staff CRM', email:'crmstaff@example.invalid', role:'STAFF_MARKETING', position:'Staff CRM I', unit:'Corporate & Retail Marketing', department:'CRM I', superiorId:'USR-100005', status:'Active' },
  { id:'USR-100007', name:'Inactive', email:'inactive@example.invalid', role:'STAFF_MARKETING', position:'Staff', unit:'Captive Marketing', department:'Captive I', superiorId:'USR-100003', status:'Inactive' },
];
const products = [{ id:'PRD-TEST-01', productCode:'JK-05', productName:'TM GROUP TERM LIFE', insuranceType:'Asuransi Jiwa', customerCategory:'Kumpulan', status:'Active', effectiveDate:'2026-01-01' }];
const row = (overrides = {}) => ({
  'No.':'1', Companies:'PT UAT Dummy', Product:'TM GROUP TERM LIFE', 'Dist. Channel':'Direct Selling', Currency:'IDR', 'NB/RN':'RN', 'Jenis Asuransi':'Asuransi Jiwa',
  ...Object.fromEntries(Array.from({length:12},(_,i)=>[String(i+1),[3,6,9,12].includes(i+1)?'100000000':'0'])),
  'TOTAL PREMI':'400000000', UserID:'USR-100004', Tahun:'2026', Catatan:'Synthetic regression only', ...overrides,
});
assert.equal(compact.COMPACT_PIPELINE_HEADERS.length,23);
assert.equal(compact.COMPACT_PIPELINE_REQUIRED.length,22);
for(const removed of ['Cara Bayar','Kategori Nasabah','Estimasi Tanggal Closing','Metode Pengadaan','Existing Policy Number','Original Policy Year','Coverage Start','Coverage End','Renewal Type','Kurs ke IDR','Sumber Kurs','Tanggal Kurs']) assert.equal(compact.COMPACT_PIPELINE_HEADERS.includes(removed),false);
assert.equal(compact.resolveReportingGroup(users[0],users),'Directorate Marketing');
assert.equal(compact.resolveReportingGroup(users[1],users),'Advisor');
assert.equal(compact.resolveReportingGroup(users[3],users),'Captive Marketing');
assert.equal(compact.resolveReportingGroup(users[5],users),'Corporate & Retail Marketing');
const plan=compact.normalizeCompactPipeline([row()],users,products,2026)[0];
assert.equal(plan.totalIdr,400000000);
assert.deepEqual(plan.monthlyIdr,[0,0,100000000,0,0,100000000,0,0,100000000,0,0,100000000]);
assert.equal(plan.reportingGroup,'Captive Marketing');
assert.equal(plan.customerCategory,'Kumpulan');
assert.equal(plan.targetClosingDate,'');
assert.equal(plan.procurementStatus,'Unknown');
assert.equal(plan.operationalDetailsPending,true);
assert.equal(plan.existingPolicyNumber,undefined);
assert.equal(plan.exchangeRate,'1');
const actor={...users[0],name:'Authorized Test Publisher'};
const record=importer.makeCompactPipelineRecord(plan,'PL-2026-10000',actor,'BATCH-TEST','test.xlsx','2026-09-08T00:00:00.000Z');
assert.equal(record.originalTargetClosingDate,'');
assert.equal(record.currentTargetClosingDate,'');
assert.equal(record.pipelineMonth,0);
assert.equal(record.rkapProcurementStatus,'Unknown');
assert.equal(record.rkapReportingGroup,'Captive Marketing');
assert.equal(record.rkapPremiumSchedule.totalIdr,400000000);
assert.equal(record.rkapPremiumSchedule.sourceBatchId,'BATCH-TEST');
assert.deepEqual(record.rkapPremiumSchedule.monthlyOriginal,plan.monthlyOriginal);
assert.equal(matrix.getRkapMonthlyValue(record,2026,3),100000000);
assert.equal(matrix.getRkapMonthlyValue(record,2026,4),0);
assert.equal(matrix.getRkapMonthlyValue(record,2027,3),0);
assert.throws(()=>compact.normalizeCompactPipeline([row({'TOTAL PREMI':'400000001'})],users,products,2026),/tidak sama/);
assert.throws(()=>compact.normalizeCompactPipeline([row({'1':'-1'})],users,products,2026),/Baris 2/);
assert.throws(()=>compact.normalizeCompactPipeline([row({UserID:'USR-100007'})],users,products,2026),/tidak aktif/);
assert.throws(()=>compact.normalizeCompactPipeline([row({UserID:'USR-999999'})],users,products,2026),/tidak ditemukan/);
assert.throws(()=>compact.normalizeCompactPipeline([row({'Jenis Asuransi':'Asuransi Kesehatan'})],users,products,2026),/Jenis Asuransi/);
assert.throws(()=>compact.normalizeCompactPipeline([row(),row({'No.':'2'})],users,products,2026),/Duplikat Companies/);
assert.throws(()=>compact.normalizeCompactPipeline([row({'No.':'01'}),row()],users,products,2026),/No. duplikat/);
assert.throws(()=>compact.normalizeCompactPipeline([row({Currency:'USD'})],users,products,2026),/Kurs USD/);
const usd=compact.normalizeCompactPipeline([row({Currency:'USD','3':'100.00','6':'100.00','9':'100.00','12':'100.00','TOTAL PREMI':'400.00'})],users,products,2026,{USD:{rate:'16000.50',source:'Approved test source',date:'2026-09-01'}})[0];
assert.equal(usd.totalIdr,6400200);
assert.equal(usd.exchangeRateSource,'Approved test source');
assert.equal(usd.exchangeRateDate,'2026-09-01');
assert.throws(()=>compact.normalizeCompactPipeline([row({Currency:'USD'})],users,products,2026,{USD:{rate:'16000',source:'',date:'2026-09-01'}}),/Kurs USD/);
const legacy=compact.normalizeCompactPipeline([row({'Estimasi Tanggal Closing':'2026-08-20','Metode Pengadaan':'Tender','Existing Policy Number':'POL-2025-001','Original Policy Year':'2025','Coverage Start':'2026-03-01','Coverage End':'2027-02-28','Renewal Type':'Regular Renewal','Cara Bayar':'Triwulanan','Kategori Nasabah':'Kumpulan'})],users,products,2026)[0];
assert.equal(legacy.operationalDetailsPending,false);
assert.equal(legacy.isTender,true);
assert.equal(legacy.targetClosingDate,'2026-08-20');
assert.equal(legacy.existingPolicyNumber,'POL-2025-001');
const bytes=await book.buildCompactPipelineWorkbook(users,products,2026);
const parsedBook=new ExcelJS.Workbook();
await parsedBook.xlsx.load(bytes);
assert.deepEqual(parsedBook.worksheets.map(s=>s.name),['Data Pipeline','Daftar User ID','Daftar Produk']);
assert.deepEqual(parsedBook.worksheets[0].getRow(1).values.slice(1),compact.COMPACT_PIPELINE_HEADERS);
assert.equal(parsedBook.worksheets[0].getCell('T2').value,0);
assert.equal(parsedBook.worksheets[0].getCell('U2').dataValidation.formulae[0],'MarketingUserIDs');
assert.equal(parsedBook.worksheets[0].getCell('C2').dataValidation.formulae[0],'MarketingProductNames');
assert.equal(parsedBook.worksheets[1].getColumn(1).numFmt,'@');
assert.equal(parsedBook.worksheets[1].getRow(2).values.includes('Advisor'),true);
assert.equal(parsedBook.worksheets[1].getRow(2).values.includes('Inactive'),false);
for(const [h,v] of Object.entries(row())) parsedBook.worksheets[0].getCell(2,compact.COMPACT_PIPELINE_HEADERS.indexOf(h)+1).value=v;
const imported=await marketing.readNativeXlsxRows(await parsedBook.xlsx.writeBuffer(),{sheetName:'Data Pipeline',requiredHeaders:compact.COMPACT_PIPELINE_REQUIRED});
assert.equal(imported.length,1);
assert.equal(compact.normalizeCompactPipeline(imported,users,products,2026)[0].totalIdr,400000000);
const source=readFileSync('src/components/rkap/RkapPipelineMatrixUpload.tsx','utf8');
assert.match(source,/normalizeCompactPipeline/);
assert.match(source,/makeCompactPipelineRecord/);
assert.match(source,/waitForCentralBusinessStorageSync/);
assert.match(source,/review\.file !== file/);
assert.match(source,/useTargetRealizationPublisher/);
console.log('PASS: 23-column workbook, master-derived reporting, native XLSX, exact monthly totals, approved FX, optional operational metadata, legacy compatibility and publisher integration.');
