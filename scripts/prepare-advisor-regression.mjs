import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { advisorProductionPageTransform } from './approved-advisor-production-transform.mjs';

const path = 'scripts/test-target-realization-navigation.mjs';
const current = readFileSync(path, 'utf8');
const beforeImport = "import { MATRIX_BASE, matrixTransforms } from './integrate-rkap-pipeline-matrix.mjs';";
const afterImport = beforeImport + "\nimport { advisorProductionPageTransform } from './approved-advisor-production-transform.mjs';";
const beforeExpected = "? git('show', `${xlsxBaseline}:${path}`)";
const afterExpected = "? advisorProductionPageTransform(git('show', `${xlsxBaseline}:${path}`))";
const hubPath = 'src/pages/TargetRealizationUploadPage.tsx';
const approvedMain = '8120adfa0e9183843924b9fb43496abf7b028945';
const hubExpected = `: path === '${hubPath}'\n          ? git('show', \`${approvedMain}:\${path}\`)\n          : transform(original);`;
const once = (text, before, after) => {
  assert.equal(text.split(before).length - 1, 1, `Expected one historical regression anchor: ${before}`);
  return text.replace(before, after);
};
const git = (revision, file) => execFileSync('git', ['show', `${revision}:${file}`], { encoding: 'utf8' });
let updated = current;
if (!updated.includes(afterImport)) updated = once(updated, beforeImport, afterImport);
if (!updated.includes(afterExpected)) updated = once(updated, beforeExpected, afterExpected);
// PR #49 does not change the upload workspace. Pin the complete existing
// approved main version, including on-screen setup, archive and workspace
// continuity, instead of incorrectly comparing it with the old three-tab UI.
const oldTail = ': transform(original);';
if (!updated.includes(hubExpected)) updated = once(updated, oldTail, hubExpected);
assert.ok(updated.includes(afterImport) && updated.includes(afterExpected) && updated.includes(hubExpected));
const productionBaseline = git('76c655d4adadd42f0e5388e1729aa120afdb0c2d', 'src/pages/ProduksiPage.tsx');
assert.equal(readFileSync('src/pages/ProduksiPage.tsx', 'utf8'), advisorProductionPageTransform(productionBaseline));
assert.equal(readFileSync(hubPath, 'utf8'), git(approvedMain, hubPath), 'The approved upload workspace must remain unchanged');
if (updated !== current) writeFileSync(path, updated);
console.log('Historical source integrity preserves the exact approved Advisor extension and unchanged upload workspace.');
