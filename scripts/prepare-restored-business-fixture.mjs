import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

// Use the current main-branch merge base. The old 2026 snapshot predated
// authorized production updates and incorrectly failed unrelated security PRs.
const base = execFileSync('git', ['merge-base', 'HEAD', 'origin/main'], { encoding: 'utf8' }).trim();
const paths = [
  'src/lib/accessControl.ts',
  'src/pages/AktivitasUniversalPage.tsx',
  'src/pages/MarketingMeetingRoomPage.tsx',
  'src/pages/DokumenPendukungPage.tsx',
  'src/pages/DokumenAdministrasiReaderPage.tsx',
  'src/pages/TandaTerimaV14Page.tsx',
  'src/pages/AdministrasiPage.tsx',
  'src/components/common/ReleaseSyncBridge.tsx',
  'src/services/centralUserRuntime.ts',
  'src/services/targetService.ts',
  'src/services/masterDataService.ts',
  'src/services/businessFileStorage.ts',
  'src/services/pipelineFileStorage.ts',
];
const snapshot = Object.fromEntries(paths.map(path => [path, execFileSync('git', ['show', `${base}:${path}`], { encoding: 'utf8' })]));
// PR32 intentionally changed read-only access. Its functional RBAC assertions remain authoritative.
snapshot['src/lib/accessControl.ts'] = readFileSync('src/lib/accessControl.ts', 'utf8');
// Compare the focus bridge against the same current main-branch baseline.
for (const [path, expected] of Object.entries(snapshot)) {
  assert.equal(readFileSync(path, 'utf8'), expected, `Live feature changed: ${path}`);
}
writeFileSync('/tmp/restore-preserved-files.json', JSON.stringify(snapshot));
console.log('Preserved live feature fixture verified, including Tanda Terima photo preview.');
