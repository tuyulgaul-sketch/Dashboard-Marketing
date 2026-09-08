import type { User, ProductMaster, Pipeline } from '@/types';
import { normalizeMarketingUnit, normalizeMarketingUserId, normalizeMarketingText, resolveMarketingOwner } from './marketingWorkbook';
import { MATRIX_CHANNELS, MATRIX_CURRENCIES, pipelineMatrixIdentity, type MatrixPlan, type MatrixRow } from './rkapPipelineMatrix';

export const COMPACT_PIPELINE_HEADERS = [
  'No.', 'Companies', 'Product', 'Dist. Channel', 'Currency', 'NB/RN', 'Jenis Asuransi',
  ...Array.from({ length: 12 }, (_, i) => String(i + 1)),
  'TOTAL PREMI', 'UserID', 'Tahun', 'Catatan',
];
export const COMPACT_PIPELINE_REQUIRED = COMPACT_PIPELINE_HEADERS.filter(h => h !== 'Catatan');
export type ReportingGroup = 'Captive Marketing' | 'Corporate & Retail Marketing' | 'Advisor' | 'Directorate Marketing';
export type BatchExchangeRate = { rate: string; source: string; date: string };
export type CompactMatrixPlan = MatrixPlan & { reportingGroup: ReportingGroup; operationalDetailsPending: boolean; procurementStatus: 'Unknown' | 'Tender' | 'Non Tender' };

const clean = (v: unknown) => String(v ?? '').replace(/\u00a0/g, ' ').replace(/[\u200b-\u200d\u2060]/g, '').trim();
const key = (v: unknown) => clean(v).toLowerCase().replace(/[^a-z0-9]/g, '');
const value = (row: MatrixRow, name: string) => Object.entries(row).find(([h]) => key(h) === key(name))?.[1]?.trim() || '';
const fail = (message: string): never => { throw new Error(message); };
const exactDate = (raw: string, label: string) => {
  if (!raw) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) fail(`${label} harus YYYY-MM-DD.`);
  const d = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== raw) fail(`${label} tidak valid.`);
  return raw;
};
const number = (raw: unknown, label: string, scale: number, blank = false): bigint => {
  let text = clean(raw).replace(/\s/g, '');
  if (!text && blank) return 0n;
  if (!text || /[eE-]/.test(text)) fail(`${label} harus angka positif/nonnegatif lengkap tanpa notasi ilmiah.`);
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(text)) text = text.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(?:,\d{3})+\.\d+$/.test(text)) text = text.replace(/,/g, '');
  else if (/^\d{1,3}(?:,\d{3})+$/.test(text)) text = text.replace(/,/g, '');
  else if (text.includes(',') && !text.includes('.')) text = text.replace(',', '.');
  if (!/^\d+(?:\.\d+)?$/.test(text)) fail(`${label} memiliki format angka tidak valid.`);
  const [whole, fraction = ''] = text.split('.');
  if (fraction.length > scale && /[1-9]/.test(fraction.slice(scale))) fail(`${label} melebihi presisi mata uang.`);
  return BigInt(whole) * 10n ** BigInt(scale) + BigInt((fraction.slice(0, scale) + '0'.repeat(scale)).slice(0, scale) || '0');
};
const decimal = (n: bigint, scale: number) => scale ? `${n / 10n ** BigInt(scale)}.${String(n % 10n ** BigInt(scale)).padStart(scale, '0')}` : String(n);
const safe = (n: bigint) => { if (n > BigInt(Number.MAX_SAFE_INTEGER) || n < 0n) fail('Total melebihi batas presisi.'); return Number(n); };
const rateOf = (raw: string) => {
  if (/^\d{1,3}[.,]\d{3}$/.test(raw)) fail('Kurs ambigu. Gunakan angka tanpa pemisah ribuan.');
  if (!/^\d+(?:[.,]\d{1,6})?$/.test(raw)) fail('Kurs harus desimal positif maksimal 6 angka di belakang koma.');
  const [w, f = ''] = raw.replace(',', '.').split('.');
  const n = BigInt(w) * 1000000n + BigInt((f + '000000').slice(0, 6));
  if (n <= 0n) fail('Kurs wajib positif.');
  return n;
};

