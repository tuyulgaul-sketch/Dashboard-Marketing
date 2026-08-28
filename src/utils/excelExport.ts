export const exportToExcel = (
  data: Record<string, any>[],
  filename: string,
  _sheetName?: string
) => {
  if (!data || data.length === 0) {
    alert('Tidak ada data untuk diexport.');
    return;
  }

  const headers = Object.keys(data[0]);
  const delimiter = ';';

  const escapeCsvCell = (value: unknown): string => {
    if (value === null || value === undefined) return '""';

    const text = String(value)
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/"/g, '""');

    return `"${text}"`;
  };

  const rows: string[] = [];

  rows.push(
    headers
      .map(header => escapeCsvCell(header))
      .join(delimiter)
  );

  data.forEach(row => {
    rows.push(
      headers
        .map(header => escapeCsvCell(row[header]))
        .join(delimiter)
    );
  });

  const csvContent = '\uFEFF' + rows.join('\r\n');
  const blob = new Blob(
    [csvContent],
    { type: 'text/csv;charset=utf-8;' }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  const cleanName = filename.replace(/\.(xls|xlsx|csv)$/i, '');

  link.href = url;
  link.download = `${cleanName}.csv`;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
};

const normalizeHeader = (value: string): string => {
  return value
    .replace(/\uFEFF/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u200B-\u200D\u2060]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
};

// ============================================================
// EXCEL / SPREADSHEET DATE COMPATIBILITY
// ============================================================
// CSV files are frequently opened and re-saved in Microsoft Excel.
// Depending on Windows/Excel locale, an ISO value such as 2026-01-20
// can be written back as 20/01/2026, 20-01-2026, 20-Jan-26, or even
// an Excel serial number if the cell is formatted as General.
//
// The business checker should validate the DATE VALUE, not require the
// user to preserve one exact display format in Excel.
//
// Only known DATE columns are normalized. Other columns are untouched.

const DATE_HEADERS = new Set([
  'targetclosing',
  'targetclosingdate',
  'coveragestart',
  'coverageend',
]);

const MONTH_ALIASES: Record<string, number> = {
  jan: 1,
  januari: 1,
  january: 1,

  feb: 2,
  februari: 2,
  february: 2,

  mar: 3,
  maret: 3,
  march: 3,

  apr: 4,
  april: 4,

  mei: 5,
  may: 5,

  jun: 6,
  juni: 6,
  june: 6,

  jul: 7,
  juli: 7,
  july: 7,

  agu: 8,
  ags: 8,
  agustus: 8,
  aug: 8,
  august: 8,

  sep: 9,
  sept: 9,
  september: 9,

  okt: 10,
  oktober: 10,
  oct: 10,
  october: 10,

  nov: 11,
  november: 11,

  des: 12,
  desember: 12,
  dec: 12,
  december: 12,
};

const expandSpreadsheetYear = (
  value: number
): number => {
  if (value >= 100) {
    return value;
  }

  // Excel commonly displays 2026 as "26".
  // Keep conventional 70/30-style behavior for older dates.
  return value <= 69
    ? 2000 + value
    : 1900 + value;
};

const isValidCalendarDate = (
  year: number,
  month: number,
  day: number
): boolean => {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    year < 1900 ||
    year > 2100 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return false;
  }

  const date = new Date(
    Date.UTC(
      year,
      month - 1,
      day
    )
  );

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

const toIsoDate = (
  year: number,
  month: number,
  day: number
): string | null => {
  if (
    !isValidCalendarDate(
      year,
      month,
      day
    )
  ) {
    return null;
  }

  return [
    String(year).padStart(4, '0'),
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join('-');
};

const parseExcelSerialDate = (
  raw: string
): string | null => {
  // Restrict this to realistic Excel date serials so normal numeric
  // business values cannot be accidentally interpreted as dates.
  if (!/^\d{4,5}$/.test(raw)) {
    return null;
  }

  const serial = Number(raw);

  if (
    !Number.isInteger(serial) ||
    serial < 20000 ||
    serial > 80000
  ) {
    return null;
  }

  // Excel 1900 date system, including the historical leap-year quirk.
  const excelEpochUtc =
    Date.UTC(1899, 11, 30);

  const date =
    new Date(
      excelEpochUtc +
        serial *
          24 *
          60 *
          60 *
          1000
    );

  return toIsoDate(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate()
  );
};

const normalizeSpreadsheetDateValue = (
  header: string,
  rawValue: string
): string => {
  const normalizedHeader =
    normalizeHeader(header);

  if (
    !DATE_HEADERS.has(
      normalizedHeader
    )
  ) {
    return rawValue;
  }

  let value = String(
    rawValue || ''
  )
    .replace(/\u00A0/g, ' ')
    .replace(/[\u200B-\u200D\u2060]/g, '')
    .trim();

  if (!value) {
    return value;
  }

  // Excel/text-protection variants:
  // '2026-01-20
  // ="2026-01-20"
  if (
    value.startsWith("'")
  ) {
    value =
      value.slice(1).trim();
  }

  const formulaTextMatch =
    value.match(
      /^=\s*"([^"]+)"\s*$/
    );

  if (
    formulaTextMatch
  ) {
    value =
      formulaTextMatch[1]
        .trim();
  }

  // 1) ISO already correct: YYYY-MM-DD
  const isoMatch =
    value.match(
      /^(\d{4})-(\d{1,2})-(\d{1,2})$/
    );

  if (isoMatch) {
    const iso =
      toIsoDate(
        Number(isoMatch[1]),
        Number(isoMatch[2]),
        Number(isoMatch[3])
      );

    return iso || value;
  }

  // 2) Excel serial date
  const excelSerial =
    parseExcelSerialDate(
      value
    );

  if (excelSerial) {
    return excelSerial;
  }

  // 3) Numeric separators.
  // Supported examples:
  // 20/01/2026
  // 20-01-2026
  // 20.01.2026
  // 20/1/26
  // 2026/01/20
  // 1/20/2026 (US-style only when second component > 12,
  //             therefore not ambiguous with D/M/YYYY)
  const numericMatch =
    value.match(
      /^(\d{1,4})[\/.\-](\d{1,2})[\/.\-](\d{1,4})$/
    );

  if (numericMatch) {
    const first =
      Number(
        numericMatch[1]
      );

    const second =
      Number(
        numericMatch[2]
      );

    const third =
      Number(
        numericMatch[3]
      );

    // YYYY/M/D
    if (
      numericMatch[1].length ===
        4
    ) {
      const iso =
        toIsoDate(
          first,
          second,
          third
        );

      return iso || value;
    }

    const year =
      expandSpreadsheetYear(
        third
      );

    // Default business locale: D/M/YYYY.
    let day =
      first;
    let month =
      second;

    // If the second component cannot be a month, this is clearly
    // M/D/YYYY (e.g. 1/20/2026).
    if (
      first >= 1 &&
      first <= 12 &&
      second > 12
    ) {
      month =
        first;
      day =
        second;
    }

    const iso =
      toIsoDate(
        year,
        month,
        day
      );

    return iso || value;
  }

  // 4) Month-name formats produced by Excel:
  // 20-Jan-26
  // 20 Jan 2026
  // 20-Ags-2026
  // 20-Aug-2026
  const monthNameMatch =
    value
      .toLowerCase()
      .match(
        /^(\d{1,2})[\s\/.\-]+([a-z]+)[\s\/.\-]+(\d{2,4})$/i
      );

  if (
    monthNameMatch
  ) {
    const day =
      Number(
        monthNameMatch[1]
      );

    const month =
      MONTH_ALIASES[
        monthNameMatch[2]
          .toLowerCase()
      ];

    const year =
      expandSpreadsheetYear(
        Number(
          monthNameMatch[3]
        )
      );

    if (month) {
      const iso =
        toIsoDate(
          year,
          month,
          day
        );

      return iso || value;
    }
  }

  // Keep the original value if it cannot be safely recognized.
  // The domain checker can then show a clear validation error.
  return value;
};

