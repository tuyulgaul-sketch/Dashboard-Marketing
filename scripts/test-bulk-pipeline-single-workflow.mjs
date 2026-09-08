import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/components/rkap/RkapPipelineMatrixUpload.tsx', 'utf8');

assert.equal((source.match(/Import Bulk Pipeline RKAP Terpusat/g) || []).length, 1, 'Bulk Pipeline must expose exactly one primary import workflow');
assert.ok(!source.includes('Bulk Pipeline RKAP – Jadwal Premi Tahunan'), 'Duplicate upper Bulk Pipeline panel must be removed');
assert.ok(!source.includes('format Bulk Pipeline operasional lama'), 'Legacy disclosure must not be exposed as a second import panel');
assert.ok(!source.includes('TargetRkapPage'), 'Bulk Pipeline component must not mount the legacy publisher as a second workflow');

for (const contract of [
  'COMPACT_PIPELINE_REQUIRED',
  'normalizeCompactPipeline',
  'downloadCompactPipelineWorkbook',
  'makeCompactPipelineRecord',
  'waitForCentralBusinessStorageSync',
  'pipelineMatrixIdentity',
  'Currency',
  '1–12',
  'TOTAL PREMI',
  'UserID',
]) {
  assert.ok(source.includes(contract), `Compact pipeline contract missing: ${contract}`);
}

assert.ok(source.includes("actor.role !== 'TEAM_LEADER_MARKETING_SUPPORT'"), 'Publisher RBAC guard must remain');
assert.ok(source.includes('checkDuplicates'), 'Duplicate prevention must remain');
assert.ok(source.includes('review.signature'), 'Revalidation signature guard must remain');
assert.ok(source.includes('Data operasional yang belum diketahui tidak ditebak dari bulan premi'), 'No-inference rule must remain visible');
assert.ok(source.includes('Kurs resmi untuk nilai non-IDR'), 'Approved FX workflow must remain');

console.log('Bulk Pipeline is consolidated to one compact, guarded RKAP import workflow.');
