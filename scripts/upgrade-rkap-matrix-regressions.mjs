import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { MATRIX_BASE } from './integrate-rkap-pipeline-matrix.mjs';

const path = 'scripts/test-target-realization-navigation.mjs';
const original = execFileSync('git', ['show', `${MATRIX_BASE}:${path}`], { encoding: 'utf8' });
assert.equal(readFileSync(path, 'utf8'), original, 'Navigation regression changed since the pinned release.');
const once = (source, before, after) => {
  assert(source.includes(before), `Missing approved regression anchor: ${before.slice(0, 80)}`);
  assert.equal(source.split(before).length, 2, 'Regression anchor is not unique.');
  return source.replace(before, after);
};
let source = once(original,
  "import { COMPACT_BASE, compactTargetTransform } from './integrate-compact-target.mjs';",
  "import { COMPACT_BASE, compactTargetTransform } from './integrate-compact-target.mjs';\nimport { MATRIX_BASE, matrixTransforms } from './integrate-rkap-pipeline-matrix.mjs';");
source = once(source,
  `    const expected = path === 'src/pages/TargetRkapPage.tsx'
      ? compactTargetTransform[path](git('show', \`\${COMPACT_BASE}:\${path}\`))
      : path === 'src/pages/ProduksiPage.tsx'
        ? git('show', \`\${xlsxBaseline}:\${path}\`)
        : transform(original);`,
  `    const expected = matrixTransforms[path]
      ? matrixTransforms[path](git('show', \`\${MATRIX_BASE}:\${path}\`))
      : path === 'src/pages/TargetRkapPage.tsx'
        ? compactTargetTransform[path](git('show', \`\${COMPACT_BASE}:\${path}\`))
        : path === 'src/pages/ProduksiPage.tsx'
          ? git('show', \`\${xlsxBaseline}:\${path}\`)
          : transform(original);`);
writeFileSync(path, source);
console.log(`Updated approved regression fixture: ${path}`);

const testPath = 'scripts/test-rkap-pipeline-matrix.mjs';
const testSource = readFileSync(testPath, 'utf8');
const corrected = once(testSource,
  "await assert.rejects(() => marketing.readNativeXlsxRows(workbook.xlsx.writeBuffer(), { sheetName: 'Data Pipeline' }), /hasil tersimpan/);",
  "await assert.rejects(async () => marketing.readNativeXlsxRows(await workbook.xlsx.writeBuffer(), { sheetName: 'Data Pipeline' }), /hasil tersimpan/);");
writeFileSync(testPath, corrected);
console.log(`Corrected async XLSX regression fixture: ${testPath}`);

// Keep the existing subscription contract while making React's cleanup return void.
const componentPath = 'src/components/rkap/RkapPipelineMatrixUpload.tsx';
const component = readFileSync(componentPath, 'utf8');
const fixedComponent = once(component,
  '  useEffect(() => store.subscribe(() => setRevision(value => value + 1)), []);',
  '  useEffect(() => {\n    const unsubscribe = store.subscribe(() => setRevision(value => value + 1));\n    return () => { unsubscribe(); };\n  }, []);');
writeFileSync(componentPath, fixedComponent);
console.log(`Corrected React cleanup: ${componentPath}`);
