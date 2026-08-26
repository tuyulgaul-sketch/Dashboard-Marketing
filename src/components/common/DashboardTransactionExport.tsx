import React, { useMemo, useState } from 'react';
import { Download, CalendarRange, FileSpreadsheet, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { store } from '@/services/store';
import { formatSlaDueDate, getSlaState } from '@/utils/slaGovernance';

/**
 * DashboardTransactionExport
 * ------------------------------------------------------------
 * Drop-in export component for Dashboard Direktorat Marketing.
 *
 * Features:
 * - Mandatory Start Date + End Date
 * - Quick select: Bulan Ini, 3 Bulan Terakhir, YTD, Custom
 * - Maximum 12 months per export
 * - 1 real .xlsx workbook with multiple worksheets
 * - Worksheets vary by role
 * - 1 row = 1 action (Audit Trail source)
 * - Role/hierarchy filtering
 * - No extra npm package required
 *
 * IMPORTANT:
 * This component intentionally builds XLSX directly in the browser
 * so the existing package.json / pnpm-lock.yaml do not need changes.
 */

type AnyRow = Record<string, any>;

type ExportSheet = {
  name: string;
  rows: AnyRow[];
};

type DateRange = {
  start: string;
  end: string;
};

type ZipEntry = {
  name: string;
  data: Uint8Array;
  crc: number;
  offset: number;
};

const MARKETING_ROLES = new Set([
  'DIRECTOR_MARKETING',
  'ADVISOR_MARKETING_DIRECTOR',
  'VP_CAPTIVE_MARKETING',
  'VP_CORPORATE_RETAIL_MARKETING',
  'DEPARTMENT_HEAD_MARKETING',
  'SUPERVISOR_MARKETING',
  'STAFF_MARKETING',
]);

const fmtDateInput = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

const startOfThreeMonthsWindow = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth() - 2, 1);

const startOfYear = (d: Date) => new Date(d.getFullYear(), 0, 1);

const endOfToday = () => fmtDateInput(new Date());

const maxEndDateForTwelveMonths = (start: string) => {
  const d = new Date(`${start}T00:00:00`);
  d.setFullYear(d.getFullYear() + 1);
  d.setDate(d.getDate() - 1);
  return fmtDateInput(d);
};

const isValidDateRange = ({ start, end }: DateRange) => {
  if (!start || !end) return false;
  return new Date(`${start}T00:00:00`) <= new Date(`${end}T23:59:59`);
};

const isWithinMaxTwelveMonths = ({ start, end }: DateRange) => {
  if (!isValidDateRange({ start, end })) return false;
  const maxEnd = maxEndDateForTwelveMonths(start);
  return end <= maxEnd;
};

const isWithinRange = (timestamp: string | undefined, range: DateRange) => {
  if (!timestamp) return false;
  const dt = new Date(timestamp);
  if (Number.isNaN(dt.getTime())) return false;

  const start = new Date(`${range.start}T00:00:00`);
  const end = new Date(`${range.end}T23:59:59.999`);

  return dt >= start && dt <= end;
};

const safeArrayGetter = (methodName: string): any[] => {
  try {
    const service: any = store as any;
    const fn = service?.[methodName];
    if (typeof fn !== 'function') return [];
    const result = fn.call(service);
    return Array.isArray(result) ? result : [];
  } catch {
    return [];
  }
};

