import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const replaceOnce = (source, before, after) => {
  assert.equal(source.split(before).length, 2, `Expected one anchor: ${before.slice(0, 100)}`);
  return source.replace(before, after);
};
const replaceBetween = (source, start, end, replacement) => {
  const a = source.indexOf(start);
  assert.ok(a >= 0 && source.indexOf(start, a + 1) < 0, `Expected one start: ${start}`);
  const b = source.indexOf(end, a + start.length);
  assert.ok(b > a, `Missing end: ${end}`);
  return source.slice(0, a) + replacement + source.slice(b);
};
const replaceInitializer = (source, name, transform) => {
  const sf = ts.createSourceFile('source.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const matches = [];
  const visit = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(sf) === name && node.initializer) matches.push(node);
    ts.forEachChild(node, visit);
  };
  visit(sf);
  assert.equal(matches.length, 1, `Expected one declaration: ${name}`);
  const init = matches[0].initializer;
  const before = init.getText(sf);
  const after = transform(before);
  assert.notEqual(after, before, `No change to ${name}`);
  return source.slice(0, init.getStart(sf)) + after + source.slice(init.end);
};
const addImport = (source, statement) => statement + '\n' + source;

const transformExcel = source => {
  let next = addImport(source, "import { readNativeXlsxRows } from './marketingWorkbook';");
  next = replaceOnce(next,
    `    throw new Error(\n      'File XLSX native tidak dapat diproses tanpa library tambahan. Gunakan template CSV yang diunduh dari aplikasi.'\n    );`,
    `    return readNativeXlsxRows(await file.arrayBuffer());`);
  return next;
};