const detectDelimiter = (text: string): string => {
  let inQuotes = false;
  let commaCount = 0;
  let semicolonCount = 0;
  let tabCount = 0;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        i++;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes) {
      if (char === '\n' || char === '\r') {
        break;
      }

      if (char === ',') commaCount++;
      if (char === ';') semicolonCount++;
      if (char === '\t') tabCount++;
    }
  }

  if (tabCount >= semicolonCount && tabCount >= commaCount && tabCount > 0) {
    return '\t';
  }

  if (semicolonCount >= commaCount && semicolonCount > 0) {
    return ';';
  }

  return ',';
};

const parseDelimitedMatrix = (
  rawText: string,
  delimiter: string
): string[][] => {
  const text = rawText
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      row.push(field);
      field = '';
      continue;
    }

    if (char === '\n' && !inQuotes) {
      row.push(field);

      if (row.some(cell => cell.trim().length > 0)) {
        rows.push(row);
      }

      row = [];
      field = '';
      continue;
    }

    field += char;
  }

  row.push(field);

  if (row.some(cell => cell.trim().length > 0)) {
    rows.push(row);
  }

  return rows;
};

const parseDelimitedText = (
  rawText: string
): Record<string, string>[] => {
  const cleanText = rawText
    .replace(/^\uFEFF/, '')
    .trim();

  if (!cleanText) return [];

  const delimiter = detectDelimiter(cleanText);
  const matrix = parseDelimitedMatrix(cleanText, delimiter);

  if (matrix.length < 2) return [];

  const headers = matrix[0].map(header =>
    header
      .replace(/\uFEFF/g, '')
      .replace(/\u00A0/g, ' ')
      .replace(/[\u200B-\u200D\u2060]/g, '')
      .trim()
  );

  const results: Record<string, string>[] = [];

  for (let i = 1; i < matrix.length; i++) {
    const values = matrix[i];
    const rowObj: Record<string, string> = {};

    headers.forEach((header, index) => {
      if (!header) return;

      rowObj[header] = (values[index] ?? '')
        .replace(/\u00A0/g, ' ')
        .replace(/[\u200B-\u200D\u2060]/g, '')
        .trim();
    });

    if (
      Object.values(rowObj).some(
        value => String(value).trim().length > 0
      )
    ) {
      results.push(rowObj);
    }
  }

  return results;
};

