import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const Module = require('node:module');
const load = path => {
  const filename = resolve(path);
  const mod = new Module(filename);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(dirname(filename));
  mod._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText, filename);
  return mod.exports;
};
require.extensions['.ts'] = (mod, filename) => {
  mod._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText, filename);
};

const bulk = load('src/utils/masterIntermediaryBulk.ts');
const baseSql = readFileSync('supabase/migrations/20260908_agent_broker_bulk_import.sql', 'utf8');
const correctionSql = readFileSync('supabase/migrations/20260909_broker_ojk_status_semantics.sql', 'utf8');
const page = readFileSync('src/pages/MasterIntermediaryBulkImportPage.tsx', 'utf8');
const brokerCombobox = readFileSync('src/components/common/BrokerCombobox.tsx', 'utf8');
const masterService = readFileSync('src/services/masterDataService.ts', 'utf8');
const bookingPage = readFileSync('src/pages/BookingPipelinePage.tsx', 'utf8');
const legacyStore = readFileSync('src/services/store.ts', 'utf8');
const brokerData = readFileSync('src/data/brokerMasterData.ts', 'utf8');
const app = readFileSync('src/App.tsx', 'utf8');
const sidebar = readFileSync('src/components/layout/AppSidebar.tsx', 'utf8');

test('date and Agent status normalization preserve intended semantics', () => {
  assert.equal(bulk.normalizeMasterDate('45292'), '2024-01-01');
  assert.equal(bulk.normalizeMasterDate('01/09/2026'), '2026-09-01');
  assert.equal(bulk.normalizeMasterDate('2026-09-01'), '2026-09-01');
  assert.equal(bulk.normalizeAgentStatus('Aktif'), 'Active');
  assert.equal(bulk.normalizeAgentStatus('Tidak Aktif'), 'Inactive');
  assert.throws(() => bulk.normalizeMasterDate('31/02/2026'), /tidak valid/);
  assert.throws(() => bulk.normalizeAgentStatus('unknown'), /Status Agent/);
});

test('Agent review adds new rows, skips exact repeats and blocks conflicting identities', () => {
  const source = [{
    'No.': '1',
    'Kode Agen': '0000123456789012',
    'Nama Agen Asuransi': 'AGENT SANITIZED',
    'Perusahaan Asuransi': 'PT Perta Life Insurance',
    'Nomor Lisensi': '0000999911112222',
    'Tanggal Lisensi': '45292',
    'Tanggal Masa Berlaku Lisensi': '31/12/2028',
    Email: 'agent@example.invalid',
    Status: 'Active',
  }];
  const fresh = bulk.reviewAgentBulkRows(source, []);
  assert.equal(fresh.addCount, 1);
  assert.equal(fresh.errorCount, 0);
  assert.equal(fresh.rows[0].agentCode, '0000123456789012');
  assert.equal(fresh.rows[0].licenseNumber, '0000999911112222');
  assert.equal(fresh.rows[0].licenseDate, '2024-01-01');

  const existing = [{
    id: 'AGT-SANITIZED',
    agentCode: fresh.rows[0].agentCode,
    agentName: fresh.rows[0].agentName,
    insuranceCompany: fresh.rows[0].insuranceCompany,
    licenseNumber: fresh.rows[0].licenseNumber,
    licenseDate: fresh.rows[0].licenseDate,
    licenseExpiryDate: fresh.rows[0].licenseExpiryDate,
    email: fresh.rows[0].email,
    status: fresh.rows[0].status,
    sourcePeriod: '',
    sourceName: '',
  }];
  const repeat = bulk.reviewAgentBulkRows(source, existing);
  assert.equal(repeat.skipCount, 1);
  assert.equal(repeat.errorCount, 0);

  const conflict = bulk.reviewAgentBulkRows([{ ...source[0], 'Nama Agen Asuransi': 'OTHER SANITIZED NAME' }], existing);
  assert.equal(conflict.errorCount, 1);
  assert.match(conflict.issues[0].message, /tidak menimpa data existing/i);
});

test('Agent review rejects scientific notation and duplicate license identities', () => {
  const row = {
    'No.': '1', 'Kode Agen': '1.2345E+12', 'Nama Agen Asuransi': 'A',
    'Perusahaan Asuransi': 'PT Perta Life Insurance', 'Nomor Lisensi': 'LIC-SANITIZED',
    'Tanggal Lisensi': '01/01/2024', 'Tanggal Masa Berlaku Lisensi': '01/01/2028',
    Email: 'a@example.invalid', Status: 'Active',
  };
  const duplicate = bulk.reviewAgentBulkRows([
    row,
    { ...row, 'No.': '2', 'Kode Agen': 'AGT-SECOND' },
  ], []);
  assert.equal(duplicate.errorCount, 2);
  assert.ok(duplicate.issues.some(issue => /notasi ilmiah/.test(issue.message)));
  assert.ok(duplicate.issues.filter(issue => /Lisensi duplikat/.test(issue.message)).length >= 2);
});