const transformTarget = source => {
  let next = addImport(source, `import { downloadMarketingWorkbook, readMarketingSpreadsheet, MARKETING_SHEETS, getMarketingTemplateHeaders, SPREADSHEET_ACCEPT, resolveMarketingOwner, normalizeMarketingUserId } from '@/utils/marketingWorkbook';`);
  next = replaceInitializer(next, 'handleDownloadTargetTemplate', init => {
    let result = replaceOnce(init, '() => {', 'async () => {');
    result = replaceOnce(result, `      exportToExcel(\n        templateData,\n        \`Template_Target_\${selectedTargetYear}\`\n      );`,
      `      try {\n        await downloadMarketingWorkbook('target', templateData, users, \`Template_Target_\${selectedTargetYear}\`);\n      } catch (error) {\n        alert(error instanceof Error ? error.message : 'Gagal membuat template XLSX.');\n      }`);
    return result;
  });
  next = replaceInitializer(next, 'handleDownloadBulkPipelineTemplate', init => {
    let result = replaceOnce(init, '() => {', 'async () => {');
    result = replaceOnce(result, `      exportToExcel(\n        templateData,\n        \`Template_Bulk_Pipeline_\${selectedBulkYear}\`\n      );`,
      `      try {\n        await downloadMarketingWorkbook('pipeline', templateData, users, \`Template_Bulk_Pipeline_\${selectedBulkYear}\`);\n      } catch (error) {\n        alert(error instanceof Error ? error.message : 'Gagal membuat template XLSX.');\n      }`);
    return result;
  });
  // The existing target template is prepopulated from the current user master.
  // The bulk template keeps the exact column layout, but no longer invents an opportunity.
  next = replaceInitializer(next, 'handleDownloadBulkPipelineTemplate', init => {
    const start = `      const eligiblePic =`;
    const end = `      try {\n        await downloadMarketingWorkbook`;
    return replaceBetween(init, start, end,
      `      const templateData = [Object.fromEntries(getMarketingTemplateHeaders('pipeline').map(header => [header, header === 'Tahun' ? selectedBulkYear : '']))];\n\n`);
  });
  // Read real OOXML sheets, not ZIP bytes interpreted as text.
  next = replaceInitializer(next, 'handleValidateTargetFile', init => {
    let result = replaceOnce(init, `await parseExcelOrCsvFile(\n            targetFile\n          )`,
      `await readMarketingSpreadsheet(targetFile, { sheetName: MARKETING_SHEETS.target, requiredHeaders: getMarketingTemplateHeaders('target') })`);
    result = replaceOnce(result, `        const rawRows =`, `        const rawRows =`);
    return result;
  });
  next = replaceInitializer(next, 'handleValidateBulkFile', init => {
    let result = replaceOnce(init, `await parseExcelOrCsvFile(\n            bulkFile\n          )`,
      `await readMarketingSpreadsheet(bulkFile, { sheetName: MARKETING_SHEETS.pipeline, requiredHeaders: getMarketingTemplateHeaders('pipeline') })`);
    // Existing PIC checks remain. Exact ID is now resolved by the shared authoritative validator.
    result = replaceOnce(result,
      `              const picUser =\n                users.find(\n                  user =>\n                    normalizeUserId(\n                      user.id\n                    ) ===\n                    picUserId\n                );`,
      `              const owner = resolveMarketingOwner(picUserId, users, { name: inputPicName });\n              const picUser = owner.user;\n              if (owner.errors.length) { messages.push(...owner.errors); status = 'ERROR'; }\n              if (owner.warnings.length) { messages.push(...owner.warnings); if (status !== 'ERROR') status = 'WARNING'; }`);
    return result;
  });
  // Preserve original import and publishing services, removing only unused CSV parser imports.
  next = replaceOnce(next, `  exportToExcel,\n`, `  exportToExcel,\n`);
  next = replaceOnce(next, `  parseExcelOrCsvFile,\n`, '');
  next = replaceOnce(next, `  const PageLayout = embedded ? React.Fragment : AppLayout;`,
    `  const PageLayout = embedded ? React.Fragment : AppLayout;\n  const [targetValidatedFile, setTargetValidatedFile] = useState<File | null>(null);\n  const [targetValidatedYear, setTargetValidatedYear] = useState<number | null>(null);\n  const [bulkValidatedFile, setBulkValidatedFile] = useState<File | null>(null);\n  const [bulkValidatedYear, setBulkValidatedYear] = useState<number | null>(null);\n  const [targetImportError, setTargetImportError] = useState('');`);
  next = replaceInitializer(next, 'handleTargetFileChange', init => replaceOnce(init, `      setTargetFile(\n        event.target.files[0]\n      );`,
    `      setTargetFile(event.target.files[0]);\n      setTargetValidatedFile(null);\n      setTargetValidatedYear(null);\n      setTargetImportError('');`));
  next = replaceInitializer(next, 'handleBulkFileChange', init => replaceOnce(init, `      setBulkFile(\n        event.target.files[0]\n      );`,
    `      setBulkFile(event.target.files[0]);\n      setBulkValidatedFile(null);\n      setBulkValidatedYear(null);`));
  next = replaceInitializer(next, 'handleValidateTargetFile', init => {
    let result = replaceOnce(init, `      try {\n        const parsed =`,
      `      setTargetValidationExecuted(false);\n      setTargetValidatedFile(null);\n      setTargetValidatedYear(null);\n      setTargetImportError('');\n      try {\n        const parsed =`);
    result = replaceOnce(result, `        const rawRows =\n          parsed.map(row => {`,
      `        const rawRows =\n          parsed.map(row => {`);
    result = replaceOnce(result, `        const duplicateUserIds =`,
      `        const unknownIds = parsed.map(row => normalizeMarketingUserId(getRowValue(row, 'User ID Penerima', 'User ID', 'UserID', 'ID'))).filter(id => !targetHolders.some(user => normalizeMarketingUserId(user.id) === id));\n        if (unknownIds.length) throw new Error(\`User ID tidak terdaftar sebagai target holder aktif: \${[...new Set(unknownIds)].join(', ')}\`);\n        const duplicateUserIds =`);
    result = replaceOnce(result, `        setTargetValidationExecuted(\n          true\n        );`,
      `        setTargetValidatedFile(targetFile);\n        setTargetValidatedYear(selectedTargetYear);\n        setTargetValidationExecuted(true);`);
    result = replaceOnce(result, `        alert(message);\n      }`,
      `        setTargetImportError(message);\n        setTargetValidationRows([]);\n        setTargetValidationExecuted(false);\n        alert(message);\n      }`);
    return result;
  });
  next = replaceInitializer(next, 'handleValidateBulkFile', init => {
    let result = replaceOnce(init, `      try {\n        const parsed =`,
      `      setBulkValidationExecuted(false);\n      setBulkValidatedFile(null);\n      setBulkValidatedYear(null);\n      try {\n        const parsed =`);
    result = replaceOnce(result, `        setBulkValidationExecuted(\n          true\n        );`,
      `        setBulkValidatedFile(bulkFile);\n        setBulkValidatedYear(selectedBulkYear);\n        setBulkValidationExecuted(true);`);
    return result;
  });
  next = replaceOnce(next, `  const hasTargetBlockingErrors =\n    targetValidationRows.some(`,
    `  const hasTargetBlockingErrors =\n    !targetValidationExecuted || targetValidatedFile !== targetFile || targetValidatedYear !== selectedTargetYear || targetValidationRows.length === 0 ||\n    targetValidationRows.some(`);
  next = replaceOnce(next, `  const hasBulkBlockingErrors =\n    bulkValidationRows.some(`,
    `  const hasBulkBlockingErrors =\n    !bulkValidationExecuted || bulkValidatedFile !== bulkFile || bulkValidatedYear !== selectedBulkYear || bulkValidationRows.length === 0 ||\n    bulkValidationRows.some(`);
  next = replaceInitializer(next, 'handlePublishTarget', init => replaceOnce(init, `      if (\n        hasTargetBlockingErrors\n      )`,
    `      if (\n        hasTargetBlockingErrors\n      )`));
  next = replaceInitializer(next, 'handlePublishBulkPipeline', init => {
    let result = replaceOnce(init, `      if (\n        hasBulkBlockingErrors\n      )`, `      if (\n        hasBulkBlockingErrors\n      )`);
    result = replaceOnce(result, `      validRows.forEach(\n        (row, index) => {`,
      `      const latestUsers = store.getUsers();\n      const invalidOwners = validRows.flatMap(row => resolveMarketingOwner(row.picUserId, latestUsers, { name: row.picName }).errors);\n      if (invalidOwners.length) { alert(invalidOwners.join('\\n')); return; }\n      validRows.forEach(\n        (row, index) => {`);
    return result;
  });
  // Recheck target ownership before publishing, not just at file-validation time.
  next = replaceInitializer(next, 'handlePublishTarget', init => replaceOnce(init,
    `      const batchId =`,
    `      const currentHolderIds = new Set(store.getUsers().filter(user => user.status === 'Active' && TARGET_HOLDER_ROLES.has(user.role)).map(user => normalizeMarketingUserId(user.id)));\n      if (targetValidationRows.some(row => !currentHolderIds.has(normalizeMarketingUserId(row.userId)))) { alert('User Master berubah. Validasi ulang Target sebelum publish.'); return; }\n      const batchId =`));
  next = next.replaceAll('Excel-Compatible CSV', 'XLSX dengan Daftar User ID');
  next = next.replaceAll('Download Template CSV, Isi melalui Microsoft Excel, Upload CSV', 'Download Template XLSX, Isi melalui Microsoft Excel, Upload XLSX');
  next = next.replaceAll('Download Template Target (.csv)', 'Download Template Target (.xlsx)');
  next = next.replaceAll('Download Template (.csv)', 'Download Template (.xlsx)');
  next = next.replaceAll('Upload CSV Target', 'Upload XLSX Target');
  next = next.replaceAll('Upload CSV Pipeline', 'Upload XLSX Pipeline');
  next = next.replaceAll('Pilih file CSV', 'Pilih file XLSX');
  next = next.replaceAll('file CSV', 'file XLSX');
  next = next.replaceAll('via CSV import', 'via XLSX import');
  next = next.replaceAll('.csv`', '.xlsx`');
  next = next.replaceAll('accept=".csv,text/csv"', 'accept={SPREADSHEET_ACCEPT}');
  next = replaceOnce(next, `  const isTLMS =`, `  const isTLMS =`);
  // Names are never used for matching; remove the unused import only after all replacements.
  next = next.replace(`  exportToExcel,\n`, '');
  return next;
};

