import assert from 'node:assert/strict';

export const COMPACT_BASE = 'a08fbea14a7ef23255abfb2a088df305e28b5c9f';
const replaceOnce = (source, before, after, label) => {
  assert(source.includes(before), `Missing integration anchor: ${label}`);
  assert.equal(source.split(before).length, 2, `Non-unique integration anchor: ${label}`);
  return source.replace(before, after);
};
const replaceBetween = (source, start, end, replacement, label) => {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  assert(a >= 0 && b > a, `Missing integration boundary: ${label}`);
  assert.equal(source.indexOf(start, a + 1), -1, `Non-unique start boundary: ${label}`);
  return source.slice(0, a) + replacement + source.slice(b);
};
export const compactTargetTransform = {
  'src/utils/marketingWorkbook.ts': original => {
    let source = replaceOnce(original,
      "import type { User } from '@/types';",
      "import type { User } from '@/types';\nimport { COMPACT_TARGET_HEADERS } from './targetCompact';",
      'compact import');
    source = replaceBetween(source,
      "  const months = ['Januari'",
      '\n};\n\nconst loadExcelJS',
      '  return [...COMPACT_TARGET_HEADERS];',
      'target header list');
    source = replaceOnce(source,
      "  const moneyHeaders = kind === 'production'",
      `  if (kind === 'target') {
    [12, 22, 12, 12, 24].forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
    sheet.getColumn(1).numFmt = '0';
    sheet.getColumn(3).numFmt = '0';
    for (let rowNumber = 2; rowNumber <= Math.max(1001, dataEnd); rowNumber += 1) {
      sheet.getCell(rowNumber, 3).dataValidation = {
        type: 'list', allowBlank: false, formulae: ['"1,2,3,4,5,6,7,8,9,10,11,12"'],
        showErrorMessage: true, errorTitle: 'Periode tidak valid', error: 'Pilih bulan 1 sampai 12.',
      };
      sheet.getCell(rowNumber, 4).dataValidation = {
        type: 'list', allowBlank: false, formulae: ['"NB,RN"'],
        showErrorMessage: true, errorTitle: 'Jenis bisnis tidak valid', error: 'Pilih NB atau RN.',
      };
    }
  }
  const moneyHeaders = kind === 'production'`,
      'target column formatting');
    return source;
  },
  'src/pages/TargetRkapPage.tsx': original => {
    let source = "import { buildCompactTargetTemplateRows, normalizeTargetUploadRows } from '@/utils/targetCompact';\n" + original;
    source = replaceBetween(source,
      '  const handleDownloadTargetTemplate =',
      '  const handleTargetFileChange =',
      `  const handleDownloadTargetTemplate = async () => {
    const templateData = buildCompactTargetTemplateRows(users, selectedTargetYear);
    try {
      await downloadMarketingWorkbook('target', templateData, users, \`Template_Target_\${selectedTargetYear}\`);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Gagal membuat template XLSX.');
    }
  };

`,
      'target template generator');
    source = replaceOnce(source,
      `        const parsed =
          await readMarketingSpreadsheet(targetFile, { sheetName: MARKETING_SHEETS.target, requiredHeaders: ['Tahun', 'User ID Penerima', 'Target Tahunan', 'Target Tahunan NB', 'Target Tahunan RN', 'Target Pribadi', 'Target Pribadi NB', 'Target Pribadi RN'] });`,
      `        const importedRows = await readMarketingSpreadsheet(targetFile, {
          sheetName: MARKETING_SHEETS.target,
          requiredHeaders: ['Tahun', 'User ID Penerima'],
        });
        const parsed = normalizeTargetUploadRows(importedRows, users, selectedTargetYear);`,
      'target validation adapter');
    return source;
  },
};
