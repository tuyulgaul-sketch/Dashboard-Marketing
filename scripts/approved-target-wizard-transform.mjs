import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';

const hub = 'src/pages/TargetRealizationUploadPage.tsx';
const oldImport = "import TargetOnScreenSetup from '@/components/rkap/TargetOnScreenSetup';";
const newImport = "import TargetOnScreenSetup from '@/components/rkap/TargetCascadingEntry';";
const once = (source, before, after) => {
  assert.equal(source.split(before).length, 2, `Approved source anchor must occur exactly once: ${before}`);
  return source.replace(before, after);
};
/** This one import is the complete approved change to the existing upload hub. */
export const wizardHubTransform = source => once(source, oldImport, newImport);
export const assertWizardHub = (actual, approved) => {
  assert.equal(actual, wizardHubTransform(approved), 'Only the approved target wizard entry is allowed to change the existing upload hub.');
};

/** Legacy navigation tests are pinned to an older release. Extend only their expected hub. */
export const prepareNavigationFixture = source => {
  let value = once(source,
    "import { advisorProductionPageTransform } from './approved-advisor-production-transform.mjs';",
    "import { advisorProductionPageTransform } from './approved-advisor-production-transform.mjs';\nimport { wizardHubTransform } from './approved-target-wizard-transform.mjs';");
  value = once(value, '    const expected = matrixTransforms[path]', '    const expectedBase = matrixTransforms[path]');
  value = once(value,
    '          : transform(original);\n    assert.equal(read(path), expected,',
    `          : transform(original);\n    const expected = path === '${hub}' ? wizardHubTransform(expectedBase) : expectedBase;\n    assert.equal(read(path), expected,`);
  return value;
};

if (process.argv[1]?.endsWith('approved-target-wizard-transform.mjs')) {
  if (process.argv[2] !== 'navigation') throw new Error('Only the navigation fixture may be updated.');
  const path = 'scripts/test-target-realization-navigation.mjs';
  writeFileSync(path, prepareNavigationFixture(readFileSync(path, 'utf8')));
  console.log('Approved target wizard navigation fixture installed; runtime source unchanged.');
}
