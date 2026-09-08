import JSZip from 'jszip';

const SPREADSHEET_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const XMLNS_NS = 'http://www.w3.org/2000/xmlns/';

/**
 * ExcelJS 4.4.0's Xforms compare literal tag names (workbook, sheets, etc.).
 * Valid OOXML produced by other writers may use x:workbook, x:sheets, etc.
 * Normalize only the element names in the SpreadsheetML namespace; preserve
 * all cell contents, attributes, relationships, formulas and other namespaces.
 */
export const normalizeSpreadsheetXml = (xml: string): string => {
  if (/<!DOCTYPE/i.test(xml)) throw new Error('Dokumen XML Excel tidak boleh berisi DOCTYPE.');
  const parser = new DOMParser();
  const original = parser.parseFromString(xml, 'application/xml');
  if (original.getElementsByTagName('parsererror').length || original.documentElement.localName === 'parsererror') {
    throw new Error('Struktur XML workbook tidak valid.');
  }
  if (original.documentElement.namespaceURI !== SPREADSHEET_NS) return xml;
  const hasPrefixedElements = Array.from(original.getElementsByTagName('*')).some(
    element => element.namespaceURI === SPREADSHEET_NS && Boolean(element.prefix)
  ) || Boolean(original.documentElement.prefix);
  if (!hasPrefixedElements) return xml;

  const result = document.implementation.createDocument(null, null);
  const copy = (node: Node): Node => {
    if (node.nodeType !== Node.ELEMENT_NODE) return result.importNode(node, true);
    const source = node as Element;
    const name = source.namespaceURI === SPREADSHEET_NS ? source.localName : source.nodeName;
    const element = result.createElementNS(source.namespaceURI, name);
    for (const attr of Array.from(source.attributes)) {
      // The original namespace declarations remain available for namespaced
      // attributes such as r:id and mc:Ignorable. Add a default main namespace
      // to the root, rather than altering namespace-qualified attributes.
      if (attr.namespaceURI === XMLNS_NS && attr.name === 'xmlns' && source === original.documentElement) continue;
      element.setAttributeNS(attr.namespaceURI, attr.name, attr.value);
    }
    if (source === original.documentElement) element.setAttributeNS(XMLNS_NS, 'xmlns', SPREADSHEET_NS);
    for (const child of Array.from(source.childNodes)) element.appendChild(copy(child));
    return element;
  };
  result.appendChild(copy(original.documentElement));
  return new XMLSerializer().serializeToString(result);
};

/** Normalize a copy in memory. Never mutate the uploaded file or published data. */
export const normalizeXlsxNamespaces = async (binary: ArrayBuffer | Uint8Array): Promise<Uint8Array> => {
  const bytes = binary instanceof Uint8Array ? binary : new Uint8Array(binary);
  const zip = await JSZip.loadAsync(bytes);
  const workbookPart = zip.file('xl/workbook.xml');
  if (!workbookPart) return bytes;
  const workbookXml = await workbookPart.async('string');
  if (!/xmlns(?::[A-Za-z_][\w.-]*)?=["']http:\/\/schemas\.openxmlformats\.org\/spreadsheetml\/2006\/main["']/.test(workbookXml)) return bytes;
  // Standard ExcelJS workbooks require no transformation and retain their
  // original bytes. A prefixed workbook signals the compatibility path.
  const normalizedWorkbook = normalizeSpreadsheetXml(workbookXml);
  if (normalizedWorkbook === workbookXml) return bytes;

  const parts = Object.values(zip.files).filter(entry => !entry.dir && /^xl\/(?:workbook\.xml|sharedStrings\.xml|styles\.xml|worksheets\/[^/]+\.xml|tables\/[^/]+\.xml)$/.test(entry.name));
  if (parts.length > 2000) throw new Error('Workbook memiliki terlalu banyak bagian XML.');
  for (const part of parts) {
    const xml = part.name === 'xl/workbook.xml' ? workbookXml : await part.async('string');
    if (xml.length > 50 * 1024 * 1024) throw new Error('Bagian XML workbook melebihi batas aman.');
    const normalized = part.name === 'xl/workbook.xml' ? normalizedWorkbook : normalizeSpreadsheetXml(xml);
    if (normalized !== xml) zip.file(part.name, normalized);
  }
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
};
