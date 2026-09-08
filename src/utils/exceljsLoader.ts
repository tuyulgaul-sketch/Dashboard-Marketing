import type ExcelJS from 'exceljs';

/** Resolve the browser and Node shapes of ExcelJS without assuming a default export. */
export const resolveExcelJS = (module: unknown): typeof ExcelJS => {
  let candidate: unknown = module;
  for (let depth = 0; depth < 4; depth += 1) {
    if (candidate && typeof candidate === 'object' && 'Workbook' in candidate && typeof candidate.Workbook === 'function') {
      return candidate as typeof ExcelJS;
    }
    if (!candidate || (typeof candidate !== 'object' && typeof candidate !== 'function') || !('default' in candidate)) break;
    candidate = candidate.default;
  }
  throw new Error('Modul pembaca XLSX tidak berhasil dimuat. Muat ulang aplikasi dan coba kembali.');
};

export const loadExcelJS = async (): Promise<typeof ExcelJS> => resolveExcelJS(await import('exceljs'));
