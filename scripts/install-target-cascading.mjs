import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { brotliDecompressSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const original = 'src/components/rkap/TargetOnScreenSetup.tsx';
const legacy = 'src/components/rkap/LegacyTargetOnScreenSetup.tsx';
const expected = '766ab4d5a6d6f344c3a12821798cf4f6904f0daf';
assert.equal(execFileSync('git', ['hash-object', original], {encoding:'utf8'}).trim(), expected, 'The approved manual editor changed; inspect before applying the wizard.');
assert(!existsSync(legacy), 'Legacy editor already exists; refusing to overwrite.');
const compressed = readFileSync('scripts/target-cascading.bundle.br');
const raw = brotliDecompressSync(compressed);
const digest = createHash('sha256').update(raw).digest('hex');
assert.equal(digest, '01a6697c6d102d5f6a511fcfaa652c53b93ff65f6bccb8973395b703d372636a', 'Source bundle integrity mismatch.');
const payload = JSON.parse(raw.toString('utf8'));
assert.equal(payload.version, 1);
const allowed = new Set([
  'src/utils/targetCascadingWizard.ts',
  'src/components/rkap/TargetCascadingWizard.tsx',
  'src/components/rkap/TargetOnScreenSetup.tsx',
  'scripts/test-target-cascading.mjs',
]);
assert.deepEqual(Object.keys(payload.files).sort(), [...allowed].sort(), 'Unexpected source bundle contents.');
writeFileSync(legacy, readFileSync(original));
for (const [path, content] of Object.entries(payload.files)) {
  assert(typeof content === 'string', `Invalid source: ${path}`);
  mkdirSync(dirname(path), {recursive:true});
  writeFileSync(path, content);
}
const testPath = 'scripts/test-target-onscreen.mjs';
let tests = readFileSync(testPath,'utf8');
const before = "  const component=readFileSync('src/components/rkap/TargetOnScreenSetup.tsx','utf8');";
assert.equal(tests.split(before).length,2,'Pinned on-screen test anchor changed.');
tests = tests.replace(before, "  const component=readFileSync('src/components/rkap/LegacyTargetOnScreenSetup.tsx','utf8') + readFileSync('src/components/rkap/TargetOnScreenSetup.tsx','utf8') + readFileSync('src/components/rkap/TargetCascadingWizard.tsx','utf8');");
writeFileSync(testPath,tests);
console.log('Installed guided cascading wizard. Original manual editor preserved byte-for-byte.');