const getAny = (obj: AnyRow | undefined, keys: string[]) => {
  if (!obj) return undefined;
  for (const key of keys) {
    const value = obj[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
};

const moduleText = (audit: AnyRow) =>
  `${audit.module || ''} ${audit.recordType || ''} ${audit.action || ''}`.toUpperCase();

const isModule = (audit: AnyRow, terms: string[]) => {
  const text = moduleText(audit);
  return terms.some((term) => text.includes(term.toUpperCase()));
};

const sanitizeSheetName = (name: string) =>
  name.replace(/[\\/*?:[\]]/g, '_').slice(0, 31);

const formatTimestamp = (value: any) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const roleLabel = (role: string) =>
  role
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase());

const toCurrencyNumber = (value: any) => {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return '';
  const digits = value.replace(/[^\d.-]/g, '');
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : value;
};

// ============================================================
// DATA / VISIBILITY
// ============================================================

const getAllEntityRecords = () => {
  const collections = [
    safeArrayGetter('getBookings'),
    safeArrayGetter('getPipelines'),
    safeArrayGetter('getProductions'),
    safeArrayGetter('getOfficialProductions'),
    safeArrayGetter('getOfficialProductionRows'),
    safeArrayGetter('getActivities'),
    safeArrayGetter('getReimbursements'),
    safeArrayGetter('getSupportingDocuments'),
    safeArrayGetter('getManagedServiceDocuments'),
    safeArrayGetter('getMarketingTools'),
    safeArrayGetter('getMarcommRequests'),
    safeArrayGetter('getMarcommDeliverables'),
    safeArrayGetter('getStockMovements'),
    safeArrayGetter('getSouvenirStockMovements'),
    safeArrayGetter('getStockOpnames'),
    safeArrayGetter('getSouvenirStockOpnames'),
    safeArrayGetter('getBrokers'),
    safeArrayGetter('getAgents'),
    safeArrayGetter('getTargets'),
    safeArrayGetter('getTargetUploadBatches'),
    safeArrayGetter('getDocumentHandovers'),
  ];

  const map = new Map<string, AnyRow>();

  collections.flat().forEach((record: AnyRow) => {
    const id = String(
      getAny(record, [
        'id',
        'recordId',
        'requestId',
        'transactionId',
        'pipelineId',
        'bookingId',
      ]) || ''
    );
    if (id) map.set(id, record);
  });

  return map;
};

const inferOwnerId = (record: AnyRow | undefined) =>
  String(
    getAny(record, [
      'picUserId',
      'ownerUserId',
      'userId',
      'requesterUserId',
      'requestedByUserId',
      'submittedByUserId',
      'createdByUserId',
      'marketingUserId',
    ]) || ''
  );

const isMarketingAdministrationRole = (role: string) =>
  role.includes('MARKETING_ADMINISTRATION');

const isMarketingCommunicationRole = (role: string) =>
  role.includes('MARKETING_COMMUNICATION');

const isTeamLeaderMarketingSupport = (role: string) =>
  role === 'TEAM_LEADER_MARKETING_SUPPORT';

const isMarketingRole = (role: string) => MARKETING_ROLES.has(role);

const auditBelongsToAdminScope = (audit: AnyRow) =>
  isModule(audit, [
    'BOOKING',
    'PIPELINE',
    'OUTCOME',
    'WIN',
    'LOSE',
    'POLICY',
    'POLIS',
    'PRODUCTION',
    'RECONCILIATION',
    'REIMBURSEMENT',
    'ADMIN_DOCUMENT',
    'SPAJ',
    'SPAK',
    'BROKER',
    'AGENT',
    'TANDA_TERIMA',
  ]);

const auditBelongsToMarcommScope = (audit: AnyRow) =>
  isModule(audit, [
    'MARCOMM',
    'MARKETING_TOOL',
    'MARKETING TOOLS',
    'SOUVENIR',
    'STOCK',
    'OPNAME',
    'DELIVERABLE',
  ]);

const auditBelongsToMarketingScope = (audit: AnyRow) =>
  isModule(audit, [
    'BOOKING',
    'PIPELINE',
    'OUTCOME',
    'WIN',
    'LOSE',
    'PRODUCTION',
    'RECONCILIATION',
    'ACTIVITY',
    'REIMBURSEMENT',
    'MARCOMM',
    'TANDA_TERIMA',
  ]);

const canSeeAudit = (
  currentUser: AnyRow,
  audit: AnyRow,
  entityMap: Map<string, AnyRow>
) => {
  const role = String(currentUser.role || '');
  if (role === 'SYSTEM_ADMIN') return false;

  if (isTeamLeaderMarketingSupport(role)) {
    return (
      auditBelongsToAdminScope(audit) ||
      auditBelongsToMarcommScope(audit) ||
      isModule(audit, ['TARGET', 'RKAP', 'BULK'])
    );
  }

  if (isMarketingAdministrationRole(role)) {
    return auditBelongsToAdminScope(audit);
  }

  if (isMarketingCommunicationRole(role)) {
    return auditBelongsToMarcommScope(audit);
  }

  if (!isMarketingRole(role)) return false;
  if (!auditBelongsToMarketingScope(audit)) return false;

  const recordId = String(audit.recordId || '');
  const related = entityMap.get(recordId);
  const ownerId = inferOwnerId(related);

  // If record can be resolved, enforce hierarchy.
  if (ownerId) {
    try {
      const service: any = store as any;
      if (typeof service.isUserInScope === 'function') {
        return Boolean(service.isUserInScope(currentUser, ownerId));
      }
    } catch {
      // fallback below
    }
    return ownerId === currentUser.id;
  }

  // Fallback for old audit rows that do not have entity ownership.
  // Keep own actions; Director/Advisor may see broader Marketing audit.
  if (
    role === 'DIRECTOR_MARKETING' ||
    role === 'ADVISOR_MARKETING_DIRECTOR'
  ) {
    return true;
  }

  return String(audit.userId || '') === String(currentUser.id || '');
};

const enrichAuditRow = (
  audit: AnyRow,
  entityMap: Map<string, AnyRow>
): AnyRow => {
  const record = entityMap.get(String(audit.recordId || ''));

  return {
    'Transaction ID': audit.recordId || '',
    'Related ID':
      getAny(record, [
        'pipelineId',
        'bookingId',
        'activityId',
        'requestId',
        'relatedPipelineId',
      ]) || '',
    Module: audit.module || audit.recordType || '',
    Action: audit.action || '',
    'Previous Status': audit.previousStatus || audit.previousValue || '',
    'New Status': audit.newStatus || audit.newValue || '',
    'User ID': audit.userId || '',
    'User Name': audit.userName || '',
    'Jabatan/Role': roleLabel(String(audit.userRole || '')),
    'Unit/Department':
      getAny(record, ['department', 'unit', 'functionName']) || '',
    'Action Timestamp': formatTimestamp(audit.timestamp),
    'Notes/Reason': audit.reason || audit.notes || '',
    'File Name/Document Reference':
      audit.fileReference || audit.fileName || '',
    Customer:
      getAny(record, ['customerName', 'companyName', 'clientName']) || '',
    Product: getAny(record, ['productName', 'discussedProduct']) || '',
    'Business Type': getAny(record, ['businessType']) || '',
    'PIC Marketing':
      getAny(record, ['picName', 'ownerName', 'userName']) || '',
    'Commercial Value (Rp)': toCurrencyNumber(
      getAny(record, [
        'winningQuotationAmount',
        'currentCommercialValue',
        'estimatedPremium',
        'amount',
        'invoiceAmount',
        'productionAmount',
      ]) || ''
    ),
    'Nomor Polis':
      getAny(record, [
        'policyNumber',
        'corePolicyNumber',
        'existingPolicyNumber',
      ]) || '',
    Status: getAny(record, ['status', 'reconciliationStatus']) || '',
  };
};


const getVisibleHandoverRows = (range: DateRange): AnyRow[] => {
  const service: any = store as any;
  const records = typeof service.getVisibleDocumentHandovers === 'function'
    ? service.getVisibleDocumentHandovers()
    : [];

  return records
    .filter((receipt: AnyRow) => isWithinRange(receipt.submittedAt, range))
    .map((receipt: AnyRow) => ({
      'Receipt ID': receipt.id,
      'Tanggal Penyerahan': receipt.handoverDate,
      'Jenis Penyerahan': receipt.handoverType,
      'Pengirim User ID': receipt.senderUserId,
      Pengirim: receipt.senderName,
      'Role Pengirim': roleLabel(String(receipt.senderRole || '')),
      'Penerima User ID': receipt.receiverUserId,
      Penerima: receipt.receiverName,
      'Role Penerima': roleLabel(String(receipt.receiverRole || '')),
      'Related Module': receipt.relatedModule || '',
      'Related Transaction ID': receipt.relatedTransactionId || '',
      'Related Receipt ID': receipt.relatedReceiptId || '',
      'Jumlah Item Dokumen': Array.isArray(receipt.items) ? receipt.items.length : 0,
      Status: receipt.status || '',
      'Submitted Timestamp': formatTimestamp(receipt.submittedAt),
      'Received/Decision Timestamp': formatTimestamp(receipt.receiverDecisionAt),
      'Foto Evidence': receipt.receiptPhotoFileName || '',
      'SLA Status': receipt.status === 'MENUNGGU PENERIMAAN' ? getSlaState(receipt.submittedAt) : 'CLOSED',
      'SLA Due Date': receipt.submittedAt ? formatSlaDueDate(receipt.submittedAt) : '',
      'Receiver Notes': receipt.receiverDecisionNotes || '',
    }));
};

const getVisibleHandoverItemRows = (range: DateRange): AnyRow[] => {
  const service: any = store as any;
  const records = typeof service.getVisibleDocumentHandovers === 'function'
    ? service.getVisibleDocumentHandovers()
    : [];

  return records
    .filter((receipt: AnyRow) => isWithinRange(receipt.submittedAt, range))
    .flatMap((receipt: AnyRow) =>
      (Array.isArray(receipt.items) ? receipt.items : []).map((item: AnyRow, index: number) => ({
        'Receipt ID': receipt.id,
        'Item No': index + 1,
        'Jenis Dokumen': item.documentType || '',
        'Deskripsi Dokumen': item.description || '',
        'Asli/Copy': item.physicalForm || '',
        'Qty Diserahkan': item.quantity ?? '',
        'Qty Diterima': item.receivedQuantity ?? '',
        'Status Item': item.receivedQuantity === undefined
          ? 'MENUNGGU'
          : Number(item.receivedQuantity) === Number(item.quantity)
          ? 'LENGKAP'
          : 'SELISIH',
        'Receiver Notes': item.receiverNotes || '',
        'Submitted Timestamp': formatTimestamp(receipt.submittedAt),
        'Receipt Status': receipt.status || '',
      }))
    );
};

const getHandoverSheetDefinitions = (
  role: string
): Array<[string, 'HANDOVER' | 'HANDOVER_ITEMS']> => {
  if (isMarketingCommunicationRole(role)) return [];

  if (isMarketingAdministrationRole(role) || isTeamLeaderMarketingSupport(role)) {
    return [
      ['09_Tanda_Terima', 'HANDOVER'],
      ['10_Tanda_Terima_Items', 'HANDOVER_ITEMS'],
    ];
  }

  if (isMarketingRole(role)) {
    return [
      ['07_Tanda_Terima', 'HANDOVER'],
      ['08_Tanda_Terima_Items', 'HANDOVER_ITEMS'],
    ];
  }

  return [];
};

const getRoleSheetDefinitions = (role: string) => {
  if (isMarketingCommunicationRole(role)) {
    return [
      ['01_Marcomm_Request', ['MARCOMM']],
      ['02_Marcomm_Deliverable', ['DELIVERABLE', 'SUBMIT_DELIVERABLE', 'REVISION']],
      ['03_Marketing_Tools', ['MARKETING_TOOL', 'MARKETING TOOLS']],
      ['04_Stock_Souvenir', ['SOUVENIR']],
      ['05_Stock_Movement', ['STOCK_MOVEMENT', 'STOCK IN', 'STOCK OUT', 'RESERVED']],
      ['06_Stock_Opname', ['OPNAME']],
    ] as Array<[string, string[]]>;
  }

  if (isMarketingAdministrationRole(role)) {
    return [
      ['01_Booking_Case', ['BOOKING']],
      ['02_Pipeline', ['PIPELINE']],
      ['03_WIN_LOSE', ['OUTCOME', 'WIN', 'LOSE']],
      ['04_Policy_Number', ['POLICY', 'POLIS']],
      ['05_Production_Recon', ['PRODUCTION', 'RECONCILIATION']],
      ['06_Reimbursement', ['REIMBURSEMENT']],
      ['07_Admin_Documents', ['ADMIN_DOCUMENT', 'SPAJ', 'SPAK']],
      ['08_Broker_Agent', ['BROKER', 'AGENT']],
    ] as Array<[string, string[]]>;
  }

  if (isTeamLeaderMarketingSupport(role)) {
    return [
      ['01_Target_RKAP', ['TARGET', 'RKAP']],
      ['02_Bulk_Pipeline', ['BULK']],
      ['03_Official_Production', ['PRODUCTION']],
      ['04_Booking_Pipeline', ['BOOKING', 'PIPELINE', 'OUTCOME', 'WIN', 'LOSE']],
      ['05_Reimbursement', ['REIMBURSEMENT']],
      ['06_Admin_Documents', ['ADMIN_DOCUMENT', 'SPAJ', 'SPAK']],
      ['07_Marcomm_Monitoring', ['MARCOMM', 'DELIVERABLE', 'MARKETING_TOOL']],
      ['08_Exceptions', ['EXCEPTION', 'RECONCILIATION', 'POLICY', 'POLIS']],
    ] as Array<[string, string[]]>;
  }

  return [
    ['01_Booking_Case', ['BOOKING']],
    ['02_Pipeline', ['PIPELINE']],
    ['03_WIN_LOSE', ['OUTCOME', 'WIN', 'LOSE']],
    ['04_Production_Recon', ['PRODUCTION', 'RECONCILIATION', 'POLICY', 'POLIS']],
    ['05_Activities', ['ACTIVITY']],
    ['06_Reimbursement', ['REIMBURSEMENT']],
  ] as Array<[string, string[]]>;
};

// ============================================================
// XLSX GENERATOR - NO EXTERNAL LIBRARY
// ============================================================

const xmlEscape = (value: any) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const columnName = (index: number) => {
  let n = index + 1;
  let result = '';
  while (n > 0) {
    const remainder = (n - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
};

const cellXml = (ref: string, value: any, styleId = 0) => {
  if (value === null || value === undefined || value === '') {
    return `<c r="${ref}" s="${styleId}" t="inlineStr"><is><t></t></is></c>`;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${ref}" s="${styleId}"><v>${value}</v></c>`;
  }

  if (typeof value === 'boolean') {
    return `<c r="${ref}" s="${styleId}" t="b"><v>${value ? 1 : 0}</v></c>`;
  }

  return `<c r="${ref}" s="${styleId}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(
    value
  )}</t></is></c>`;
};

const worksheetXml = (rows: AnyRow[]) => {
  const safeRows = rows.length > 0 ? rows : [{ Info: 'Tidak ada data pada periode ini' }];
  const headers = Array.from(
    new Set(safeRows.flatMap((row) => Object.keys(row)))
  );

  const headerCells = headers
    .map((header, idx) => cellXml(`${columnName(idx)}1`, header, 1))
    .join('');

  const dataRows = safeRows
    .map((row, rowIndex) => {
      const cells = headers
        .map((header, colIndex) =>
          cellXml(`${columnName(colIndex)}${rowIndex + 2}`, row[header], 0)
        )
        .join('');
      return `<row r="${rowIndex + 2}">${cells}</row>`;
    })
    .join('');

  const widths = headers
    .map((header, idx) => {
      const width = Math.min(
        45,
        Math.max(
          12,
          String(header).length + 2,
          ...safeRows.slice(0, 200).map((r) =>
            Math.min(45, String(r[header] ?? '').length + 2)
          )
        )
      );
      return `<col min="${idx + 1}" max="${idx + 1}" width="${width}" customWidth="1"/>`;
    })
    .join('');

  const lastCol = columnName(Math.max(0, headers.length - 1));
  const lastRow = safeRows.length + 1;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:${lastCol}${lastRow}"/>
  <sheetViews>
    <sheetView workbookViewId="0">
      <pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>
    </sheetView>
  </sheetViews>
  <cols>${widths}</cols>
  <sheetData>
    <row r="1">${headerCells}</row>
    ${dataRows}
  </sheetData>
  <autoFilter ref="A1:${lastCol}${lastRow}"/>
</worksheet>`;
};

const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="10"/><name val="Arial"/></font>
    <font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Arial"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF0B1F3A"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

const utf8 = (value: string) => new TextEncoder().encode(value);

const crc32Table = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

const crc32 = (data: Uint8Array) => {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    c = crc32Table[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
};

const u16 = (n: number) =>
  new Uint8Array([n & 0xff, (n >>> 8) & 0xff]);

const u32 = (n: number) =>
  new Uint8Array([
    n & 0xff,
    (n >>> 8) & 0xff,
    (n >>> 16) & 0xff,
    (n >>> 24) & 0xff,
  ]);

const concatBytes = (parts: Uint8Array[]) => {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  parts.forEach((p) => {
    out.set(p, offset);
    offset += p.length;
  });
  return out;
};

const dosDateTime = (date = new Date()) => {
  const year = Math.max(1980, date.getFullYear());
  const dosTime =
    (date.getHours() << 11) |
    (date.getMinutes() << 5) |
    Math.floor(date.getSeconds() / 2);
  const dosDate =
    ((year - 1980) << 9) |
    ((date.getMonth() + 1) << 5) |
    date.getDate();
  return { dosTime, dosDate };
};

const createZipBlob = (files: Array<{ name: string; content: string }>) => {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  const entries: ZipEntry[] = [];
  let offset = 0;
  const { dosTime, dosDate } = dosDateTime();

  files.forEach((file) => {
    const name = utf8(file.name);
    const data = utf8(file.content);
    const crc = crc32(data);

    const localHeader = concatBytes([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0), // store, no compression
      u16(dosTime),
      u16(dosDate),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      name,
    ]);

    localParts.push(localHeader, data);
    entries.push({ name: file.name, data, crc, offset });
    offset += localHeader.length + data.length;
  });

  const centralStart = offset;

  entries.forEach((entry) => {
    const name = utf8(entry.name);
    const centralHeader = concatBytes([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(dosTime),
      u16(dosDate),
      u32(entry.crc),
      u32(entry.data.length),
      u32(entry.data.length),
      u16(name.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(entry.offset),
      name,
    ]);
    centralParts.push(centralHeader);
    offset += centralHeader.length;
  });

  const centralSize = offset - centralStart;

  const end = concatBytes([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(centralSize),
    u32(centralStart),
    u16(0),
  ]);

  return new Blob([...localParts, ...centralParts, end], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
};

const buildXlsxBlob = (sheets: ExportSheet[]) => {
  const safeSheets = sheets.map((sheet, idx) => ({
    name: sanitizeSheetName(sheet.name || `Sheet${idx + 1}`),
    rows: sheet.rows,
  }));

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${safeSheets
    .map(
      (_, idx) =>
        `<Override PartName="/xl/worksheets/sheet${idx + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    )
    .join('\n  ')}
</Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    ${safeSheets
      .map(
        (sheet, idx) =>
          `<sheet name="${xmlEscape(sheet.name)}" sheetId="${idx + 1}" r:id="rId${
            idx + 1
          }"/>`
      )
      .join('\n    ')}
  </sheets>
</workbook>`;

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${safeSheets
    .map(
      (_, idx) =>
        `<Relationship Id="rId${idx + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${idx + 1}.xml"/>`
    )
    .join('\n  ')}
  <Relationship Id="rId${safeSheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const files: Array<{ name: string; content: string }> = [
    { name: '[Content_Types].xml', content: contentTypes },
    { name: '_rels/.rels', content: rootRels },
    { name: 'xl/workbook.xml', content: workbook },
    { name: 'xl/_rels/workbook.xml.rels', content: workbookRels },
    { name: 'xl/styles.xml', content: stylesXml },
    ...safeSheets.map((sheet, idx) => ({
      name: `xl/worksheets/sheet${idx + 1}.xml`,
      content: worksheetXml(sheet.rows),
    })),
  ];

  return createZipBlob(files);
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
};

// ============================================================
// COMPONENT
// ============================================================

interface DashboardTransactionExportProps {
  className?: string;
  label?: string;
}

export const DashboardTransactionExport: React.FC<
  DashboardTransactionExportProps
> = ({ className = '', label = 'Export Excel Transaksi' }) => {
  const currentUser: AnyRow = (store as any).getCurrentUser();
  const role = String(currentUser?.role || '');

  const today = new Date();
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<DateRange>({
    start: fmtDateInput(startOfYear(today)),
    end: endOfToday(),
  });
  const [error, setError] = useState('');

  const entityMap = useMemo(() => getAllEntityRecords(), [open]);

  const visibleAudits = useMemo(() => {
    const audits = safeArrayGetter('getAuditLogs');
    return audits
      .filter((audit) => isWithinRange(audit.timestamp, range))
      .filter((audit) => canSeeAudit(currentUser, audit, entityMap))
      .sort(
        (a, b) =>
          new Date(a.timestamp || 0).getTime() -
          new Date(b.timestamp || 0).getTime()
      );
  }, [currentUser, entityMap, range]);

  const sheetDefinitions = useMemo(
    () => getRoleSheetDefinitions(role),
    [role]
  );

  const handoverSheetDefinitions = useMemo(
    () => getHandoverSheetDefinitions(role),
    [role]
  );

  if (role === 'SYSTEM_ADMIN') {
    return null;
  }

  const quickSelect = (mode: 'MONTH' | '3MONTHS' | 'YTD') => {
    const now = new Date();
    if (mode === 'MONTH') {
      setRange({
        start: fmtDateInput(startOfMonth(now)),
        end: fmtDateInput(now),
      });
    }
    if (mode === '3MONTHS') {
      setRange({
        start: fmtDateInput(startOfThreeMonthsWindow(now)),
        end: fmtDateInput(now),
      });
    }
    if (mode === 'YTD') {
      setRange({
        start: fmtDateInput(startOfYear(now)),
        end: fmtDateInput(now),
      });
    }
    setError('');
  };

  const buildSheets = (): ExportSheet[] => {
    const actionRows = visibleAudits.map((audit) =>
      enrichAuditRow(audit, entityMap)
    );

    const functionalSheets = sheetDefinitions.map(([name, terms]) => ({
      name,
      rows: visibleAudits
        .filter((audit) => isModule(audit, terms))
        .map((audit) => enrichAuditRow(audit, entityMap)),
    }));

    const handoverSheets: ExportSheet[] = handoverSheetDefinitions.map(([name, type]) => ({
      name,
      rows: type === 'HANDOVER' ? getVisibleHandoverRows(range) : getVisibleHandoverItemRows(range),
    }));

    const allBusinessSheets = [...functionalSheets, ...handoverSheets];

    const summaryRows: AnyRow[] = [
      { Parameter: 'Exported By', Value: currentUser.name || '' },
      { Parameter: 'User ID', Value: currentUser.id || '' },
      { Parameter: 'Role', Value: roleLabel(role) },
      {
        Parameter: 'Unit / Department',
        Value: `${currentUser.unit || ''}${
          currentUser.department ? ` / ${currentUser.department}` : ''
        }`,
      },
      {
        Parameter: 'Export Timestamp',
        Value: formatTimestamp(new Date().toISOString()),
      },
      { Parameter: 'Period Start', Value: range.start },
      { Parameter: 'Period End', Value: range.end },
      {
        Parameter: 'Data Scope',
        Value:
          isMarketingAdministrationRole(role)
            ? 'Marketing Administration functional scope'
            : isMarketingCommunicationRole(role)
            ? 'Marketing Communication functional scope'
            : isTeamLeaderMarketingSupport(role)
            ? 'Team Leader Marketing Support monitoring scope'
            : 'Marketing role + hierarchy scope',
      },
      { Parameter: 'Total Action Records', Value: actionRows.length },
      {
        Parameter: 'Total Worksheets',
        Value: allBusinessSheets.length + 2,
      },
      ...allBusinessSheets.map((sheet) => ({
        Parameter: `Rows - ${sheet.name}`,
        Value: sheet.rows.length,
      })),
    ];

    return [
      { name: '00_Summary', rows: summaryRows },
      ...allBusinessSheets,
      {
        name: `${String(allBusinessSheets.length + 1).padStart(
          2,
          '0'
        )}_Audit_Trail_All`,
        rows: actionRows,
      },
    ];
  };

  const handleGenerate = () => {
    if (!isValidDateRange(range)) {
      setError('Tanggal mulai dan tanggal akhir wajib diisi dengan benar.');
      return;
    }

    if (!isWithinMaxTwelveMonths(range)) {
      setError(
        `Periode export maksimal 12 bulan. Untuk tanggal mulai ${range.start}, tanggal akhir maksimal ${maxEndDateForTwelveMonths(
          range.start
        )}.`
      );
      return;
    }

    const sheets = buildSheets();
    const blob = buildXlsxBlob(sheets);
    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(
      2,
      '0'
    )}${String(now.getDate()).padStart(2, '0')}_${String(
      now.getHours()
    ).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

    downloadBlob(
      blob,
      `PertaLife_Dashboard_Transaction_Export_${stamp}.xlsx`
    );

    setOpen(false);
    setError('');
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setOpen(true);
          setError('');
        }}
        className={`gap-2 font-semibold ${className}`}
      >
        <Download className="h-4 w-4" />
        {label}
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dashboard-export-title"
        >
          <div className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-gray-200 px-6 py-5">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                  <h2
                    id="dashboard-export-title"
                    className="text-lg font-bold text-gray-900"
                  >
                    Export Data Transaksi
                  </h2>
                </div>
                <p className="text-xs text-gray-500">
                  Satu workbook Excel, beberapa worksheet sesuai role dan
                  kewenangan akun.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Tutup"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5 px-6 py-5">
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs">
                <div className="font-bold text-blue-900">
                  Scope akun aktif
                </div>
                <div className="mt-1 text-blue-800">
                  {currentUser.name} · {roleLabel(role)}
                </div>
                <div className="mt-1 text-blue-700">
                  Data tetap mengikuti role, hierarchy, dan functional
                  visibility akun.
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-bold text-gray-700">
                  <CalendarRange className="h-4 w-4 text-gray-500" />
                  Quick Select
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => quickSelect('MONTH')}
                  >
                    Bulan Ini
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => quickSelect('3MONTHS')}
                  >
                    3 Bulan Terakhir
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => quickSelect('YTD')}
                  >
                    YTD
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-gray-700">
                    Periode Mulai *
                  </label>
                  <Input
                    type="date"
                    value={range.start}
                    onChange={(e) => {
                      setRange((prev) => ({ ...prev, start: e.target.value }));
                      setError('');
                    }}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-gray-700">
                    Periode Akhir *
                  </label>
                  <Input
                    type="date"
                    value={range.end}
                    onChange={(e) => {
                      setRange((prev) => ({ ...prev, end: e.target.value }));
                      setError('');
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <div className="text-[10px] font-bold uppercase text-gray-500">
                    Periode
                  </div>
                  <div className="mt-1 text-xs font-semibold text-gray-900">
                    {range.start || '-'} s.d. {range.end || '-'}
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <div className="text-[10px] font-bold uppercase text-gray-500">
                    Estimasi Action Rows
                  </div>
                  <div className="mt-1 text-lg font-black text-gray-900">
                    {visibleAudits.length.toLocaleString('id-ID')}
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <div className="text-[10px] font-bold uppercase text-gray-500">
                    Worksheets
                  </div>
                  <div className="mt-1 text-lg font-black text-gray-900">
                    {sheetDefinitions.length + handoverSheetDefinitions.length + 2}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="text-xs font-bold text-gray-800">
                  Worksheet yang akan dibuat
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-700">
                    00_Summary
                  </span>
                  {sheetDefinitions.map(([name]) => (
                    <span
                      key={name}
                      className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-700"
                    >
                      {name}
                    </span>
                  ))}
                  {handoverSheetDefinitions.map(([name]) => (
                    <span
                      key={name}
                      className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-700"
                    >
                      {name}
                    </span>
                  ))}
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-700">
                    Audit_Trail_All
                  </span>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <p className="text-[11px] text-gray-500">
                Maksimum periode per export adalah 12 bulan. Seluruh timestamp
                pada worksheet transaksi berasal dari waktu action aktual pada
                Audit Trail.
              </p>
            </div>

            <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Batal
              </Button>
              <Button
                type="button"
                onClick={handleGenerate}
                className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Generate Excel
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DashboardTransactionExport;