test('Broker review requires no PertaLife status and still blocks duplicate OJK license identities', () => {
  const first = {
    Nomor: '1', 'Nama Perusahaan': 'PT BROKER SANITIZED ONE', 'Nomor Izin Usaha': 'KEP-SANITIZED-001',
    'Tanggal Izin Usaha': '45292', Alamat: 'Alamat 1', Kota: 'Jakarta', 'Kode Pos': '00123',
    'Nomor Telepon 1': '021000000', 'Nomor Telepon 2': '', 'Nomor Fax': '',
    'Alamat Email': 'broker1@example.invalid', Website: 'https://example.invalid',
  };
  const valid = bulk.reviewBrokerBulkRows([first], []);
  assert.equal(valid.addCount, 1);
  assert.equal(valid.errorCount, 0);
  assert.equal(valid.rows[0].postalCode, '00123');
  assert.equal('status' in valid.rows[0], false);

  const existing = [{
    id: 'BRK-SANITIZED',
    companyName: valid.rows[0].companyName,
    licenseNumber: valid.rows[0].licenseNumber,
    licenseDate: valid.rows[0].licenseDate,
    address: valid.rows[0].address,
    city: valid.rows[0].city,
    postalCode: valid.rows[0].postalCode,
    phone1: valid.rows[0].phone1,
    phone2: valid.rows[0].phone2,
    fax: valid.rows[0].fax,
    email: valid.rows[0].email,
    website: valid.rows[0].website,
    status: 'Inactive',
    sourcePeriod: '',
    sourceName: '',
  }];
  const repeat = bulk.reviewBrokerBulkRows([first], existing);
  assert.equal(repeat.skipCount, 1, 'legacy status must not make an otherwise identical Broker conflict');
  assert.equal(repeat.errorCount, 0);

  const duplicates = bulk.reviewBrokerBulkRows([
    first,
    { ...first, Nomor: '2', 'Nama Perusahaan': 'PT BROKER SANITIZED TWO' },
  ], []);
  assert.equal(duplicates.errorCount, 2);
  assert.ok(duplicates.issues.filter(issue => /Nomor izin usaha duplikat/i.test(issue.message)).length >= 2);
});

test('server correction removes Broker status parameter while preserving scoped atomic add-only import', () => {
  assert.match(baseSql, /can_bulk_manage_intermediary_master/);
  assert.match(correctionSql, /bulk_add_master_brokers\(\s*p_rows jsonb,\s*p_source_name text/);
  assert.doesNotMatch(correctionSql, /p_status text/);
  assert.match(correctionSql, /alter column status drop not null/);
  assert.match(correctionSql, /Legacy compatibility field only/);
  assert.match(correctionSql, /v_skipped := v_skipped \+ 1/);
  assert.match(correctionSql, /BRK-BULK-/);
  assert.doesNotMatch(correctionSql, /\bupdate\s+public\.master_brokers\b/i);
  assert.doesNotMatch(correctionSql, /\bdelete\s+from\s+public\.master_brokers\b/i);
  assert.match(correctionSql, /revoke all on function public\.bulk_add_master_brokers/);
});

test('UI exposes Agent status only; Broker picker and service do not use status as business gating', () => {
  assert.match(app, /MasterIntermediaryBulkImportPage/);
  assert.match(app, /MarketingAdministrationOnly/);
  assert.match(app, /path="\/master-intermediary-import"/);
  assert.match(sidebar, /Import Agent & Broker/);
  assert.match(page, /Status Active\/Inactive tetap dikelola PertaLife/);
  assert.match(page, /Broker tidak memiliki status Active\/Inactive yang dikelola PertaLife/);
  assert.doesNotMatch(page, /brokerStatus|Status untuk seluruh batch Broker/);
  assert.match(page, /'agentCode' in row \? row\.status : '—'/);
  assert.doesNotMatch(brokerCombobox, /broker\.status\s*===/);
  assert.match(brokerCombobox, /data izin mengikuti sumber OJK/);
  assert.doesNotMatch(masterService, /status:\s*broker\.status/);
  assert.match(page, /window\.confirm/);
  assert.match(page, /Download Error Report/);
  assert.match(page, /Import Data Baru/);
  assert.doesNotMatch(page, /localStorage|sessionStorage/);
  assert.doesNotMatch(page, /Daftar Agent\.xlsx|Daftar Broker\.xlsx/);
  assert.doesNotMatch(bookingPage, /brokerStatusFilter|setBrokerStatus|editingBroker\.status|broker\.status ===/);
  assert.doesNotMatch(bookingPage, /Broker.*berstatus Active|broker berstatus Active/i);
  assert.doesNotMatch(legacyStore, /public setBrokerStatus\(/);
  assert.match(brokerData, /Legacy compatibility only; not a PertaLife or OJK license determination/);
});
