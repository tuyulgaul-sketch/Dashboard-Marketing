import assert from 'node:assert/strict';

const replaceOnce = (source, before, after, label) => {
  assert.equal(source.split(before).length - 1, 1, `${label}: expected exactly one original anchor`);
  return source.replace(before, after);
};

/** The historical source-integrity test must account for the approved Advisor
 * extension without relaxing checks on any unrelated production functionality.
 * This pure transform is deliberately anchored to the original source. */
export const advisorProductionPageTransform = original => {
  let result = replaceOnce(original,
    "SPREADSHEET_ACCEPT, resolveMarketingOwner } from '@/utils/marketingWorkbook';",
    "SPREADSHEET_ACCEPT, resolveMarketingOwner, normalizeMarketingFunction } from '@/utils/marketingWorkbook';",
    'shared reporting function import');
  const normalizer = /const normalizeMarketingFunction = \([\s\S]*?\n};\n\nconst periodLabel =/;
  assert.equal((result.match(normalizer) || []).length, 1, 'Expected one legacy function normalizer');
  result = result.replace(normalizer, 'const periodLabel =');
  result = replaceOnce(result,
    "'Fungsi Marketing harus Captive Marketing atau Corporate & Retail Marketing'",
    "'Fungsi Marketing harus Captive Marketing, Corporate & Retail Marketing, atau Advisor'",
    'production validation message');
  const assertion = /marketingFunction:\s*functionValue as\s*\| 'Captive Marketing'\s*\| 'Corporate & Retail Marketing',/;
  assert.equal((result.match(assertion) || []).length, 1, 'Expected one narrow reporting type assertion');
  return result.replace(assertion, 'marketingFunction: functionValue,');
};
