declare module 'exceljs/dist/exceljs.min.js' {
  import type ExcelJS from 'exceljs';
  const Excel: typeof ExcelJS;
  export = Excel;
}
