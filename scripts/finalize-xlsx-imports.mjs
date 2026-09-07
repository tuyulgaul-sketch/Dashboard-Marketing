import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import ts from 'typescript';

function once(source, before, after) {
  assert.equal(source.split(before).length, 2, `Expected one anchor: ${before.slice(0, 90)}`);
  return source.replace(before, after);
}
function between(source, start, end, replacement) {
  const a = source.indexOf(start);
  assert.ok(a >= 0 && source.indexOf(start, a + 1) < 0, `Expected one start: ${start}`);
  const b = source.indexOf(end, a + start.length);
  assert.ok(b > a, `Expected end: ${end}`);
  return source.slice(0, a) + replacement + source.slice(b);
}
function initializer(source, name, transform) {
  const sf = ts.createSourceFile('source.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found = [];
  function visit(node) { if (ts.isVariableDeclaration(node) && node.name.getText(sf) === name && node.initializer) found.push(node); ts.forEachChild(node, visit); }
  visit(sf);
  assert.equal(found.length, 1, `Declaration ${name}`);
  const init = found[0].initializer;
  return source.slice(0, init.getStart(sf)) + transform(init.getText(sf)) + source.slice(init.end);
}

function utility(source) {
  let next = once(source, `export type SpreadsheetRow = Record<string, string>;`, `export type SpreadsheetRow = Record<string, string>;\nexport type MarketingTemplateRow = Record<string, string | number | boolean | null | undefined>;`);
  next = once(next, `  rows: SpreadsheetRow[],\n  users: User[]\n): Promise<Uint8Array>`, `  rows: MarketingTemplateRow[],\n  users: User[]\n): Promise<Uint8Array>`);
  next = once(next, `  rows: SpreadsheetRow[],\n  users: User[],\n  filename: string`, `  rows: MarketingTemplateRow[],\n  users: User[],\n  filename: string`);
  next = once(next, `  return eligible.sort((a, b) => a.id.localeCompare(b.id)).map(user => ({`, `  return eligible.sort((a, b) => a.id.localeCompare(b.id)).map(user => ({`);
  next = once(next, `      if (result === undefined || result === null || typeof result === 'object') {`, `      if (result === undefined || result === null || (typeof result === 'object' && !(result instanceof Date))) {`);
  next = once(next, `  await workbook.xlsx.load(new Uint8Array(binary instanceof Uint8Array ? binary : binary) as Parameters<typeof workbook.xlsx.load>[0]);`,
    `  await workbook.xlsx.load(new Uint8Array(binary) as Parameters<typeof workbook.xlsx.load>[0]);`);
  next = once(next, `  rows.forEach(row => sheet.addRow(headers.map(header => row[header] ?? '')));`,
    `  rows.forEach(row => sheet.addRow(headers.map(header => row[header] ?? '')));`);
  next = once(next, `  const moneyHeaders = kind === 'production'`, `  const moneyHeaders = kind === 'production'`);
  next = once(next, `  moneyHeaders.forEach(header => { const column = sheet.getColumn(headers.indexOf(header) + 1); column.numFmt = '#,##0;[Red](#,##0)'; });`,
    `  moneyHeaders.forEach(header => { const column = sheet.getColumn(headers.indexOf(header) + 1); column.numFmt = '#,##0;[Red](#,##0)'; });\n  if (kind === 'pipeline') {\n    sheet.getColumn(9).numFmt = 'yyyy-mm-dd';\n    sheet.getColumn(20).numFmt = 'yyyy-mm-dd';\n    sheet.getColumn(21).numFmt = 'yyyy-mm-dd';\n  }\n  sheet.eachRow((row, rowNumber) => {\n    if (rowNumber === 1) return;\n    row.eachCell({ includeEmpty: true }, cell => {\n      cell.alignment = { vertical: 'middle' };\n      if (typeof cell.value === 'string' && /^[=+@]/.test(cell.value)) cell.numFmt = '@';\n    });\n  });`);
  // The user's reference sheet is complete, but the dropdown contains active eligible owners only.
  next = once(next, `  workbook.definedNames.add(\`'\${USER_DIRECTORY_SHEET}'!$A$2:$A$\${directory.length + 1}\`, 'MarketingUserIDs');`,
    `  workbook.definedNames.add(\`'\${USER_DIRECTORY_SHEET}'!$A$2:$A$\${directory.length + 1}\`, 'MarketingUserIDs');`);
  next = once(next, `  const extension = file.name.split('.').pop()?.toLowerCase();`,
    `  const extension = file.name.split('.').pop()?.toLowerCase();\n  if (file.size === 0) throw new Error('File kosong.');`);
  return next;
}

function target(source) {
  let next = source;
  // Exact ID is authoritative. A stale display name is a warning, not an alternative identity.
  next = initializer(next, 'handleValidateBulkFile', init => between(init,
    `                if (\n                  inputPicName &&`,
    `                if (\n                  inputUnit &&`,
    `                if (\n                  inputUnit &&`));
  next = once(next, `  const [bulkValidatedYear, setBulkValidatedYear] = useState<number | null>(null);`,
    `  const [bulkValidatedYear, setBulkValidatedYear] = useState<number | null>(null);\n  const [targetValidationBusy, setTargetValidationBusy] = useState(false);\n  const [bulkValidationBusy, setBulkValidationBusy] = useState(false);`);
  next = initializer(next, 'handleValidateTargetFile', init => {
    let result = once(init, `      setTargetValidationExecuted(false);`, `      if (targetValidationBusy) return;\n      setTargetValidationBusy(true);\n      setTargetValidationExecuted(false);`);
    result = once(result, `        alert(message);\n      }`, `        alert(message);\n      } finally {\n        setTargetValidationBusy(false);\n      }`);
    return result;
  });
  next = initializer(next, 'handleValidateBulkFile', init => {
    let result = once(init, `      setBulkValidationExecuted(false);`, `      if (bulkValidationBusy) return;\n      setBulkValidationBusy(true);\n      setBulkValidationExecuted(false);`);
    result = once(result, `        alert(message);\n      }`, `        alert(message);\n      } finally {\n        setBulkValidationBusy(false);\n      }`);
    return result;
  });
  // Invalid or changed input can never publish a previous validated preview.
  next = once(next, `    !targetValidationExecuted || targetValidatedFile`, `    targetValidationBusy || !targetValidationExecuted || targetValidatedFile`);
  next = once(next, `    !bulkValidationExecuted || bulkValidatedFile`, `    bulkValidationBusy || !bulkValidationExecuted || bulkValidatedFile`);
  next = once(next, `                            !targetFile\n`, `                            !targetFile || targetValidationBusy\n`);
  next = once(next, `                            !bulkFile\n`, `                            !bulkFile || bulkValidationBusy\n`);
  return next;
}

function production(source) {
  let next = source;
  // Do not insert empty canonical columns before source aliases; that loses legitimate source values.
  next = once(next,
    `        const sourceHeaders = Array.from(new Set([...TEMPLATE_HEADERS, ...parsedData.flatMap(row => Object.keys(row))]));`,
    `        const sourceHeaders = Array.from(new Set(parsedData.flatMap(row => Object.keys(row))));`);
  next = once(next, `        const parsedRows = [sourceHeaders, ...parsedData.map(row => sourceHeaders.map(header => getRowValue(row, header)))];`,
    `        const parsedRows = [sourceHeaders, ...parsedData.map(row => sourceHeaders.map(header => getRowValue(row, header)))];`);
  // Avoid publishing a stale preview when the selected file changes.
  next = once(next, `  const [validatedFile, setValidatedFile] = useState<File | null>(null);`,
    `  const [validatedFile, setValidatedFile] = useState<File | null>(null);\n  const [validatedUserSignature, setValidatedUserSignature] = useState('');`);
  next = initializer(next, 'handleValidateUpload', init => {
    let result = once(init, `      setValidatedFile(null);`, `      setValidatedFile(null);\n      setValidatedUserSignature('');`);
    result = once(result, `        setValidatedFile(uploadFile);`,
      `        setValidatedFile(uploadFile);\n        setValidatedUserSignature(store.getUsers().map(user => [user.id, user.status, user.role, user.unit, user.department, user.superiorId].join(':')).sort().join('|'));`);
    result = once(result, `        setParsedUpload(\n          null\n        );`,
      `        setParsedUpload(null);\n        setValidatedFile(null);\n        setValidatedUserSignature('');`);
    return result;
  });
  next = initializer(next, 'handlePublishOfficial', init => {
    let result = once(init, `        !parsedUpload || validatedFile !== uploadFile ||`,
      `        !parsedUpload || validatedFile !== uploadFile || isValidating ||`);
    result = once(result, `      const latestUsers = store.getUsers();`,
      `      const latestUsers = store.getUsers();\n      const currentSignature = latestUsers.map(user => [user.id, user.status, user.role, user.unit, user.department, user.superiorId].join(':')).sort().join('|');\n      if (currentSignature !== validatedUserSignature) { alert('User Master berubah. Validasi ulang sebelum publish.'); return; }`);
    return result;
  });
  next = once(next, `        <Tabs\n          defaultValue={uploadOnly ? 'upload_official' : 'official'}`, `        <Tabs\n          defaultValue={uploadOnly ? 'upload_official' : 'official'}`);
  next = next.replaceAll('Gunakan 9 kolom sesuai template Dashboard (termasuk Nomor Polis dan Nama Nasabah), lalu Save As CSV. Sistem menerima delimiter titik-koma maupun koma. File UAT lama 7 kolom tetap diterima dan akan dibuatkan Nomor Polis dummy.',
    'Gunakan template XLSX terbaru dengan User ID Pemilik Realisasi wajib. Sheet Daftar User ID hanya referensi; sistem membaca Data Realisasi. CSV tetap diterima jika memiliki User ID. Nama PIC tidak digunakan untuk menentukan pemilik.');
  next = next.replaceAll('snapshot CSV', 'snapshot XLSX');
  next = next.replaceAll('9 kolom', '10 kolom');
  next = next.replaceAll('Simpan CSV', 'Simpan XLSX');
  next = next.replaceAll('Template CSV', 'Template XLSX');
  // Add a robust file-selection reset to the only production upload input.
  const sf = ts.createSourceFile('production.tsx', next, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const inputs = [];
  function visit(node) {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(sf) === 'Input' && node.getText(sf).includes('setUploadFile')) inputs.push(node);
    ts.forEachChild(node, visit);
  }
  visit(sf);
  assert.equal(inputs.length, 1, 'Production upload input');
  const input = inputs[0];
  const inputText = input.getText(sf);
  const attr = input.attributes.properties.find(item => ts.isJsxAttribute(item) && item.name.text === 'onChange');
  assert.ok(attr && attr.initializer && ts.isJsxExpression(attr.initializer));
  const expression = attr.initializer.expression;
  assert.ok(expression);
  const callback = expression.getText(sf);
  const patched = once(callback, `setUploadFile(\n`, `setUploadFile(\n`);
  // Preserve the existing handler body and append reset immediately after its setUploadFile call.
  const updated = patched.replace(/setUploadFile\(\s*(?:event|e)\.target\.files\??\.\[?0\]?[^;]*;?/, match => match);
  assert.equal(updated, patched);
  // The upload input is controlled by a small dedicated handler instead of inline stale state.
  const newInput = inputText.slice(0, attr.getStart(sf) - input.getStart(sf)) +
    `onChange={(event) => { const file = event.target.files?.[0] || null; setUploadFile(file); setParsedUpload(null); setValidatedFile(null); setValidatedUserSignature(''); }}` +
    inputText.slice(attr.end - input.getStart(sf));
  next = next.slice(0, input.getStart(sf)) + newInput + next.slice(input.end);
  return next;
}

const files = {
  'src/utils/marketingWorkbook.ts': utility,
  'src/pages/TargetRkapPage.tsx': target,
  'src/pages/ProduksiPage.tsx': production,
};
const outputs = [];
for (const [path, transform] of Object.entries(files)) {
  const next = transform(readFileSync(path, 'utf8'));
  const sf = ts.createSourceFile(path, next, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  assert.equal(sf.parseDiagnostics.length, 0, `${path}: ${sf.parseDiagnostics.map(d => d.messageText).join('; ')}`);
  outputs.push([path, next]);
}
for (const [path, content] of outputs) { writeFileSync(path, content); console.log(`Hardened ${path}`); }
