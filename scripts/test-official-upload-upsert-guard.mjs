import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = path => readFileSync(path, 'utf8');
const initial = read('supabase/migrations/20260907_official_upload_guard_v34.sql');
const correction = read('supabase/migrations/20260907_official_upload_upsert_guard_v34_1.sql');

for (const [label, sql] of [['fresh installation', initial], ['existing installation correction', correction]]) {
  test(`${label} checks actual inserts after conflict resolution`, () => {
    assert.match(sql, /create trigger central_official_performance_upload_insert_v34\s+after insert on public\.central_business_entities/i);
    assert.match(sql, /create trigger central_official_performance_upload_guard_v34\s+before update or delete on public\.central_business_entities/i);
    assert.doesNotMatch(sql, /create trigger[^;]*before insert/i);
    assert.match(sql, /drop trigger if exists central_official_performance_upload_guard_v34/);
  });
}

test('existing bulk pipeline progression stays permitted while new bulk uploads remain protected', () => {
  assert.match(initial, /v_old_source <> 'RKAP_BULK'/);
  assert.match(initial, /v_new_source = 'RKAP_BULK'/);
  assert.match(initial, /can_publish_marketing_targets\(\)/);
  assert.match(initial, /pertalife_official_production_summaries/);
  assert.match(initial, /pertalife_official_production_batches/);
  assert.match(correction, /execute function public\.guard_official_performance_upload_v34\(\)/);
  for (const sql of [initial, correction]) {
    assert.doesNotMatch(sql, /\btruncate\s+table|\bdelete\s+from\s+public\.profiles|\bupdate\s+public\.profiles|\bdrop\s+table/i);
  }
});