const transformProduction = source => {
  let next = addImport(source, `import { downloadMarketingWorkbook, readMarketingSpreadsheet, MARKETING_SHEETS, getMarketingTemplateHeaders, SPREADSHEET_ACCEPT, resolveMarketingOwner } from '@/utils/marketingWorkbook';`);
  next = replaceOnce(next, `  'PIC Marketing',\n];`, `  'User ID Pemilik Realisasi',\n  'PIC Marketing',\n];`);
  // Production now requires the owner ID in every import format.
  next = replaceOnce(next, `  'PIC Marketing',\n];\n\nconst normalizeHeader`, `  'User ID Pemilik Realisasi',\n  'PIC Marketing',\n];\n\nconst normalizeHeader`);
  next = replaceBetween(next, `const detectDelimiter =`, `const parseProductionMonth =`, '');
  next = replaceInitializer(next, 'handleDownloadCsvTemplate', () =>
    `async () => {\n      try {\n        await downloadMarketingWorkbook('production', [], store.getUsers(), 'Template_Upload_Realisasi_Produksi');\n      } catch (error) {\n        alert(error instanceof Error ? error.message : 'Gagal membuat template XLSX.');\n      }\n    }`);
  next = replaceInitializer(next, 'handleValidateUpload', init => {
    let result = replaceOnce(init, `        const text =\n          await uploadFile.text();\n\n        const parsedRows =\n          parseCsv(\n            text\n          );`,
      `        const parsedData = await readMarketingSpreadsheet(uploadFile, { sheetName: MARKETING_SHEETS.production, requiredHeaders: getMarketingTemplateHeaders('production') });\n        const parsedRows = [getMarketingTemplateHeaders('production'), ...parsedData.map(row => getMarketingTemplateHeaders('production').map(header => getRowValue(row, header)))];`);
    result = replaceBetween(result, `              if (\n                amountRaw ===`, `              const amount =`, '');
    // Resolve the ID before row errors are checked, so invalid owners block the whole batch.
    const ownerBlock = `              const picRaw = getRowValue(row, 'PIC Marketing', 'PIC');\n              const ownerId = getRowValue(row, 'User ID Pemilik Realisasi', 'PIC User ID');\n              const owner = resolveMarketingOwner(ownerId, users, { unit: functionValue || undefined, name: picRaw, production: true });\n              rowErrors.push(...owner.errors);\n              rowWarnings.push(...owner.warnings);\n              const picMatch = owner.user;\n              const picName = picMatch?.name || picRaw || 'Unassigned / Data Historis';\n              const department = picMatch?.department || 'Unassigned / Data Historis';\n\n`;
    result = replaceOnce(result,
      `              if (\n                rowErrors.length >\n                0\n              ) {`,
      ownerBlock + `              if (\n                rowErrors.length >\n                0\n              ) {`);
    result = replaceBetween(result, `              const picRaw =\n                getRowValue(`, `              if (\n                rowWarnings.length >`, '');
    result = replaceOnce(result, `                picUserId:\n                  picMatch?.id,`, `                picUserId:\n                  picMatch!.id,`);
    result = replaceOnce(result, `        setParsedUpload({`,
      `        setValidatedFile(uploadFile);\n        setParsedUpload({`);
    return result;
  });
  next = replaceOnce(next, `  const [\n    parsedUpload,`,
    `  const [validatedFile, setValidatedFile] = useState<File | null>(null);\n  const [\n    parsedUpload,`);
  next = replaceInitializer(next, 'handleValidateUpload', init => replaceOnce(init, `      setIsValidating(\n        true\n      );`,
    `      setIsValidating(true);\n      setParsedUpload(null);\n      setValidatedFile(null);`));
  next = replaceInitializer(next, 'handlePublishOfficial', init => {
    let result = replaceOnce(init, `        !parsedUpload ||`, `        !parsedUpload || validatedFile !== uploadFile ||`);
    result = replaceOnce(result, `      const now =`,
      `      const latestUsers = store.getUsers();\n      const invalidOwners = parsedUpload.validRecords.flatMap(record => resolveMarketingOwner(record.picUserId, latestUsers, { unit: record.marketingFunction, production: true }).errors);\n      if (invalidOwners.length) { alert('User Master berubah. Validasi ulang sebelum publish.\\n' + [...new Set(invalidOwners)].join('\\n')); return; }\n      const now =`);
    return result;
  });
  next = next.replaceAll('snapshot laporan produksi CSV', 'snapshot laporan produksi XLSX');
  next = next.replaceAll('CSV tidak memiliki baris data.', 'File tidak memiliki baris data.');
  next = next.replaceAll('Header CSV tidak sesuai', 'Header file tidak sesuai');
  next = next.replaceAll('Validasi CSV gagal.', 'Validasi file gagal.');
  next = next.replaceAll('source CSV', 'source XLSX');
  next = next.replaceAll('Template_Upload_Realisasi_Produksi_Dashboard_9_Kolom.csv', 'Template_Upload_Realisasi_Produksi.xlsx');
  next = next.replaceAll('accept=".csv,text/csv"', 'accept={SPREADSHEET_ACCEPT}');
  next = next.replaceAll('Download Template CSV', 'Download Template XLSX');
  next = next.replaceAll('Upload CSV', 'Upload XLSX');
  next = next.replaceAll('Download Template (.csv)', 'Download Template (.xlsx)');
  next = next.replaceAll('Format CSV', 'Format XLSX');
  next = replaceOnce(next, `  const uploadPeriodKeys =`, `  const uploadPeriodKeys =`);
  // Clear validated snapshot on a new file, preventing stale publish after selection changes.
  next = next.replaceAll(`setParsedUpload(null);`, `setParsedUpload(null);\n        setValidatedFile(null);`);
  return next;
};

const changes = {
  'src/utils/excelExport.ts': transformExcel,
  'src/pages/TargetRkapPage.tsx': transformTarget,
  'src/pages/ProduksiPage.tsx': transformProduction,
};

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  for (const [path, transform] of Object.entries(changes)) {
    const original = readFileSync(path, 'utf8');
    const next = transform(original);
    assert.notEqual(next, original);
    const sf = ts.createSourceFile(path, next, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    assert.equal(sf.parseDiagnostics.length, 0, `${path}: ${sf.parseDiagnostics.map(issue => issue.messageText).join('; ')}`);
    writeFileSync(path, next);
    console.log(`Updated ${path}`);
  }
}