/** Resolve reporting ownership from the current master, never from names or guessed IDs. */
export const resolveReportingGroup = (owner: User, users: User[]): ReportingGroup => {
  const visited = new Set<string>();
  let current: User | undefined = owner;
  for (let depth = 0; current && depth < users.length; depth += 1) {
    if (visited.has(current.id)) fail('Hirarki User Master memiliki siklus.');
    visited.add(current.id);
    if (current.role === 'ADVISOR_MARKETING_DIRECTOR' || normalizeMarketingText(current.unit) === 'advisor pemasaran') return 'Advisor';
    if (current.role === 'VP_CAPTIVE_MARKETING' || normalizeMarketingUnit(current.unit) === 'Captive Marketing') return 'Captive Marketing';
    if (current.role === 'VP_CORPORATE_RETAIL_MARKETING' || normalizeMarketingUnit(current.unit) === 'Corporate & Retail Marketing') return 'Corporate & Retail Marketing';
    if (current.role === 'DIRECTOR_MARKETING') return 'Directorate Marketing';
    const superior = current.superiorId ? users.filter(u => normalizeMarketingUserId(u.id) === normalizeMarketingUserId(current!.superiorId)) : [];
    if (superior.length > 1) fail('Superior User ID tidak unik.');
    current = superior[0];
  }
  fail(`Unit pelaporan ${owner.id} tidak dapat ditentukan dari User Master.`);
};

