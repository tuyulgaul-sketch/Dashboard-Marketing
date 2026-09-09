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

/** The archive fixture first reconstructs its historical page, then applies the new entry. */
export const prepareArchiveFixture = source => {
  let value = once(source,
    "import { execFileSync } from 'node:child_process';",
    "import { execFileSync } from 'node:child_process';\nimport { wizardHubTransform } from './approved-target-wizard-transform.mjs';");
  value = once(value,
    'assert.equal(read(hub), workspaceHubTransform(onscreenHubTransform(archiveHubTransform(baseline))),',
    'assert.equal(read(hub), wizardHubTransform(workspaceHubTransform(onscreenHubTransform(archiveHubTransform(baseline)))),');
  value = once(value,
    "import { archiveHubTransform, onscreenHubTransform, workspaceHubTransform } from './prepare-official-archive-regression.mjs';",
    "import { archiveHubTransform, onscreenHubTransform, workspaceHubTransform } from './prepare-official-archive-regression.mjs';\nimport { wizardHubTransform } from './approved-target-wizard-transform.mjs';");
  value = once(value,
    "? workspaceHubTransform(onscreenHubTransform(archiveHubTransform(expectedBase))) : expectedBase;",
    "? wizardHubTransform(workspaceHubTransform(onscreenHubTransform(archiveHubTransform(expectedBase)))) : expectedBase;");
  return value;
};

if (process.argv[1]?.endsWith('approved-target-wizard-transform.mjs')) {
  const mode = process.argv[2];
  if (mode === 'navigation') {
    const path = 'scripts/test-target-realization-navigation.mjs';
    writeFileSync(path, prepareNavigationFixture(readFileSync(path, 'utf8')));
  } else if (mode === 'archive') {
    const path = 'scripts/prepare-official-archive-regression.mjs';
    writeFileSync(path, prepareArchiveFixture(readFileSync(path, 'utf8')));
  } else throw new Error('Choose navigation or archive fixture mode.');
  console.log(`Approved target wizard ${mode} fixture installed; runtime source unchanged.`);
}
