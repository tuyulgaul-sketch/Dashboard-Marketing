import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import ts from 'typescript';

const read = path => readFileSync(path, 'utf8');
const changes = [];
const replace = (source, before, after, label) => {
  assert.equal(source.split(before).length, 2, `${label}: expected one anchor`);
  return source.replace(before, after);
};
const transform = (path, fn) => {
  const before = read(path);
  const after = fn(before);
  assert.notEqual(after, before, `${path}: no change`);
  if (/\.(ts|tsx)$/.test(path)) {
    const sf = ts.createSourceFile(path, after, ts.ScriptTarget.Latest, true, path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    assert.equal(sf.parseDiagnostics.length, 0, `${path}: ${sf.parseDiagnostics.map(item => item.messageText).join('; ')}`);
  }
  changes.push([path, after]);
};
const initializer = (source, name, fn) => {
  const sf = ts.createSourceFile('source.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found = [];
  const visit = node => { if (ts.isVariableDeclaration(node) && node.name.getText(sf) === name && node.initializer) found.push(node); ts.forEachChild(node, visit); };
  visit(sf);
  assert.equal(found.length, 1, `Expected one declaration ${name}`);
  const init = found[0].initializer;
  return source.slice(0, init.getStart(sf)) + fn(init.getText(sf)) + source.slice(init.end);
};

transform('src/utils/marketingWorkbook.ts', source => {
  let next = replace(source, `export type SpreadsheetRow = Record<string, string>;`,
    `export type SpreadsheetRow = Record<string, string>;\nexport type MarketingTemplateRow = Record<string, string | number | boolean | null | undefined>;`, 'template row type');
  next = replace(next, `  rows: SpreadsheetRow[],\n  users: User[]\n): Promise<Uint8Array>`,
    `  rows: MarketingTemplateRow[],\n  users: User[]\n): Promise<Uint8Array>`, 'writer row type');
  next = replace(next, `  rows: SpreadsheetRow[],\n  users: User[],\n  filename: string`,
    `  rows: MarketingTemplateRow[],\n  users: User[],\n  filename: string`, 'download row type');
  next = replace(next, `  await workbook.xlsx.load(new Uint8Array(binary instanceof Uint8Array ? binary : binary) as Parameters<typeof workbook.xlsx.load>[0]);`,
    `  await workbook.xlsx.load(new Uint8Array(binary) as Parameters<typeof workbook.xlsx.load>[0]);`, 'native bytes');
  next = replace(next, `result === undefined || result === null || typeof result === 'object'`,
    `result === undefined || result === null || (typeof result === 'object' && !(result instanceof Date))`, 'cached date result');
  next = replace(next, `  const extension = file.name.split('.').pop()?.toLowerCase();`,
    `  const extension = file.name.split('.').pop()?.toLowerCase();\n  if (file.size === 0) throw new Error('File kosong.');`, 'empty file');
  next = replace(next, `  const sheet = options.sheetName ? workbook.getWorksheet(options.sheetName) : workbook.worksheets[0];`,
    `  const sheet = options.sheetName ? workbook.getWorksheet(options.sheetName) : workbook.worksheets[0];\n  if (sheet && (sheet.rowCount > 100001 || sheet.columnCount > 200)) throw new Error('Workbook melebihi batas 100.000 baris data atau 200 kolom.');`, 'workbook bounds');
  return next;
});

transform('src/pages/ProduksiPage.tsx', source => {
  let next = replace(source,
    `        const sourceHeaders = Array.from(new Set([...TEMPLATE_HEADERS, ...parsedData.flatMap(row => Object.keys(row))]));`,
    `        const sourceHeaders = Array.from(new Set(parsedData.flatMap(row => Object.keys(row))));`, 'preserve source columns');
  // Keep the existing ID-only lookup, block an invalid owner and preserve all official snapshot logic.
  assert.match(next, /resolveMarketingOwner\(ownerId, users/);
  assert.match(next, /picUserId:\s*picMatch!\.id/);
  assert.match(next, /validatedFile !== uploadFile/);
  next = next.replaceAll('Gunakan 9 kolom sesuai template Dashboard (termasuk Nomor Polis dan Nama Nasabah), lalu Save As CSV. Sistem menerima delimiter titik-koma maupun koma. File UAT lama 7 kolom tetap diterima dan akan dibuatkan Nomor Polis dummy.',
    'Gunakan template XLSX terbaru dengan User ID Pemilik Realisasi wajib. Sheet Daftar User ID hanya referensi; sistem membaca Data Realisasi. CSV tetap diterima jika memiliki User ID. Nama PIC tidak digunakan untuk menentukan pemilik.');
  next = next.replaceAll('snapshot CSV', 'snapshot XLSX').replaceAll('Template CSV', 'Template XLSX');
  return next;
});

transform('src/pages/TargetRkapPage.tsx', source => {
  let next = initializer(source, 'handleValidateBulkFile', init => {
    const pattern = /\s*if \(\s*inputPicName &&[\s\S]*?\n\s*\}\s*(?=if \(\s*inputUnit &&)/;
    const matches = [...init.matchAll(new RegExp(pattern.source, 'g'))];
    assert.equal(matches.length, 1, 'Only the obsolete name-based blocking check is removed');
    return init.replace(pattern, '\n\n');
  });
  assert.match(next, /resolveMarketingOwner\(picUserId/);
  assert.match(next, /targetValidatedFile !== targetFile/);
  assert.match(next, /bulkValidatedFile !== bulkFile/);
  return next;
});

transform('scripts/test-marketing-xlsx.mjs', source => replace(source,
  `actual.definedNames.getRanges('MarketingUserIDs').length`,
  `actual.definedNames.getRanges('MarketingUserIDs').ranges.length`, 'named range assertion'));

// All source anchors and syntax are checked before any file is written.
for (const [path, content] of changes) { writeFileSync(path, content); console.log(`Patched ${path}`); }
