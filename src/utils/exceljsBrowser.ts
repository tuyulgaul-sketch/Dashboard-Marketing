import * as browserExcelJS from 'exceljs/dist/exceljs.min.js';
import { resolveExcelJS } from './exceljsLoader';
import { normalizeXlsxNamespaces } from './xlsxNamespaceCompatibility';

// Preserve the stable browser export adapter and every ExcelJS API. Only the
// XLSX read path needs compatibility with prefixed SpreadsheetML documents.
const Excel = resolveExcelJS(browserExcelJS);
const patched = new WeakSet<object>();

class CompatibleWorkbook extends Excel.Workbook {
  get xlsx() {
    const xlsx = super.xlsx;
    if (!patched.has(xlsx)) {
      patched.add(xlsx);
      const originalLoad = xlsx.load.bind(xlsx);
      xlsx.load = async (data, options) => {
        if (options?.base64) return originalLoad(data, options);
        const normalized = await normalizeXlsxNamespaces(data);
        return originalLoad(normalized as Parameters<typeof originalLoad>[0], options);
      };
    }
    return xlsx;
  }
}

const compatibleExcel = Object.create(Excel) as typeof Excel;
Object.defineProperty(compatibleExcel, 'Workbook', {
  value: CompatibleWorkbook,
  enumerable: true,
  configurable: false,
});

export default compatibleExcel;