const parseHtmlTable = (
  html: string
): Record<string, string>[] => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const table = doc.querySelector('table');

  if (!table) return [];

  const rows = Array.from(
    table.querySelectorAll('tr')
  );

  if (rows.length < 2) return [];

  const headers = Array.from(
    rows[0].querySelectorAll('th, td')
  ).map(cell =>
    (cell.textContent || '')
      .replace(/\u00A0/g, ' ')
      .replace(/[\u200B-\u200D\u2060]/g, '')
      .trim()
  );

  const result: Record<string, string>[] = [];

  for (let i = 1; i < rows.length; i++) {
    const cells = Array.from(
      rows[i].querySelectorAll('td, th')
    );

    const rowObj: Record<string, string> = {};

    headers.forEach((header, index) => {
      if (!header) return;

      rowObj[header] = (cells[index]?.textContent || '')
        .replace(/\u00A0/g, ' ')
        .replace(/[\u200B-\u200D\u2060]/g, '')
        .trim();
    });

    if (
      Object.values(rowObj).some(
        value => String(value).trim().length > 0
      )
    ) {
      result.push(rowObj);
    }
  }

  return result;
};

export const parseExcelOrCsvFile = async (
  file: File
): Promise<Record<string, string>[]> => {
  const extension =
    file.name
      .split('.')
      .pop()
      ?.toLowerCase() || '';

  if (extension === 'xlsx') {
    throw new Error(
      'File XLSX native tidak dapat diproses tanpa library tambahan. Gunakan template CSV yang diunduh dari aplikasi.'
    );
  }

  const text = await file.text();

  if (
    text.includes('<table') ||
    text.includes('<TABLE')
  ) {
    return parseHtmlTable(text);
  }

  return parseDelimitedText(text);
};

export const getRowValue = (
  row: Record<string, string>,
  ...possibleKeys: string[]
): string => {
  const rowKeys = Object.keys(row);

  for (const possibleKey of possibleKeys) {
    const expected = normalizeHeader(possibleKey);

    const actualKey = rowKeys.find(
      key => normalizeHeader(key) === expected
    );

    if (actualKey) {
      const cleanValue = (
        row[actualKey] || ''
      )
        .replace(/\u00A0/g, ' ')
        .replace(/[\u200B-\u200D\u2060]/g, '')
        .trim();

      return normalizeSpreadsheetDateValue(
        actualKey,
        cleanValue
      );
    }
  }

  return '';
};
