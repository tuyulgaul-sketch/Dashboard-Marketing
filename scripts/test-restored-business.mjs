import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
const read = p => readFileSync(p, 'utf8');
const source = p => ts.createSourceFile(p, read(p), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const evaluatedArray = (file, name) => {
  const sf = source(file);
  let value;
  const visit = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(sf) === name) {
      const init = ts.isAsExpression(node.initializer) ? node.initializer.expression : node.initializer;
      assert(ts.isArrayLiteralExpression(init));
      value = init.elements.map(item => {
        if (ts.isStringLiteral(item)) return item.text;
        assert.fail(`Unexpected nonliteral in ${name}`);
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  assert(value, `Missing ${name}`);
  return value;
};
const service = 'src/services/centralBusinessService.ts';
const runtime = 'src/services/centralBusinessStorageRuntime.ts';
const app = read('src/App.tsx');
const sidebar = read('src/components/layout/AppSidebar.tsx');
const auth = read('src/contexts/AuthContext.tsx');

test('all ten restored collections are central and separate from live bootstrap', () => {
  const lite = evaluatedArray(service, 'LITE_BUSINESS_STORAGE_KEYS');
  const restored = evaluatedArray(service, 'RESTORED_BUSINESS_STORAGE_KEYS');
  assert.equal(lite.length, 8);
  assert.equal(restored.length, 10);
  assert.equal(new Set([...lite, ...restored]).size, 18);
  for (const key of ['pertalife_bookings','pertalife_pipelines','pertalife_appeals','pertalife_productions','pertalife_official_production_summaries','pertalife_official_production_batches','pertalife_official_policy_directory','pertalife_participants','pertalife_historical','pertalife_reimbursements']) assert(restored.includes(key));
  assert(!restored.includes('pertalife_approver_delegations'));
  assert.match(read(runtime), /const bootstrapLegacyCollections[\s\S]*?for \([\s\S]*?LITE_BUSINESS_STORAGE_KEYS/);
  assert.doesNotMatch(read(runtime).split('const bootstrapLegacyCollections')[1].split('export const syncCentralBusinessRuntime')[0], /RESTORED_BUSINESS_STORAGE_KEYS|CENTRAL_BUSINESS_STORAGE_KEYS/);
});

test('central catalogue fetches all pages rather than silently truncating at 1000', () => {
  const text = read(service);
  assert.match(text, /pageSize = 500/);
  assert.match(text, /\.order\('storage_key'/);
  assert.match(text, /\.order\('entity_id'/);
  assert.match(text, /\.range\(offset, offset \+ pageSize - 1\)/);
  assert.match(text, /if \(page\.length < pageSize\) break/);
});

test('previously capped pages are restored without replacing live feature routes', () => {
  for (const route of ['/target-rkap','/booking-pipeline','/produksi']) assert(app.includes(`path="${route}"`));
  for (const route of ['/aktivitas','/booking-ruang-meeting','/dokumen-pendukung','/tanda-terima','/administrasi']) assert(app.includes(`path="${route}"`));
  assert.match(app, /isCrossSupportAdminDocumentReader\(profile\)/);
  assert.match(app, /<RestoredBusinessGuard feature="DASHBOARD"><Index/);
  assert.match(app, /<TandaTerimaV14Page \/>/);
  assert.match(app, /<ReleaseSyncBridge \/>/);
});

test('desktop and mobile navigation retain existing modules and restore capped ones', () => {
  for (const path of ['/target-rkap','/booking-pipeline','/produksi','/booking-ruang-meeting','/tanda-terima','/dokumen-pendukung?area=administration','/dokumen-pendukung?area=marketing-tools','/dokumen-pendukung?area=marcomm-requests']) assert(sidebar.includes(path));
  assert.match(sidebar, /canAccessFeature\(profile, 'DASHBOARD'\)/);
  assert.match(sidebar, /canSeeBooking \? \[/);
  assert.match(sidebar, /canSeeProduction \? \[/);
  assert.match(sidebar, /isSupportRoot \? 'Target & RKAP' : 'Target Kinerja'/);
  assert.match(sidebar, /mobile = false/);
});

test('central master and target caches initialize for every dashboard profile', () => {
  assert.match(auth, /syncCentralMasterRuntime\(authProfile\)/);
  assert.match(auth, /syncCentralTargetRuntime\(authProfile\.id\)/);
  assert.match(auth, /canAccessFeature\(authProfile, 'DASHBOARD'\)/);
  assert.doesNotMatch(auth, /canAccessFeature\(authProfile, 'TARGET_RKAP'\)/);
  assert.match(auth, /clearCentralMasterRuntime\(\)/);
  assert.match(auth, /clearCentralTargetRuntime\(\)/);
  assert.match(auth, /await loadRestoredBusiness\(authProfile\)/);
  assert.match(auth, /restoredBusinessReady/);
  assert.match(read('src/components/common/RestoredBusinessGuard.tsx'), /if \(restoredBusinessReady\) return children/);
});

test('live never generates dummy business data or synthetic policy numbers', () => {
  const text = read(runtime);
  assert.match(text, /store\.getOfficialPolicyDirectory = \(\) => JSON\.parse/);
  assert.match(text, /store\.generateDummyData = \(\) =>/);
  assert.match(text, /Data dummy tidak tersedia/);
  assert.doesNotMatch(auth, /bootstrapCentralBusinessCollection\(/);
});

test('restoration preserves existing feature and security files byte for byte', () => {
  const snapshot = JSON.parse(readFileSync('/tmp/restore-preserved-files.json', 'utf8'));
  for (const [path, original] of Object.entries(snapshot)) assert.equal(read(path), original, `${path} must remain unchanged`);
});
