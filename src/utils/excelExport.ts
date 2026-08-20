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
      return (
        row[actualKey] || ''
      )
        .replace(/\u00A0/g, ' ')
        .replace(/[\u200B-\u200D\u2060]/g, '')
        .trim();
    }
  }

  return '';
};
