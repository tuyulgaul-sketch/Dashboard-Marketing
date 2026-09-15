import React, { useEffect, useRef } from 'react';
import {
  MARKETING_SHEETS,
  normalizeMarketingFunction,
  readMarketingSpreadsheet,
  resolveMarketingOwner,
} from '@/utils/marketingWorkbook';
import { store, type OfficialProductionBatch } from '@/services/store';

export const OFFICIAL_PRODUCTION_DETAIL_STORAGE_KEY = 'pertalife_official_production_policy_details';

const REQUIRED_HEADERS = [
  'Tahun Produksi',
  'Bulan Produksi',
  'Nama Produk',
  'Realisasi Produksi (Rp)',
  'Fungsi Marketing',
  'Jenis Bisnis',
  'User ID Pemilik Realisasi',
];

type DetailRecord = {
  id: string;
  productionYear: number;
  productionMonth: number;
  policyNumber: string;
  customerName: string;
  productName: string;
  productionAmount: number;
  sourceRowCount: number;
  marketingFunction: 'Captive Marketing' | 'Corporate & Retail Marketing' | 'Advisor';
  department: string;
  businessType: 'New Business' | 'Renewal Business';
  picUserId: string;
  sourceBatchId: string;
  sourceFilename: string;
  legacyBackfill?: boolean;
};

type PendingCapture = {
  filename: string;
  records: Omit<DetailRecord, 'id' | 'sourceBatchId' | 'sourceFilename' | 'sourceRowCount'>[];
  total: number;
};

const normalizeHeader = (value: string) => String(value || '')
  .replace(/^\uFEFF/, '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '');

const getRowValue = (row: Record<string, string>, ...aliases: string[]) => {
  for (const alias of aliases) {
    const key = Object.keys(row).find(candidate => normalizeHeader(candidate) === normalizeHeader(alias));
    if (key) return String(row[key] ?? '').trim();
  }
  return '';
};

const parseMonth = (value: string) => {
  const raw = String(value || '').trim().toLowerCase().replace(/\./g, '');
  const numeric = Number(raw);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 12) return numeric;
  const aliases: Record<string, number> = {
    januari: 1, jan: 1, februari: 2, feb: 2, maret: 3, mar: 3,
    april: 4, apr: 4, mei: 5, may: 5, juni: 6, jun: 6,
    juli: 7, jul: 7, agustus: 8, agu: 8, ags: 8, aug: 8,
    september: 9, sep: 9, oktober: 10, okt: 10, oct: 10,
    november: 11, nov: 11, desember: 12, des: 12, dec: 12,
  };
  return aliases[raw] || 0;
};

const parseRupiah = (value: string): number | null => {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  let cleaned = raw.replace(/rp/gi, '').replace(/\s/g, '');
  const negative = cleaned.startsWith('(') && cleaned.endsWith(')');
  cleaned = cleaned.replace(/[()]/g, '');
  if (/^-?\d{1,3}([.,]\d{3})+$/.test(cleaned)) {
    cleaned = cleaned.replace(/[.,]/g, '');
  } else if (cleaned.includes(',') && cleaned.includes('.')) {
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    cleaned = lastComma > lastDot
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(/,/g, '');
  } else if (cleaned.includes(',')) {
    const parts = cleaned.split(',');
    cleaned = parts.length === 2 && parts[1].length <= 2
      ? cleaned.replace(',', '.')
      : cleaned.replace(/,/g, '');
  }
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(negative ? -Math.abs(parsed) : parsed);
};

const normalizeBusinessType = (value: string): 'New Business' | 'Renewal Business' | null => {
  const compact = String(value || '').trim().toLowerCase().replace(/[^a-z]/g, '');
  if (['newbusiness', 'newbisnis', 'newbisinis', 'firstyear'].includes(compact)) return 'New Business';
  if (['renewal', 'renewalbusiness', 'lanjutan'].includes(compact)) return 'Renewal Business';
  return null;
};

const periodKey = (row: Pick<DetailRecord, 'productionYear' | 'productionMonth'>) =>
  `${row.productionYear}-${String(row.productionMonth).padStart(2, '0')}`;

const parseExisting = (): DetailRecord[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(OFFICIAL_PRODUCTION_DETAIL_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed as DetailRecord[] : [];
  } catch {
    return [];
  }
};

const aggregateForBatch = (batch: OfficialProductionBatch, rows: PendingCapture['records']): DetailRecord[] => {
  const grouped = new Map<string, Omit<DetailRecord, 'id'>>();
  rows.forEach(row => {
    const policyKey = row.policyNumber.trim().toUpperCase();
    const key = [
      row.productionYear,
      row.productionMonth,
      policyKey,
      row.productName.trim().toUpperCase(),
      row.marketingFunction,
      row.department,
      row.businessType,
      row.picUserId,
    ].join('||');
    const previous = grouped.get(key);
    if (previous) {
      previous.productionAmount += row.productionAmount;
      previous.sourceRowCount += 1;
      if (!previous.customerName && row.customerName) previous.customerName = row.customerName;
      return;
    }
    grouped.set(key, {
      ...row,
      sourceRowCount: 1,
      sourceBatchId: batch.id,
      sourceFilename: batch.filename,
    });
  });

  return [...grouped.values()]
    .sort((a, b) => a.productionYear - b.productionYear || a.productionMonth - b.productionMonth || a.productName.localeCompare(b.productName, 'id') || a.policyNumber.localeCompare(b.policyNumber, 'id'))
    .map((row, index) => ({ ...row, id: `OPD-${batch.id}-${String(index + 1).padStart(5, '0')}` }));
};

