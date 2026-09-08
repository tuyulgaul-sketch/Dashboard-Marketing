import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const BASE = 'a08fbea14a7ef23255abfb2a088df305e28b5c9f';
const read = path => readFileSync(path, 'utf8');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });
const replaceOnce = (source, before, after) => {
  assert(source.includes(before), `Missing test fixture anchor: ${before.slice(0, 80)}`);
  assert.equal(source.split(before).length, 2, 'Test fixture anchor is not unique.');
  return source.replace(before, after);
};
const changes = {
  'scripts/test-marketing-xlsx.mjs': original => {
    let source = replaceOnce(original,
      "const workbook = loadTs('src/utils/marketingWorkbook.ts', { './excelExport': csv });",
      "const compact = loadTs('src/utils/targetCompact.ts');\nconst workbook = loadTs('src/utils/marketingWorkbook.ts', { './excelExport': csv, './targetCompact': compact });");
    const oldTarget = `const target = Object.fromEntries(workbook.getMarketingTemplateHeaders('target').map(header => [header, header === 'Tahun' ? 2026 : '']));
target['User ID Penerima'] = 'USR-000025';
target['Nama Penerima'] = 'Marketing A';
target['Target Tahunan'] = 150000000;
await roundtrip('target', [target], workbook.getMarketingTemplateHeaders('target'));`;
    const newTarget = `const target = { Tahun: 2026, 'User ID Penerima': 'USR-000025', Periode: 8, 'NB/RN': 'NB', 'Target (Rp)': 150000000 };
const targetRoundtrip = await roundtrip('target', [target], workbook.getMarketingTemplateHeaders('target'));
assert.equal(targetRoundtrip.actual.worksheets[0].getCell('C2').value, 8);
assert.equal(targetRoundtrip.actual.worksheets[0].getCell('D2').value, 'NB');
assert.equal(targetRoundtrip.actual.worksheets[0].getCell('E2').value, 150000000);
assert.ok(targetRoundtrip.actual.worksheets[0].getCell('C2').dataValidation.formulae.length);
assert.ok(targetRoundtrip.actual.worksheets[0].getCell('D2').dataValidation.formulae.length);`;
    return replaceOnce(source, oldTarget, newTarget);
  },
  'scripts/test-target-realization-navigation.mjs': original => {
    let source = replaceOnce(original,
      "import { FINAL_TRANSFORMS } from './integrate-target-realization-v2.mjs';",
      "import { FINAL_TRANSFORMS } from './integrate-target-realization-v2.mjs';\nimport { COMPACT_BASE, compactTargetTransform } from './integrate-compact-target.mjs';");
    const oldExpected = `    const expected = ['src/pages/TargetRkapPage.tsx', 'src/pages/ProduksiPage.tsx'].includes(path)
      ? git('show', \`\${xlsxBaseline}:\${path}\`)
      : transform(original);`;
    const newExpected = `    const expected = path === 'src/pages/TargetRkapPage.tsx'
      ? compactTargetTransform[path](git('show', \`\${COMPACT_BASE}:\${path}\`))
      : path === 'src/pages/ProduksiPage.tsx'
        ? git('show', \`\${xlsxBaseline}:\${path}\`)
        : transform(original);`;
    return replaceOnce(source, oldExpected, newExpected);
  },
};
for (const [path, transform] of Object.entries(changes)) {
  const original = git('show', `${BASE}:${path}`);
  assert.equal(read(path), original, `${path} changed since the pinned release`);
  writeFileSync(path, transform(original));
  console.log(`Updated only approved regression fixture: ${path}`);
}
