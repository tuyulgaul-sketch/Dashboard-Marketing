from pathlib import Path

p = Path('src/utils/marketingWorkbook.ts')
s = p.read_text()

def replace_once(old: str, new: str) -> None:
    global s
    if old not in s:
        raise SystemExit('Expected source block not found:\n' + old[:300])
    s = s.replace(old, new, 1)

replace_once(
    "import { COMPACT_TARGET_HEADERS } from './targetCompact';",
    "import { LEGACY_TARGET_HEADERS } from './targetCompact';\nimport { prepareTargetTemplateRows, applyTargetValidationWorkbook } from './targetValidationWorkbook';"
)
replace_once("  return [...COMPACT_TARGET_HEADERS];", "  return [...LEGACY_TARGET_HEADERS];")
replace_once(
    "  workbook.creator = 'PertaLife Marketing Dashboard';\n  workbook.created = new Date();\n  const headers = getMarketingTemplateHeaders(kind);",
    "  workbook.creator = 'PertaLife Marketing Dashboard';\n  workbook.created = new Date();\n  const targetTemplate = kind === 'target' ? prepareTargetTemplateRows(users, rows) : null;\n  const effectiveRows = targetTemplate?.rows ?? rows;\n  const headers = getMarketingTemplateHeaders(kind);"
)
replace_once(
    "  rows.forEach(row => sheet.addRow(headers.map(header => row[header] ?? '')));\n  const dataEnd = Math.max(rows.length + 1, 2);",
    "  effectiveRows.forEach(row => sheet.addRow(headers.map(header => row[header] ?? '')));\n  const dataEnd = Math.max(effectiveRows.length + 1, 2);"
)
old_target = '''  if (kind === 'target') {
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
'''
new_target = '''  if (kind === 'target' && targetTemplate) {
    [12, 22, 30, 28, 30, 18].forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
    for (let column = 7; column <= headers.length; column += 1) sheet.getColumn(column).width = column === headers.length ? 30 : 18;
    sheet.getColumn(1).numFmt = '0';
    applyTargetValidationWorkbook(workbook, sheet, users, targetTemplate.year);
  }
'''
replace_once(old_target, new_target)
p.write_text(s)
