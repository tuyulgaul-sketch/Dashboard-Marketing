import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';

const BASE = '6b087d9ceccd6a52fd1d83ea6dbaf27bdd9bbcbc';
const read = path => readFileSync(path, 'utf8');
const write = (path, text) => writeFileSync(path, text);
const once = (source, pattern, replacement, label) => {
  const matches = [...source.matchAll(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g'))];
  assert.equal(matches.length, 1, `${label}: expected exactly one source match, got ${matches.length}`);
  return source.replace(pattern, replacement);
};

// Keep the historical CSV exporter and its date normalization intact.
let excel = read('src/utils/excelExport.ts');
excel = once(excel,
  /if \(extension === 'xlsx'\) \{\s*throw new Error\(\s*'File XLSX native tidak dapat diproses tanpa library tambahan\. Gunakan template CSV yang diunduh dari aplikasi\.'\s*\);\s*\}/,
  `if (extension === 'xlsx') {\n    const { readUploadWorkbookRecords } = await import('./uploadWorkbook');\n    return readUploadWorkbookRecords(file);\n  }`, 'native XLSX parser');
write('src/utils/excelExport.ts', excel);

// Expose a fresh, server-sourced directory without changing the authenticated runtime.
let userRuntime = read('src/services/centralUserRuntime.ts');
assert(!userRuntime.includes('loadUserDirectoryForUpload'));
userRuntime += `\n/** Fresh authoritative directory for restricted upload templates and validation. */\nexport const loadUserDirectoryForUpload = async (): Promise<User[]> => {\n  const rows = await loadDirectoryRows();\n  return rows.map(toUser).filter(user => user.status === 'Active' && user.role !== 'SYSTEM_ADMIN');\n};\n`;
write('src/services/centralUserRuntime.ts', userRuntime);

// The generic exporter retains CSV semantics for all existing non-template exports.
// Only the three existing Arianie upload templates are changed to real workbooks.
let target = read('src/pages/TargetRkapPage.tsx');
target = once(target, /(from '@\/utils\/excelExport';)/, `$1\nimport { downloadManagedUploadTemplate } from '@/utils/uploadWorkbook';`, 'target imports');
target = once(target,
  /exportToExcel\(\s*templateData,\s*`Template_Target_\$\{selectedTargetYear\}`\s*\);/,
  `void downloadManagedUploadTemplate(Object.keys(templateData[0] || {}), templateData, \`Template_Target_\${selectedTargetYear}\`, 'Target');`,
  'target template');
target = once(target,
  /exportToExcel\(\s*templateData,\s*`Template_Bulk_Pipeline_\$\{selectedBulkYear\}`\s*\);/,
  `void downloadManagedUploadTemplate(Object.keys(templateData[0] || {}), templateData, \`Template_Bulk_Pipeline_\${selectedBulkYear}\`, 'Bulk Pipeline');`,
  'bulk template');
// Only the two upload controls need XLSX support; leave other inputs unchanged.
target = target.replace(/accept="\.csv"/g, 'accept=".csv,.xlsx"');
write('src/pages/TargetRkapPage.tsx', target);

let production = read('src/pages/ProduksiPage.tsx');
production = once(production, /(from '@\/utils\/currencyInput';)/,
  `$1\nimport { downloadManagedUploadTemplate, readUploadWorkbookMatrix } from '@/utils/uploadWorkbook';\nimport { loadUserDirectoryForUpload } from '@/services/centralUserRuntime';\nimport { PRODUCTION_OWNER_HEADER, resolveProductionOwner, validateProductionOwnersForPublish } from '@/lib/productionOwner';`,
  'production imports');
production = once(production,
  /(const TEMPLATE_HEADERS = \[[\s\S]*?'PIC Marketing',\s*)(\];)/,
  `$1PRODUCTION_OWNER_HEADER,\n$2`, 'production template ID column');
production = once(production,
  /(const REQUIRED_TEMPLATE_HEADERS = \[[\s\S]*?'PIC Marketing',\s*)(\];)/,
  `$1PRODUCTION_OWNER_HEADER,\n$2`, 'production required ID header');
production = once(production,
  /const handleDownloadCsvTemplate =\s*\(\) => \{[\s\S]*?\n\s*\};\s*(?=const handleValidateUpload)/,
  `const handleDownloadCsvTemplate = () => {\n    void downloadManagedUploadTemplate(TEMPLATE_HEADERS, [], 'Template_Upload_Realisasi_Produksi_Dashboard_10_Kolom', 'Realisasi Produksi');\n  };\n\n  `,
  'production template download');
production = once(production,
  /const text =\s*await uploadFile\.text\(\);\s*const parsedRows =\s*parseCsv\(\s*text\s*\);/,
  `const parsedRows = /\\.xlsx$/i.test(uploadFile.name)\n          ? await readUploadWorkbookMatrix(uploadFile)\n          : parseCsv(await uploadFile.text());`,
  'production XLSX reader');
production = once(production,
  /const users =\s*store\s*\.getUsers\(\)\s*\.filter\(\s*user =>\s*user\.role !==\s*'SYSTEM_ADMIN'\s*\);/,
  `const users = await loadUserDirectoryForUpload();`,
  'fresh production directory');
production = once(production,
  /const picRaw =\s*getRowValue\([\s\S]*?\n\s*validRecords\.push\(\{/,
  `const picRaw = getRowValue(row, 'PIC Marketing', 'PIC');\n              const owner = resolveProductionOwner(\n                users,\n                getRowValue(row, PRODUCTION_OWNER_HEADER, 'PIC User ID'),\n                picRaw,\n                functionValue,\n              );\n              if (owner.errors.length > 0 || !owner.user) {\n                errorRowCount += 1;\n                issueRows.add(rowNumber);\n                if (issues.length < 200) {\n                  issues.push({ rowNumber, severity: 'ERROR', message: owner.errors.join('; ') || 'Pemilik realisasi tidak valid.' });\n                }\n                return;\n              }\n              const picMatch = owner.user;\n              const department = picMatch.department || 'None';\n\n              validRecords.push({`,
  'replace name-based production ownership');
production = once(production,
  /picName:\s*picMatch\s*\?\s*picMatch\.name\s*:\s*picName,\s*picUserId:\s*picMatch\?\.id,/,
  `picName: picMatch.name,\n                picUserId: picMatch.id,`,
  'store canonical owner');
// Validate again at publication time, so a changed/deactivated user cannot be published from stale preview state.
production = once(production,
  /const handlePublishOfficial =\s*\(\) => \{[\s\S]*?\n\s*const confirmation =/,
  match => match.replace('const handlePublishOfficial =\n    () => {', 'const handlePublishOfficial =\n    async () => {').replace('const confirmation =', `const latestUsers = await loadUserDirectoryForUpload();\n      const ownerErrors = validateProductionOwnersForPublish(parsedUpload.validRecords, latestUsers);\n      if (ownerErrors.length > 0) {\n        alert('Data pemilik realisasi berubah atau tidak valid. Validasi ulang file sebelum Publish.\\n' + ownerErrors.slice(0, 10).join('\\n'));\n        setParsedUpload(null);\n        return;\n      }\n\n      const confirmation =`),
  'publish-time owner check');
// Existing page accepts CSV only; extend its production upload input without touching invoice/document inputs.
production = production.replace(/accept="\.csv"/g, 'accept=".csv,.xlsx"');
production = production.replace(/Template CSV/g, 'Template Excel');
write('src/pages/ProduksiPage.tsx', production);

// Verify that the new code cannot fall back to matching a person by name.
assert(!production.includes('users.find(\n                      user =>\n                        user.name'));
assert(production.includes('picUserId: picMatch.id'));
assert(target.includes('downloadManagedUploadTemplate'));
console.log(`Integrated User ID upload workbooks from ${BASE}. Existing business workflows remain in place.`);
