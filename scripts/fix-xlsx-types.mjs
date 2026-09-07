import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
const path = 'src/utils/marketingWorkbook.ts';
const source = readFileSync(path, 'utf8');
const before = "    if ('text' in value) return value.text;\n    if ('hyperlink' in value) return value.text;";
assert.equal(source.split(before).length, 2, 'Expected one cell-value branch');
writeFileSync(path, source.replace(before, "    if ('text' in value) return value.text;"));
console.log('Removed unreachable ExcelJS cell-value branch.');
