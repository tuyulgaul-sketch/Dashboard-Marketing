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
const once = (text, before, after) => {
  assert.equal(text.split(before).length - 1, 1, `Expected one historical regression anchor: ${before}`);
  return text.replace(before, after);
};
let updated = current;
if (!updated.includes(afterImport)) updated = once(updated, beforeImport, afterImport);
if (!updated.includes(afterExpected)) updated = once(updated, beforeExpected, afterExpected);
assert.ok(updated.includes(afterImport) && updated.includes(afterExpected));
// Verify the extension against the pinned historical source before touching
// the test. All other source-integrity assertions remain byte-for-byte intact.
const baseline = execFileSync('git', ['show', '76c655d4adadd42f0e5388e1729aa120afdb0c2d:src/pages/ProduksiPage.tsx'], { encoding: 'utf8' });
assert.equal(readFileSync('src/pages/ProduksiPage.tsx', 'utf8'), advisorProductionPageTransform(baseline));
if (updated !== current) writeFileSync(path, updated);
console.log('Historical production source integrity now includes only the approved Advisor compatibility transform.');
