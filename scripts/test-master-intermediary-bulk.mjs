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
const sql = readFileSync('supabase/migrations/20260908_agent_broker_bulk_import.sql', 'utf8');
const page = readFileSync('src/pages/MasterIntermediaryBulkImportPage.tsx', 'utf8');
const app = readFileSync('src/App.tsx', 'utf8');
const sidebar = readFileSync('src/components/layout/AppSidebar.tsx', 'utf8');

test('date and status normalization preserve original master semantics', () => {
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

test('Broker review requires explicit batch status and blocks duplicate license across companies', () => {
  const first = {
    Nomor: '1', 'Nama Perusahaan': 'PT BROKER SANITIZED ONE', 'Nomor Izin Usaha': 'KEP-SANITIZED-001',
    'Tanggal Izin Usaha': '45292', Alamat: 'Alamat 1', Kota: 'Jakarta', 'Kode Pos': '00123',
    'Nomor Telepon 1': '021000000', 'Nomor Telepon 2': '', 'Nomor Fax': '',
    'Alamat Email': 'broker1@example.invalid', Website: 'https://example.invalid',
  };
  const missingStatus = bulk.reviewBrokerBulkRows([first], [], null);
  assert.equal(missingStatus.errorCount, 1);
  assert.match(missingStatus.issues[0].message, /tidak memiliki kolom status/i);

  const duplicates = bulk.reviewBrokerBulkRows([
    first,
    { ...first, Nomor: '2', 'Nama Perusahaan': 'PT BROKER SANITIZED TWO' },
  ], [], 'Inactive');
  assert.equal(duplicates.errorCount, 2);
  assert.ok(duplicates.issues.filter(issue => /Nomor izin usaha duplikat/i.test(issue.message)).length >= 2);

  const valid = bulk.reviewBrokerBulkRows([first], [], 'Inactive');
  assert.equal(valid.addCount, 1);
  assert.equal(valid.errorCount, 0);
  assert.equal(valid.rows[0].postalCode, '00123');
});

test('server contract is Marketing Administration scoped, atomic add-only and idempotent', () => {
  assert.match(sql, /can_bulk_manage_intermediary_master/);
  assert.match(sql, /lower\(trim\(coalesce\(p\.department, ''\)\)\) = 'marketing administration'/i);
  assert.match(sql, /bulk_add_master_agents/);
  assert.match(sql, /bulk_add_master_brokers/);
  assert.match(sql, /Full preflight before any INSERT/);
  assert.match(sql, /v_skipped := v_skipped \+ 1/);
  assert.match(sql, /AGT-BULK-/);
  assert.match(sql, /BRK-BULK-/);
  assert.doesNotMatch(sql, /\bupdate\s+public\.master_(agents|brokers)\b/i);
  assert.doesNotMatch(sql, /\bdelete\s+from\s+public\.master_(agents|brokers)\b/i);
  assert.match(sql, /revoke all on function public\.bulk_add_master_agents/);
  assert.match(sql, /revoke all on function public\.bulk_add_master_brokers/);
});

test('UI keeps manual workflow separate and exposes safe preview-only bulk route', () => {
  assert.match(app, /MasterIntermediaryBulkImportPage/);
  assert.match(app, /MarketingAdministrationOnly/);
  assert.match(app, /path="\/master-intermediary-import"/);
  assert.match(sidebar, /Import Agent & Broker/);
  assert.match(sidebar, /marketing administration/);
  assert.match(page, /reviewAgentBulkRows/);
  assert.match(page, /reviewBrokerBulkRows/);
  assert.match(page, /window\.confirm/);
  assert.match(page, /Download Error Report/);
  assert.match(page, /Import Data Baru/);
  assert.match(page, /Tambah\/Edit/);
  assert.doesNotMatch(page, /localStorage|sessionStorage/);
  assert.doesNotMatch(page, /Daftar Agent\.xlsx|Daftar Broker\.xlsx/);
});
