import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const save = (path, content) => writeFileSync(path, content);
const replaceOnce = (source, before, after, label) => {
  const count = source.split(before).length - 1;
  assert.equal(count, 1, `${label}: expected exactly one source anchor, found ${count}`);
  return source.replace(before, after);
};

// Keep the canonical User Master authoritative; never resolve an owner from a
// supplied display name or invent a new profile merely to make an upload pass.
const workbookPath = 'src/utils/marketingWorkbook.ts';
let workbook = read(workbookPath);
workbook = replaceOnce(workbook,
  "const PRODUCTION_UNITS = new Set(['Captive Marketing', 'Corporate & Retail Marketing']);",
  "export type MarketingProductionFunction = 'Captive Marketing' | 'Corporate & Retail Marketing' | 'Advisor';\nconst PRODUCTION_UNITS = new Set<MarketingProductionFunction>(['Captive Marketing', 'Corporate & Retail Marketing', 'Advisor']);",
  'production reporting groups');
workbook = replaceOnce(workbook,
  "  if (unit === 'captive marketing') return 'Captive Marketing';",
  "  if (unit === 'advisor' || unit === 'advisor pemasaran' || unit === 'advisor marketing' || unit === 'advisor to direktur pemasaran') return 'Advisor';\n  if (unit === 'captive marketing') return 'Captive Marketing';",
  'Advisor unit aliases');
workbook = replaceOnce(workbook,
  "  return String(value ?? '').trim();\n};\n\nexport interface OwnerResolution",
  "  return String(value ?? '').trim();\n};\n\nexport const normalizeMarketingFunction = (value: unknown): MarketingProductionFunction | null => {\n  const normalized = normalizeMarketingUnit(value);\n  if (PRODUCTION_UNITS.has(normalized as MarketingProductionFunction)) return normalized as MarketingProductionFunction;\n  return null;\n};\n\nexport interface OwnerResolution",
  'shared production function normalizer');
workbook = replaceOnce(workbook,
  "  if (options.production && !PRODUCTION_UNITS.has(normalizeMarketingUnit(user.unit))) {\n    errors.push(`User ID ${id} bukan pemilik realisasi Captive Marketing atau Corporate & Retail Marketing.`);\n  }\n  if (options.unit && normalizeMarketingUnit(options.unit) !== normalizeMarketingUnit(user.unit)) {\n    errors.push(`Fungsi Marketing tidak sesuai User ID ${id}. Seharusnya ${user.unit}.`);\n  }",
  "  const reportingUnit = user.role === 'ADVISOR_MARKETING_DIRECTOR' ? 'Advisor' : normalizeMarketingUnit(user.unit);\n  if (options.production && !PRODUCTION_UNITS.has(reportingUnit as MarketingProductionFunction)) {\n    errors.push(`User ID ${id} bukan pemilik realisasi Captive Marketing, Corporate & Retail Marketing, atau Advisor.`);\n  }\n  if (options.unit && normalizeMarketingUnit(options.unit) !== reportingUnit) {\n    errors.push(`Fungsi Marketing tidak sesuai User ID ${id}. Seharusnya ${reportingUnit}.`);\n  }",
  'canonical production owner validation');
save(workbookPath, workbook);

const pagePath = 'src/pages/ProduksiPage.tsx';
let page = read(pagePath);
page = replaceOnce(page,
  "SPREADSHEET_ACCEPT, resolveMarketingOwner } from '@/utils/marketingWorkbook';",
  "SPREADSHEET_ACCEPT, resolveMarketingOwner, normalizeMarketingFunction } from '@/utils/marketingWorkbook';",
  'production parser import');
const localNormalizer = /const normalizeMarketingFunction = \([\s\S]*?\n};\n\nconst periodLabel =/;
assert.equal((page.match(localNormalizer) || []).length, 1, 'Expected one legacy production function normalizer');
page = page.replace(localNormalizer, 'const periodLabel =');
page = replaceOnce(page,
  "'Fungsi Marketing harus Captive Marketing atau Corporate & Retail Marketing'",
  "'Fungsi Marketing harus Captive Marketing, Corporate & Retail Marketing, atau Advisor'",
  'production validation message');
const recordFunction = /marketingFunction:\s*functionValue as\s*\| 'Captive Marketing'\s*\| 'Corporate & Retail Marketing',/;
assert.equal((page.match(recordFunction) || []).length, 1, 'Expected one official production record type assertion');
page = page.replace(recordFunction, 'marketingFunction: functionValue,');
save(pagePath, page);

// Widen only the official production reporting-field types. Do not change
// product, business-type, transaction, role, or unrelated access-control enums.
const reportingType = /(marketingFunction\??:\s*)(?:\|\s*)?'Captive Marketing'\s*\|\s*'Corporate & Retail Marketing'/g;
let totalTypeChanges = 0;
for (const path of ['src/services/store.ts', 'src/types/index.ts']) {
  let content = read(path);
  const matches = [...content.matchAll(reportingType)];
  totalTypeChanges += matches.length;
  content = content.replace(reportingType, "$1'Captive Marketing' | 'Corporate & Retail Marketing' | 'Advisor'");
  if (path === 'src/services/store.ts') {
    const summaryUnit = /(unit:\s*)(?:\|\s*)?'Captive Marketing'\s*\|\s*'Corporate & Retail Marketing'/g;
    const unitMatches = [...content.matchAll(summaryUnit)];
    assert.ok(unitMatches.length >= 2, 'Expected official summary and aggregation unit types');
    content = content.replace(summaryUnit, "$1'Captive Marketing' | 'Corporate & Retail Marketing' | 'Advisor'");
  }
  save(path, content);
}
assert.ok(totalTypeChanges >= 4, 'Expected official import, summary, policy and aggregation reporting types');
console.log(`Advisor compatibility patch applied; ${totalTypeChanges} reporting-field type declarations updated.`);
