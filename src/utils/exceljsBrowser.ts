import * as browserExcelJS from 'exceljs/dist/exceljs.min.js';
import { resolveExcelJS } from './exceljsLoader';

// The browser distribution is UMD/CommonJS. Vite may expose its Workbook
// constructor on the namespace, default, or nested default depending on
// interop. Resolve the actual constructor rather than assuming one shape.
const Excel = resolveExcelJS(browserExcelJS);
export default Excel;
