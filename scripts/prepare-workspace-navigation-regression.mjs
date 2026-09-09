import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { prepareNavigationFixture } from './approved-target-wizard-transform.mjs';

const path = 'scripts/test-target-realization-navigation.mjs';
const authPath = 'src/contexts/AuthContext.tsx';
const approvedAuth = 'ff9de4cb51bac0a8fd95af12ad707310ebda8d5e';
const approvedRestoredTest = 'cd30d0291869e95e5554390eeee93fff2a510e6f';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });
const once = (source, before, after) => {
  assert.equal(source.split(before).length, 2, `Expected exactly one historical fixture anchor: ${before}`);
  return source.replace(before, after);
};

// Extend the old source-integrity test only. No runtime code or publisher
// permission is changed by this preparation.
const original = readFileSync(path, 'utf8');
let fixture = prepareNavigationFixture(original);
fixture = once(fixture,
  "'src/services/targetService.ts','src/contexts/AuthContext.tsx','src/pages/BookingPipelinePage.tsx'",
  "'src/services/targetService.ts','src/pages/BookingPipelinePage.tsx'");
fixture = once(fixture,
  "    const expected = path === 'src/pages/TargetRealizationUploadPage.tsx' ? wizardHubTransform(expectedBase) : expectedBase;",
  `    const expected = path === 'src/pages/TargetRealizationUploadPage.tsx' ? wizardHubTransform(expectedBase)
      : path === 'scripts/test-restored-business.mjs' ? git('show', '${approvedRestoredTest}:' + path)
      : expectedBase;`);
fixture = once(fixture,
  "  console.log('Existing business handlers, approvals, documents, TRM, auth and storage remain unchanged.');",
  `  assert.equal(read('${authPath}'), git('show', '${approvedAuth}:${authPath}'), 'Authenticated workspace continuity must match the approved release');
  console.log('Existing business handlers, approvals, documents, TRM and storage remain unchanged; approved auth continuity is pinned.');`);
writeFileSync(path, fixture);
console.log('Historical navigation fixture extended for approved wizard, auth and restored-business checks; runtime source unchanged.');