/**
 * Captures the exact validated Realisasi XLSX at the publisher screen and stores
 * a compact per-period/per-policy aggregate only after the same file becomes an
 * Official Production batch. It never changes official summary totals.
 */
const OfficialProductionDetailCapture: React.FC = () => {
  const pendingRef = useRef<PendingCapture | null>(null);
  const knownBatchIdsRef = useRef<Set<string>>(new Set(store.getOfficialProductionBatches().map(batch => batch.id)));

  useEffect(() => {
    let parseSequence = 0;

    const onFileChange = (event: Event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || input.type !== 'file') return;
      const file = input.files?.[0];
      if (!file) return;
      const sequence = ++parseSequence;

      void (async () => {
        try {
          const parsed = await readMarketingSpreadsheet(file, {
            sheetName: MARKETING_SHEETS.production,
            requiredHeaders: REQUIRED_HEADERS,
          });
          if (sequence !== parseSequence) return;

          const users = store.getUsers().filter(user => user.role !== 'SYSTEM_ADMIN');
          const products = store.getProducts();
          const records: PendingCapture['records'] = [];

          parsed.forEach((row, index) => {
            const rowNumber = index + 2;
            const year = Number(getRowValue(row, 'Tahun Produksi', 'Tahun'));
            const month = parseMonth(getRowValue(row, 'Bulan Produksi', 'Bulan'));
            const amount = parseRupiah(getRowValue(row, 'Realisasi Produksi (Rp)', 'TOTAL Piutang'));
            const marketingFunction = normalizeMarketingFunction(getRowValue(row, 'Fungsi Marketing', 'DISTRIBUSI PEMASARAN'));
            const businessType = normalizeBusinessType(getRowValue(row, 'Jenis Bisnis', 'STATUS PREMI'));
            const productRaw = getRowValue(row, 'Nama Produk', 'PRODUK');
            const ownerId = getRowValue(row, 'User ID Pemilik Realisasi', 'PIC User ID');
            const picRaw = getRowValue(row, 'PIC Marketing', 'PIC');
            const owner = resolveMarketingOwner(ownerId, users, { unit: marketingFunction || undefined, name: picRaw, production: true });
            if (!Number.isInteger(year) || year < 2000 || year > 2100 || month < 1 || month > 12 || amount === null || !marketingFunction || !businessType || !productRaw || owner.errors.length || !owner.user) return;

            const normalizedProductInput = store.normalizeProductName(productRaw);
            const productMasterMatch = products.find(product => product.productName.trim().toLowerCase() === normalizedProductInput.trim().toLowerCase());
            const productName = productMasterMatch ? productMasterMatch.productName : normalizedProductInput;
            const policyRaw = getRowValue(row, 'Nomor Polis', 'NO POLIS');
            const policyNumber = policyRaw || `DUMMY-POL-${year}${String(month).padStart(2, '0')}-${String(rowNumber).padStart(6, '0')}`;
            const customerRaw = getRowValue(row, 'Nama Nasabah', 'Nama Pemegang Polis', 'PERUSAHAAN');
            const customerName = customerRaw || (policyRaw ? `Existing Client - ${policyNumber}` : `Existing Client Dummy - ${productRaw || 'Produk'}`);

            records.push({
              productionYear: year,
              productionMonth: month,
              policyNumber,
              customerName,
              productName,
              productionAmount: amount,
              marketingFunction,
              department: owner.user.department || 'None',
              businessType,
              picUserId: owner.user.id,
            });
          });

          if (!records.length) return;
          pendingRef.current = {
            filename: file.name,
            records,
            total: records.reduce((sum, row) => sum + row.productionAmount, 0),
          };
          knownBatchIdsRef.current = new Set(store.getOfficialProductionBatches().map(batch => batch.id));
        } catch {
          // Not a Realisasi workbook (for example a Target/Bulk workbook); ignore.
        }
      })();
    };

    document.addEventListener('change', onFileChange, true);
    return () => document.removeEventListener('change', onFileChange, true);
  }, []);

  useEffect(() => store.subscribe(() => {
    const pending = pendingRef.current;
    if (!pending) return;

    const candidate = store.getOfficialProductionBatches()
      .filter(batch => !knownBatchIdsRef.current.has(batch.id) && batch.status === 'Published' && batch.filename === pending.filename)
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())[0];
    if (!candidate) return;

    knownBatchIdsRef.current.add(candidate.id);
    const sameCount = candidate.validRowCount === pending.records.length;
    const sameTotal = Number(candidate.totalProductionAmount) === Number(pending.total);
    if (!sameCount || !sameTotal) {
      console.warn('[Official Production Detail] Detail capture skipped because XLSX reconciliation did not match the published batch.', {
        batchId: candidate.id,
        publishedRows: candidate.validRowCount,
        capturedRows: pending.records.length,
        publishedTotal: candidate.totalProductionAmount,
        capturedTotal: pending.total,
      });
      pendingRef.current = null;
      return;
    }

    const nextDetails = aggregateForBatch(candidate, pending.records);
    const replacedPeriods = new Set(candidate.publishedPeriodKeys);
    const retained = parseExisting().filter(row => !replacedPeriods.has(periodKey(row)));
    localStorage.setItem(OFFICIAL_PRODUCTION_DETAIL_STORAGE_KEY, JSON.stringify([...nextDetails, ...retained]));
    pendingRef.current = null;
  }), []);

  return null;
};

export default OfficialProductionDetailCapture;
