import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { getHandoverSubmissionTime, sortHandoversBySubmission } from '../src/lib/documentHandoverSort.ts';

const receipt = (id, submittedAt, extra = {}) => ({ id, submittedAt, handoverDate: '2026-09-07', status: 'DITERIMA', ...extra });
const ids = rows => rows.map(row => row.id);

test('newest actual submission wins over handover date, ID and input order', () => {
  const rows = [receipt('TRM-001', '2026-09-06T23:00:00Z', { handoverDate: '2026-09-07' }), receipt('TRM-999', '2026-09-05T12:00:00Z'), receipt('TRM-002', '2026-09-07T01:00:00+07:00')];
  assert.deepEqual(ids(sortHandoversBySubmission(rows)), ['TRM-001', 'TRM-002', 'TRM-999']);
  assert.deepEqual(ids(rows), ['TRM-001', 'TRM-999', 'TRM-002']);
});

test('timestamps compare absolute instants across timezone offsets', () => {
  const rows = [receipt('A', '2026-09-07T08:00:00+07:00'), receipt('B', '2026-09-07T02:30:00Z'), receipt('C', '2026-09-07T08:00:00Z')];
  assert.deepEqual(ids(sortHandoversBySubmission(rows)), ['C', 'B', 'A']);
});

test('same instant has deterministic ID order regardless of incoming order', () => {
  const rows = [receipt('B', '2026-09-07T08:00:00+07:00'), receipt('A', '2026-09-07T01:00:00Z')];
  assert.deepEqual(ids(sortHandoversBySubmission(rows)), ['A', 'B']);
  assert.deepEqual(ids(sortHandoversBySubmission([...rows].reverse())), ['A', 'B']);
});

test('missing or invalid timestamps go last without inventing submission dates', () => {
  const rows = [receipt('Z', undefined), receipt('C', 'not-a-date'), receipt('A', '2026-09-07T10:00:00Z'), receipt('B', null)];
  assert.deepEqual(ids(sortHandoversBySubmission(rows)), ['A', 'B', 'C', 'Z']);
  for (const value of [undefined, null, '', '  ', 'not-a-date']) assert.equal(getHandoverSubmissionTime(value), null);
});

test('resubmission uses the current cycle timestamp, not the original registry date', () => {
  const older = receipt('TRM-001', '2026-09-01T10:00:00Z');
  const newer = receipt('TRM-002', '2026-09-06T10:00:00Z');
  const resent = { ...older, submittedAt: '2026-09-07T10:00:00Z', cycleNumber: 2 };
  assert.deepEqual(ids(sortHandoversBySubmission([newer, resent])), ['TRM-001', 'TRM-002']);
  assert.equal(resent.cycleNumber, 2);
});

test('filtering retains submission order and does not mutate records', () => {
  const rows = Object.freeze([receipt('B', '2026-09-05T10:00:00Z', { status: 'DITERIMA' }), receipt('A', '2026-09-07T10:00:00Z', { status: 'MENUNGGU PENERIMAAN' }), receipt('C', '2026-09-06T10:00:00Z', { status: 'DITERIMA' })]);
  assert.deepEqual(ids(sortHandoversBySubmission(rows.filter(row => row.status === 'DITERIMA'))), ['C', 'B']);
  assert.deepEqual(ids(sortHandoversBySubmission(rows)), ['A', 'C', 'B']);
  assert.deepEqual(ids(rows), ['B', 'A', 'C']);
});

test('production registry UI uses the shared ordering and shows the submission timestamp', () => {
  const source = readFileSync('src/pages/TandaTerimaV14Page.tsx', 'utf8');
  assert.match(source, /return sortHandoversBySubmission\(receipts\.filter\(/);
  assert.match(source, /Tanggal Submission/);
  assert.match(source, /formatDateTime\(\s*receipt\.submittedAt\s*\)/);
  assert.match(source, /Tanggal penyerahan:/);
  assert.match(source, /filteredReceipts\.map\(/);
  assert.match(source, /getVisibleDocumentHandoversV14\(/);
  assert.match(source, /getDocumentHandoverHistoryV14\(/);
});
