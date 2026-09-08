import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Module from 'node:module';
import { resolve, dirname } from 'node:path';
import ts from 'typescript';

const loadTs = path => {
  const filename = resolve(path);
  const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } });
  const mod = new Module(filename);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(dirname(filename));
  mod._compile(compiled.outputText, filename);
  return mod.exports;
};
const compact = loadTs('src/utils/targetCompact.ts');
const user = (id, role, superiorId, status = 'Active') => ({ id, name: `User ${id}`, role, superiorId, status, position: role, unit: 'Captive Marketing', department: 'Captive I' });
const users = [
  user('USR-000001','DIRECTOR_MARKETING',null),
  user('USR-000002','ADVISOR_MARKETING_DIRECTOR','USR-000001'),
  user('USR-000003','VP_CAPTIVE_MARKETING','USR-000001'),
  user('USR-000004','DEPARTMENT_HEAD_MARKETING','USR-000003'),
  user('USR-000005','STAFF_MARKETING','USR-000004'),
  user('USR-000006','STAFF_MARKETING','USR-000004','Inactive'),
];
const template = compact.buildCompactTargetTemplateRows(users, 2026);
assert.deepEqual(compact.COMPACT_TARGET_HEADERS, ['Tahun','User ID Penerima','Periode','NB/RN','Target (Rp)']);
assert.equal(template.length, 5 * 24);
assert.equal(template.filter(row => row['User ID Penerima'] === 'USR-000006').length, 0);
const rows = template.map(row => ({ ...row }));
const set = (id, period, kind, amount) => {
  const row = rows.find(row => row['User ID Penerima'] === id && row.Periode === String(period) && row['NB/RN'] === kind);
  assert(row);
  row['Target (Rp)'] = String(amount);
};
set('USR-000003',1,'NB',1000000);
set('USR-000004',1,'NB',2000000);
set('USR-000005',1,'NB',75020855059);
set('USR-000005',1,'RN',33243335874);
set('USR-000005',12,'NB',1);
const expanded = compact.normalizeTargetUploadRows(rows, users, 2026);
assert.equal(expanded.length, 5);
const find = id => expanded.find(row => row['User ID Penerima'] === id);
assert.equal(find('USR-000005')['Target Pribadi'], '108264190934');
assert.equal(find('USR-000004')['Target Tahunan'], '110264190934');
assert.equal(find('USR-000003')['Target Tahunan'], '111264190934');
assert.equal(find('USR-000001')['Target Tahunan'], '111264190934');
assert.equal(find('USR-000001')['Target Pribadi'], '0');
assert.equal(find('USR-000002')['Target Tahunan'], '0');
assert.equal(find('USR-000005')['Desember NB'], '1');
assert.equal(find('USR-000005')['Januari RN'], '33243335874');
assert.deepEqual(compact.LEGACY_TARGET_HEADERS, Object.keys(expanded[0]));
for (const row of expanded) {
  assert.equal(Number(row['Target Tahunan']), Number(row['Target Tahunan NB']) + Number(row['Target Tahunan RN']));
  assert.equal(Number(row['Target Pribadi']), Number(row['Target Pribadi NB']) + Number(row['Target Pribadi RN']));
  for (const kind of ['NB','RN']) {
    const monthly = compact.LEGACY_TARGET_HEADERS.filter(key => key.endsWith(` ${kind}`) && !key.startsWith('Target '));
    assert.equal(monthly.reduce((sum,key) => sum + Number(row[key]),0),Number(row[`Target Pribadi ${kind}`]));
  }
}
assert.equal(compact.parseExactTargetRupiah('1.234.567'),1234567);
assert.equal(compact.parseExactTargetRupiah('1,234,567'),1234567);
assert.equal(compact.parseExactTargetRupiah('1.234,00'),1234);
assert.equal(compact.parseExactTargetRupiah('0'),0);
assert.equal(compact.parseExactTargetRupiah('9007199254740991'),Number.MAX_SAFE_INTEGER);
for (const bad of ['',null,'-1','1.234,50','1,234.50','1,10046E+12','abc','9007199254740992']) assert.throws(() => compact.parseExactTargetRupiah(bad));
const invalid = (mutate, pattern) => {
  const copy = rows.map(row => ({ ...row }));
  mutate(copy);
  assert.throws(() => compact.normalizeTargetUploadRows(copy, users, 2026), pattern);
};
invalid(copy => copy[0].Tahun = '2027', /Tahun/);
invalid(copy => copy[0]['User ID Penerima'] = 'USR-999999', /tidak ditemukan/);
invalid(copy => copy[0]['User ID Penerima'] = 'USR-000006', /bukan pemilik/);
invalid(copy => copy[0].Periode = '0', /Periode/);
invalid(copy => copy[0].Periode = '13', /Periode/);
invalid(copy => copy[0].Periode = '1.5', /Periode/);
invalid(copy => copy[0]['NB/RN'] = 'OVERALL', /NB\/RN/);
invalid(copy => copy[0]['Target (Rp)'] = '', /Target/);
invalid(copy => copy[0]['Target (Rp)'] = '1E+12', /notasi ilmiah/);
invalid(copy => copy.push({ ...copy[0] }), /duplikat/);
invalid(copy => copy.splice(0,24), /belum tercakup/);
invalid(copy => { delete copy[0].Periode; }, /Kolom wajib/);
const sparse = rows.filter(row => row['Target (Rp)'] !== '0');
sparse.push(...users.filter(user => user.status === 'Active' && !sparse.some(row => row['User ID Penerima'] === user.id)).map(user => ({ Tahun:'2026','User ID Penerima':user.id,Periode:'1','NB/RN':'NB','Target (Rp)':'0' })));
assert.equal(compact.normalizeTargetUploadRows(sparse,users,2026).length,5);
assert.throws(() => compact.expandCompactTargetRows(rows,[...users,users[0]],2026),/duplikat/);
const cyclic = users.map(user => ({...user}));
cyclic.find(user => user.id === 'USR-000001').superiorId = 'USR-000005';
assert.throws(() => compact.expandCompactTargetRows(rows,cyclic,2026),/Siklus/);
const orphan = users.map(user => ({...user}));
orphan.find(user => user.id === 'USR-000005').superiorId = 'USR-999999';
assert.throws(() => compact.expandCompactTargetRows(rows,orphan,2026),/Atasan/);
const legacy = [{Tahun:'2026','User ID Penerima':'USR-000005','Target Tahunan':'100','Target Tahunan NB':'60','Target Tahunan RN':'40','Target Pribadi':'100','Target Pribadi NB':'60','Target Pribadi RN':'40','Januari NB':'60','Januari RN':'40'}];
assert.deepEqual(compact.normalizeTargetUploadRows(legacy,users,2026),legacy);
assert.throws(() => compact.normalizeTargetUploadRows([{Tahun:'2026','User ID Penerima':'USR-000005',Periode:'1'}],users,2026),/Kolom wajib/);
console.log('Compact target: exact monthly amounts, five-column contract, hierarchy rollup, duplicate/missing/invalid input rejection and legacy compatibility passed.');
