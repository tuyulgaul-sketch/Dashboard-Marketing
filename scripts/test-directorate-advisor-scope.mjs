import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import ts from 'typescript';
import { advisorReaderScopeTransform } from './approved-directorate-scope-transform.mjs';

const require = createRequire(import.meta.url);
const read = path => readFileSync(path, 'utf8');
const BASE = '0f5610a4c542e784064b4e172664d6e6d791ac6a';
const pagePath = 'src/pages/DirectoratePerformancePage.tsx';
const servicePath = 'src/services/directoratePerformanceService.ts';
const git = path => execFileSync('git', ['show', `${BASE}:${path}`], { encoding: 'utf8' });
const load = (path, mocks = {}) => {
  const filename = resolve(path) + '.test.cjs';
  const code = ts.transpileModule(read(path), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText;
  const Module = require('node:module');
  const mod = new Module(filename);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(resolve('.'));
  const originalRequire = mod.require.bind(mod);
  mod.require = id => Object.prototype.hasOwnProperty.call(mocks, id) ? mocks[id] : originalRequire(id);
  mod._compile(code, filename);
  return mod.exports;
};

const target = (unit, department, nb, rn) => ({
  year: 2026, unit, department, annualNB: nb, annualRN: rn, annualTotal: nb + rn,
  monthlyNB: [nb, ...Array(11).fill(0)], monthlyRN: [rn, ...Array(11).fill(0)], publishedAt: null,
});
const production = (id, unit, department, businessType, amount, month, productName, transactionCount) => ({
  id, year: 2026, month, unit, department, businessType, amount, productName, transactionCount,
});
const snapshot = {
  refreshedAt: '2026-09-09T07:00:00Z',
  targets: [
    target('Advisor', 'None', 100, 20),
    target('Captive Marketing', 'Captive I', 200, 30),
    target('Corporate & Retail Marketing', 'CRM I', 300, 40),
    target('Directorate Marketing', 'None', 50, 10),
  ],
  summaries: [
    production('a1', 'Advisor', 'None', 'New Business', 70, 1, 'MAPS', 3),
    production('a2', 'Advisor', 'None', 'Renewal Business', 15, 2, 'MAPS', 2),
    production('a3', 'Advisor', 'None', 'New Business', -5, 2, 'Other', 1),
    production('c1', 'Captive Marketing', 'Captive I', 'New Business', 40, 1, 'MAPS', 4),
    production('r1', 'Corporate & Retail Marketing', 'CRM I', 'Renewal Business', 25, 2, 'Other', 5),
    { ...production('old', 'Advisor', 'None', 'New Business', 999, 1, 'MAPS', 1), year: 2025 },
  ],
  batches: [{ id: 'b1', uploadedAt: '2026-09-09T07:00:00Z', uploadedByName: 'Publisher', filename: 'dummy.xlsx', publishedPeriodKeys: ['2026-01'], totalProductionAmount: 9999, validRowCount: 100 }],
};
const service = load(servicePath, { '@/lib/supabase': { supabase: { rpc: async () => ({ data: snapshot, error: null }) } } });

test('reader change is exactly the approved dropdown extension', () => {
  const source = read(pagePath);
  assert.equal(source, advisorReaderScopeTransform(git(pagePath)));
  assert.equal(read(servicePath), git(servicePath), 'Existing aggregation and RPC remain unchanged.');
  assert.match(source, /new Set<string>\(\['Advisor', 'Captive Marketing', 'Corporate & Retail Marketing'\]\)/);
  assert.match(source, /<SelectItem value="ALL">Seluruh Direktorat<\/SelectItem>/);
  assert.match(source, /scopes\.map\(value => <SelectItem key=\{value\} value=\{value\}>\{value\}<\/SelectItem>\)/);
  assert.match(source, /buildPerformanceSummary\(snapshot, year, scope, business\)/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|applyCentralBusinessChanges|publishOfficialProductionSnapshot|publishTargetBatch|service_role/);
});

test('Advisor scope isolates its official values and keeps Captive/CRM separate', () => {
  const advisor = service.buildPerformanceSummary(snapshot, 2026, 'Advisor', 'OVERALL');
  assert.equal(advisor.annualTarget, 120);
  assert.equal(advisor.actual, 80);
  assert.equal(advisor.nb, 65);
  assert.equal(advisor.rn, 15);
  assert.equal(advisor.transactions, 6);
  assert.equal(advisor.monthly[0].actual, 70);
  assert.equal(advisor.monthly[1].actual, 10);
  assert.equal(advisor.achievement, 80 / 120 * 100);
  assert.deepEqual(advisor.productions.map(row => row.id), ['a1', 'a2', 'a3']);
  assert.equal(service.buildPerformanceSummary(snapshot, 2026, 'Captive Marketing', 'OVERALL').actual, 40);
  assert.equal(service.buildPerformanceSummary(snapshot, 2026, 'Corporate & Retail Marketing', 'OVERALL').actual, 25);
  assert.equal(service.matchesPerformanceScope({ unit: 'Advisor', department: 'None' }, 'Captive Marketing'), false);
  assert.equal(service.matchesPerformanceScope({ unit: 'Advisor', department: 'None' }, 'Corporate & Retail Marketing'), false);
});

test('Seluruh Direktorat includes Advisor exactly once in all totals, months and source rows', () => {
  const all = service.buildPerformanceSummary(snapshot, 2026, 'ALL', 'OVERALL');
  assert.equal(all.annualTarget, 750);
  assert.equal(all.actual, 145);
  assert.equal(all.nb, 105);
  assert.equal(all.rn, 40);
  assert.equal(all.transactions, 15);
  assert.equal(all.monthly.reduce((sum, row) => sum + row.actual, 0), all.actual);
  assert.equal(all.monthly.reduce((sum, row) => sum + row.transactions, 0), all.transactions);
  assert.equal(new Set(all.productions.map(row => row.id)).size, all.productions.length);
  assert.equal(all.actual, ['Advisor', 'Captive Marketing', 'Corporate & Retail Marketing'].reduce((sum, scope) => sum + service.buildPerformanceSummary(snapshot, 2026, scope, 'OVERALL').actual, 0));
  assert.equal(service.buildPerformanceSummary(snapshot, 2026, 'ALL', 'New Business').actual, 105);
  assert.equal(service.buildPerformanceSummary(snapshot, 2026, 'ALL', 'Renewal Business').actual, 40);
  assert.equal(service.buildPerformanceSummary(snapshot, 2026, 'Advisor', 'New Business', 'MAPS').actual, 70);
  assert.equal(service.buildPerformanceSummary(snapshot, 2026, 'Advisor', 'Renewal Business', 'MAPS').actual, 15);
  assert.equal(service.buildPerformanceSummary(snapshot, 2025, 'Advisor', 'OVERALL').actual, 999);
  assert.equal(service.buildPerformanceSummary(snapshot, 2027, 'Advisor', 'OVERALL').actual, 0);
  assert.equal(service.buildPerformanceSummary(snapshot, 2027, 'Advisor', 'OVERALL').achievement, null);
});