/** Planning import: operational details are optional; missing details are never inferred from premium months. */
export const normalizeCompactPipeline = (rows: MatrixRow[], users: User[], products: ProductMaster[], year: number, rates: Record<string, BatchExchangeRate> = {}): CompactMatrixPlan[] => {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) fail('Tahun RKAP tidak valid.');
  if (!rows.length) fail('File Pipeline kosong.');
  const headers = new Set(Object.keys(rows[0]).map(key));
  const missing = COMPACT_PIPELINE_REQUIRED.filter(h => !headers.has(key(h)));
  if (missing.length) fail(`Kolom wajib Pipeline tidak ditemukan: ${missing.join(', ')}.`);
  const seenNumbers = new Set<string>();
  const seenOpportunities = new Set<string>();
  return rows.map((row, index) => {
    const rowNumber = index + 2;
    try {
      const rawNumber = value(row, 'No.');
      if (!/^\d+$/.test(rawNumber) || BigInt(rawNumber) <= 0n) fail('No. harus bilangan bulat positif.');
      const rowReference = BigInt(rawNumber).toString();
      if (seenNumbers.has(rowReference)) fail('No. duplikat.');
      seenNumbers.add(rowReference);
      if (value(row, 'Tahun') !== String(year)) fail(`Tahun harus ${year}.`);
      const customerName = value(row, 'Companies');
      if (customerName.length < 3) fail('Companies wajib diisi minimal 3 karakter.');
      const productName = value(row, 'Product');
      const found = products.filter(p => p.status === 'Active' && (key(p.productName) === key(productName) || key(p.productCode) === key(productName)));
      if (found.length !== 1) fail(`Product ${productName} tidak ditemukan secara unik di Master Produk aktif.`);
      const product = found[0];
      if (key(value(row, 'Jenis Asuransi')) !== key(product.insuranceType)) fail(`Jenis Asuransi harus ${product.insuranceType}.`);
      const category = value(row, 'Kategori Nasabah');
      if (category && key(category) !== key(product.customerCategory)) fail(`Kategori Nasabah harus ${product.customerCategory}.`);
      const business = value(row, 'NB/RN').toUpperCase();
      if (business !== 'NB' && business !== 'RN') fail('NB/RN harus NB atau RN.');
      const businessType: Pipeline['businessType'] = business === 'NB' ? 'New Business' : 'Renewal Business';
      const channel = MATRIX_CHANNELS.find(c => key(c) === key(value(row, 'Dist. Channel')));
      if (!channel) fail('Dist. Channel tidak valid.');
      const resolved = resolveMarketingOwner(value(row, 'UserID'), users);
      if (!resolved.user || resolved.errors.length) fail(resolved.errors.join('; ') || 'UserID tidak valid.');
      const owner = resolved.user;
      const reportingGroup = resolveReportingGroup(owner, users);
      const currency = value(row, 'Currency').toUpperCase();
      if (!(MATRIX_CURRENCIES as readonly string[]).includes(currency)) fail('Currency tidak didukung.');
      const scale = currency === 'IDR' || currency === 'JPY' ? 0 : 2;
      const original = Array.from({ length: 12 }, (_, i) => number(value(row, String(i + 1)), `Bulan ${i + 1}`, scale, true));
      const total = original.reduce((a, b) => a + b, 0n);
      if (total <= 0n) fail('TOTAL PREMI harus positif.');
      if (number(value(row, 'TOTAL PREMI'), 'TOTAL PREMI', scale) !== total) fail('TOTAL PREMI tidak sama dengan jumlah bulan 1–12.');
      const fx = rates[currency] || { rate: value(row, 'Kurs ke IDR'), source: value(row, 'Sumber Kurs'), date: value(row, 'Tanggal Kurs') };
      let rate = 1000000n;
      let exchangeRateSource = '';
      let exchangeRateDate = '';
      if (currency !== 'IDR') {
        if (!fx.rate || !fx.source || !fx.date) fail(`Kurs ${currency} yang disetujui beserta sumber dan tanggalnya harus tersedia sebelum nilai IDR dipublish.`);
        rate = rateOf(fx.rate);
        exchangeRateSource = fx.source;
        exchangeRateDate = exactDate(fx.date, 'Tanggal Kurs');
      } else if (fx.rate && rateOf(fx.rate) !== 1000000n) fail('Kurs IDR ke IDR harus 1.');
      const factor = 10n ** BigInt(scale);
      const converted = original.map(n => currency === 'IDR' ? n : (n * rate + factor * 500000n) / (factor * 1000000n));
      const monthlyIdr = converted.map(safe);
      const totalIdr = safe(converted.reduce((a, b) => a + b, 0n));
      const targetClosingDate = exactDate(value(row, 'Estimasi Tanggal Closing'), 'Estimasi Tanggal Closing');
      if (targetClosingDate && Number(targetClosingDate.slice(0, 4)) !== year) fail('Tahun closing harus sama dengan Tahun RKAP.');
      const procurement = value(row, 'Metode Pengadaan');
      if (procurement && !['Tender', 'Non Tender'].includes(procurement)) fail('Metode Pengadaan tidak valid.');
      const procurementStatus = (procurement || 'Unknown') as CompactMatrixPlan['procurementStatus'];
      const existingPolicyNumber = value(row, 'Existing Policy Number');
      const policyYear = value(row, 'Original Policy Year');
      if (policyYear && (!/^\d{4}$/.test(policyYear) || Number(policyYear) < 1900 || Number(policyYear) > year)) fail('Original Policy Year tidak valid.');
      const coverageStart = exactDate(value(row, 'Coverage Start'), 'Coverage Start');
      const coverageEnd = exactDate(value(row, 'Coverage End'), 'Coverage End');
      if (coverageStart && coverageEnd && coverageEnd < coverageStart) fail('Coverage End lebih awal dari Coverage Start.');
      const renewalType = value(row, 'Renewal Type') as Pipeline['renewalType'] | '';
      if (renewalType && !['Regular Renewal', 'Salary / Exposure Adjustment', 'Benefit Adjustment', 'Other Renewal'].includes(renewalType)) fail('Renewal Type tidak valid.');
      const paymentMode = value(row, 'Cara Bayar');
      const identity = pipelineMatrixIdentity(year, customerName, product.productName);
      if (seenOpportunities.has(identity)) fail('Duplikat Companies + Product dalam tahun yang sama.');
      seenOpportunities.add(identity);
      const warnings = [...resolved.warnings];
      if (!targetClosingDate || !procurement) warnings.push('Informasi closing/pengadaan belum tersedia; lengkapi saat proses operasional.');
      if (business === 'RN' && !existingPolicyNumber) warnings.push('Referensi polis Renewal belum tersedia; lengkapi saat Booking Case.');
      return { rowNumber, rowReference, year, customerName, productId: product.id, productName: product.productName, insuranceType: product.insuranceType, customerCategory: product.customerCategory, businessType, channel, owner, reportingGroup, operationalDetailsPending: !targetClosingDate || !procurement, procurementStatus, currency, exchangeRate: currency === 'IDR' ? '1' : decimal(rate, 6), exchangeRateSource: exchangeRateSource || undefined, exchangeRateDate: exchangeRateDate || undefined, paymentMode: paymentMode || undefined, monthlyOriginal: original.map(n => decimal(n, scale)), monthlyIdr, totalOriginal: decimal(total, scale), totalIdr, targetClosingDate, isTender: procurement === 'Tender', existingPolicyNumber: existingPolicyNumber || undefined, originalPolicyYear: policyYear ? Number(policyYear) : undefined, coverageStart: coverageStart || undefined, coverageEnd: coverageEnd || undefined, renewalType: renewalType || undefined, notes: value(row, 'Catatan') || undefined, warnings };
    } catch (error) { throw new Error(`Baris ${rowNumber}: ${error instanceof Error ? error.message : 'Data Pipeline tidak valid.'}`); }
  });
};
