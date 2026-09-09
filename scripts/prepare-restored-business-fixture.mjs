import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const base = '9bfee0235fd36b02c8f74577dc5bea66d52c4028';
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
// The shared focus bridge is intentionally changed by the approved continuity release.
snapshot['src/components/common/ReleaseSyncBridge.tsx'] = execFileSync('git', ['show', 'cd81205bc5783b4cabb533a4a3914fb90a40386b:src/components/common/ReleaseSyncBridge.tsx'], { encoding: 'utf8' });
for (const [path, expected] of Object.entries(snapshot)) {
  assert.equal(readFileSync(path, 'utf8'), expected, `Live feature changed: ${path}`);
}
writeFileSync('/tmp/restore-preserved-files.json', JSON.stringify(snapshot));
console.log('Preserved live feature fixture verified, including Tanda Terima photo preview.');
