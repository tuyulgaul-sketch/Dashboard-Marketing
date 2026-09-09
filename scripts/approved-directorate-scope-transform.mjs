import assert from 'node:assert/strict';

/** Exact, additive reader-only extension. No publisher, authorization or financial data changes. */
export const advisorReaderScopeTransform = source => {
  const before = "const values = new Set<string>(['Captive Marketing', 'Corporate & Retail Marketing']);";
  const after = "const values = new Set<string>(['Advisor', 'Captive Marketing', 'Corporate & Retail Marketing']);";
  assert.equal(source.split(before).length, 2, 'The approved directorate scope anchor must occur exactly once.');
  return source.replace(before, after);
};
