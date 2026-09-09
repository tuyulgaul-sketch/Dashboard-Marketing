import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const Module = require('node:module');
require.extensions['.ts'] = (mod, filename) => {
  mod._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText, filename);
};
const load = path => {
  const filename = resolve(path);
  const mod = new Module(filename);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(dirname(filename));
  require.cache[filename] = mod;
  mod._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText, filename);
  return mod.exports;
};
const workbook = load('src/utils/marketingWorkbook.ts');
const targets = load('src/utils/targetCompact.ts');
const user = (id, role, unit, superiorId = 'USR-100001', status = 'Active') => ({
  id, name: `Dummy ${id}`, role, unit, superiorId, status, position: role, department: 'None',
});
const director = user('USR-100001', 'DIRECTOR_MARKETING', 'Direktorat Pemasaran', null);
const advisor = user('USR-100002', 'ADVISOR_MARKETING_DIRECTOR', 'Advisor Pemasaran');
const captive = user('USR-100003', 'VP_CAPTIVE_MARKETING', 'Captive Marketing');
const support = user('USR-100024', 'TEAM_LEADER_MARKETING_SUPPORT', 'Marketing Support');
const users = [director, advisor, captive, support];

test('Advisor aliases normalize to one reporting group', () => {
  for (const label of ['Advisor', 'advisor pemasaran', 'Advisor Marketing', 'Advisor to Direktur Pemasaran']) {
    assert.equal(workbook.normalizeMarketingFunction(label), 'Advisor');
  }
  assert.equal(workbook.normalizeMarketingFunction('Captive Marketing'), 'Captive Marketing');
  assert.equal(workbook.normalizeMarketingFunction('Corporate & Retail Marketing'), 'Corporate & Retail Marketing');
  assert.equal(workbook.normalizeMarketingFunction('Marketing Support'), null);
});

test('production owner resolves active Advisor by canonical UserID, not display name', () => {
  const result = workbook.resolveMarketingOwner(' usr-100002 ', users, { unit: 'Advisor', production: true, name: 'Different display name' });
  assert.equal(result.user?.id, advisor.id);
  assert.deepEqual(result.errors, []);
  assert.equal(result.warnings.length, 1);
  const currentDirectoryAdvisor = { ...advisor, unit: 'Directorate Marketing' };
  assert.equal(workbook.resolveMarketingOwner(advisor.id, [director, currentDirectoryAdvisor, captive], { unit: 'Advisor', production: true }).user?.id, advisor.id);
});

test('Advisor exception does not widen ownership or publisher privileges', () => {
  assert.ok(workbook.resolveMarketingOwner(advisor.id, users, { unit: 'Captive Marketing', production: true }).errors.length);
  assert.ok(workbook.resolveMarketingOwner('USR-999999', users, { production: true }).errors.length);
  assert.ok(workbook.resolveMarketingOwner(advisor.id, users.map(u => u.id === advisor.id ? { ...u, status: 'Inactive' } : u), { production: true }).errors.length);
  assert.ok(workbook.resolveMarketingOwner(support.id, users, { production: true }).errors.length);
  assert.ok(workbook.resolveMarketingOwner(director.id, users, { production: true }).errors.length);
  assert.equal(workbook.resolveMarketingOwner(captive.id, users, { unit: 'Captive Marketing', production: true }).user?.id, captive.id);
  const page = readFileSync('src/pages/ProduksiPage.tsx', 'utf8');
  assert.match(page, /publisherAuthorized && currentUser\.id ===/);
  assert.match(page, /resolveMarketingOwner\(record\.picUserId, latestUsers/);
  assert.doesNotMatch(page, /User ID.*USR-000002.*(?:return|allow)/);
});

test('compact target retains Advisor personal allocation and separate director cascading', () => {
  const holders = [director, advisor, captive];
  const rows = targets.buildCompactTargetTemplateRows(holders, 2026);
  assert.equal(rows.length, 72);
  const advisorRow = rows.find(row => row['User ID Penerima'] === advisor.id && row.Periode === '3' && row['NB/RN'] === 'NB');
  advisorRow['Target (Rp)'] = '100000000';
  const expanded = targets.expandCompactTargetRows(rows, holders, 2026);
  const byId = id => expanded.find(row => row['User ID Penerima'] === id);
  assert.equal(byId(advisor.id)['Target Pribadi NB'], '100000000');
  assert.equal(byId(advisor.id)['Target Tahunan NB'], '100000000');
  assert.equal(byId(director.id)['Target Tahunan NB'], '100000000');
  assert.equal(byId(captive.id)['Target Tahunan NB'], '0');
  assert.equal(byId(advisor.id)['Maret NB'], '100000000');
});
