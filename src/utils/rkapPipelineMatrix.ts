import type { Pipeline, ProductMaster, User } from '@/types';

export type MatrixRow = Record<string, string>;
export const RKAP_PIPELINE_HEADERS = [
  'No.', 'Companies', 'Product', 'Dist. Channel', 'Currency', 'NB/RN', 'Jenis Asuransi',
  ...Array.from({ length: 12 }, (_, index) => String(index + 1)),
  'TOTAL PREMI', 'UserID', 'Tahun', 'Cara Bayar', 'Kategori Nasabah',
  'Estimasi Tanggal Closing', 'Metode Pengadaan', 'Existing Policy Number',
  'Original Policy Year', 'Coverage Start', 'Coverage End', 'Renewal Type',
  'Catatan', 'Kurs ke IDR', 'Sumber Kurs', 'Tanggal Kurs',
];
export const MATRIX_REQUIRED_HEADERS = [
  'No.', 'Companies', 'Product', 'Dist. Channel', 'Currency', 'NB/RN', 'Jenis Asuransi',
  ...Array.from({ length: 12 }, (_, index) => String(index + 1)), 'TOTAL PREMI', 'UserID',
  'Tahun', 'Estimasi Tanggal Closing', 'Metode Pengadaan',
];
export const MATRIX_PAYMENT_MODES = ['Single', 'Bulanan', 'Triwulanan', 'Semesteran', 'Tahunan', 'Lainnya'] as const;
export const MATRIX_CHANNELS = ['Direct Selling', 'Agent', 'Broker', 'BUSB'] as const;
export const MATRIX_CURRENCIES = ['IDR', 'USD', 'SGD', 'EUR', 'JPY', 'GBP', 'AUD', 'CHF', 'HKD'] as const;

const clean = (value: unknown): string => String(value ?? '').replace(/\u00a0/g, ' ').replace(/[\u200b-\u200d\u2060]/g, '').trim();
const keyOf = (value: unknown): string => clean(value).toLowerCase().replace(/[^a-z0-9]/g, '');
const idOf = (value: unknown): string => clean(value).toUpperCase();
const valueOf = (row: MatrixRow, ...names: string[]): string => {
  const values = new Map(Object.entries(row).map(([key, value]) => [keyOf(key), clean(value)]));
  for (const name of names) if (values.has(keyOf(name))) return values.get(keyOf(name)) || '';
  return '';
};
const fail = (message: string): never => { throw new Error(message); };
const exactDate = (raw: unknown, label: string, required = false): string => {
  const text = clean(raw);
  if (!text) { if (required) fail(`${label} wajib diisi.`); return ''; }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) fail(`${label} harus menggunakan YYYY-MM-DD.`);
  const year = Number(match![1]);
  const month = Number(match![2]);
  const day = Number(match![3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) fail(`${label} bukan tanggal kalender yang valid.`);
  return text;
};
const parseExchangeRate = (raw: unknown): bigint => {
  const text = clean(raw).replace(/\s/g, '');
  if (!text || /[eE-]/.test(text)) fail('Kurs ke IDR harus angka desimal positif tanpa notasi ilmiah.');
  if (/^\d{1,3}[.,]\d{3}$/.test(text)) fail('Kurs ambigu. Isi tanpa pemisah ribuan, misalnya 16000.50.');
  const normalized = text.replace(',', '.');
  if (!/^\d+(?:\.\d{1,6})?$/.test(normalized)) fail('Kurs ke IDR harus angka tanpa pemisah ribuan, maksimal 6 desimal.');
  const [whole, fraction = ''] = normalized.split('.');
  const units = BigInt(whole) * 1000000n + BigInt((fraction + '000000').slice(0, 6));
  if (units <= 0n) fail('Kurs ke IDR harus positif.');
  return units;
};

const numeric = (raw: unknown, label: string, scale: number, allowBlank = false): bigint => {
  let text = clean(raw).replace(/\s/g, '');
  if (!text && allowBlank) return 0n;
  if (!text || /[eE]/.test(text) || text.startsWith('-')) fail(`${label} harus angka lengkap yang tidak negatif, bukan notasi ilmiah.`);
  text = text.replace(/^\+/, '');
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(text)) text = text.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(?:,\d{3})+\.\d+$/.test(text)) text = text.replace(/,/g, '');
  else if (/^\d{1,3}(?:,\d{3})+$/.test(text)) text = text.replace(/,/g, '');
  else if (text.includes(',') && !text.includes('.')) text = text.replace(',', '.');
  if (!/^\d+(?:\.\d+)?$/.test(text)) fail(`${label} memiliki format angka tidak valid.`);
  const [whole, fraction = ''] = text.split('.');
  if (fraction.length > scale && /[1-9]/.test(fraction.slice(scale))) fail(`${label} memiliki desimal melebihi presisi mata uang.`);
  const units = BigInt(whole) * 10n ** BigInt(scale) + BigInt((fraction.slice(0, scale) + '0'.repeat(scale)).slice(0, scale) || '0');
  if (units < 0n) fail(`${label} tidak boleh negatif.`);
  return units;
};
const safeNumber = (value: bigint, label: string): number => {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) fail(`${label} melebihi batas angka presisi.`);
  return Number(value);
};
const sum = (values: bigint[]) => values.reduce((total, value) => total + value, 0n);
const decimalText = (value: bigint, scale: number): string => {
  const base = 10n ** BigInt(scale);
  return scale ? `${value / base}.${String(value % base).padStart(scale, '0')}` : String(value);
};
export const normalizedCustomer = (value: string) => clean(value).toLowerCase().replace(/&/g, ' dan ').replace(/[^a-z0-9]+/g, ' ').split(' ').filter(token => token && !['pt', 'persero', 'perseroan', 'terbatas', 'tbk', 'cv'].includes(token)).join(' ');
export const pipelineMatrixIdentity = (year: number, customer: string, product: string): string => `${year}|${normalizedCustomer(customer)}|${keyOf(product)}`;
export const isPipelineMatrix = (rows: MatrixRow[]): boolean => !!rows.length && ['companies', 'totalpremi', 'userid'].some(key => Object.keys(rows[0]).some(header => keyOf(header) === key));
export const makePipelineMatrixTemplate = (year: number): MatrixRow[] => {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) fail('Tahun RKAP tidak valid.');
  return [Object.fromEntries(RKAP_PIPELINE_HEADERS.map(header => [header, header === 'Tahun' ? String(year) : header === 'Currency' ? 'IDR' : header === 'No.' ? '1' : '']))];
};

export interface MatrixPlan {
  rowNumber: number;
  rowReference: string;
  year: number;
  customerName: string;
  productId: string;
  productName: string;
  insuranceType: ProductMaster['insuranceType'];
  customerCategory: ProductMaster['customerCategory'];
  businessType: Pipeline['businessType'];
  channel: Pipeline['channel'];
  owner: User;
  currency: string;
  exchangeRate: string;
  exchangeRateSource?: string;
  exchangeRateDate?: string;
  paymentMode?: string;
  monthlyOriginal: string[];
  monthlyIdr: number[];
  totalOriginal: string;
  totalIdr: number;
  targetClosingDate: string;
  isTender: boolean;
  existingPolicyNumber?: string;
  originalPolicyYear?: number;
  coverageStart?: string;
  coverageEnd?: string;
  renewalType?: Pipeline['renewalType'];
  notes?: string;
  warnings: string[];
}

export const normalizePipelineMatrix = (rows: MatrixRow[], users: User[], products: ProductMaster[], year: number): MatrixPlan[] => {
  if (!rows.length) fail('File Pipeline kosong.');
  const headers = new Set(Object.keys(rows[0]).map(keyOf));
  const missing = MATRIX_REQUIRED_HEADERS.filter(header => !headers.has(keyOf(header)));
  if (missing.length) fail(`Kolom wajib Pipeline tidak ditemukan: ${missing.join(', ')}.`);
  const seenNumbers = new Set<string>();
  const seenOpportunities = new Set<string>();
  const results: MatrixPlan[] = [];
  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2;
    try {
      const rawRowReference = valueOf(row, 'No.');
      if (!/^\d+$/.test(rawRowReference) || BigInt(rawRowReference) <= 0n) fail('No. harus angka positif dan unik dalam file.');
      const rowReference = BigInt(rawRowReference).toString();
      if (seenNumbers.has(rowReference)) fail('No. harus angka positif dan unik dalam file.');
      seenNumbers.add(rowReference);
      const rowYear = valueOf(row, 'Tahun');
      if (rowYear !== String(year)) fail(`Tahun harus ${year}.`);
      const customerName = valueOf(row, 'Companies');
      const productName = valueOf(row, 'Product');
      if (customerName.length < 3) fail('Companies wajib diisi minimal tiga karakter.');
      const productsFound = products.filter(product => keyOf(product.productName) === keyOf(productName) && product.status === 'Active');
      if (productsFound.length !== 1) fail(`Product ${productName} harus ditemukan secara unik di Master Produk aktif.`);
      const product = productsFound[0];
      const insuranceType = valueOf(row, 'Jenis Asuransi');
      if (keyOf(insuranceType) !== keyOf(product.insuranceType)) fail(`Jenis Asuransi tidak sesuai Master Produk: ${product.insuranceType}.`);
      const category = valueOf(row, 'Kategori Nasabah');
      if (category && keyOf(category) !== keyOf(product.customerCategory)) fail(`Kategori Nasabah tidak sesuai Master Produk: ${product.customerCategory}.`);
      const rawBusiness = valueOf(row, 'NB/RN').toUpperCase();
      if (!['NB', 'RN'].includes(rawBusiness)) fail('NB/RN harus NB atau RN.');
      const businessType: Pipeline['businessType'] = rawBusiness === 'NB' ? 'New Business' : 'Renewal Business';
      const channelInput = valueOf(row, 'Dist. Channel');
      const channel = MATRIX_CHANNELS.find(value => keyOf(value) === keyOf(channelInput));
      if (!channel) fail('Dist. Channel harus Direct Selling, Agent, Broker, atau BUSB.');
      const ownerId = idOf(valueOf(row, 'UserID'));
      const owners = users.filter(user => idOf(user.id) === ownerId);
      if (!/^USR-\d{6}$/.test(ownerId) || owners.length !== 1 || owners[0].status !== 'Active' || !['DIRECTOR_MARKETING','ADVISOR_MARKETING_DIRECTOR','VP_CAPTIVE_MARKETING','VP_CORPORATE_RETAIL_MARKETING','DEPARTMENT_HEAD_MARKETING','SUPERVISOR_MARKETING','STAFF_MARKETING'].includes(owners[0].role)) fail(`UserID ${ownerId || '(kosong)'} bukan pemilik Pipeline Marketing aktif yang valid.`);
      const owner = owners[0];
      const currency = valueOf(row, 'Currency').toUpperCase();
      if (!(MATRIX_CURRENCIES as readonly string[]).includes(currency)) fail(`Currency ${currency} belum didukung; gunakan mata uang yang tersedia pada template.`);
      const scale = currency === 'JPY' || currency === 'IDR' ? 0 : 2;
      const original = Array.from({ length: 12 }, (_, month) => numeric(valueOf(row, String(month + 1)), `Bulan ${month + 1}`, scale, true));
      const total = sum(original);
      if (total <= 0n) fail('TOTAL PREMI harus positif; minimal satu bulan wajib memiliki premi.');
      const submittedTotal = numeric(valueOf(row, 'TOTAL PREMI'), 'TOTAL PREMI', scale);
      if (submittedTotal !== total) fail(`TOTAL PREMI tidak sama dengan jumlah bulan 1–12. Selisih ${decimalText(submittedTotal - total, scale)} ${currency}.`);
      let exchangeRate = '1';
      let exchangeRateSource = '';
      let exchangeRateDate = '';
      let rateUnits = 1000000n;
      if (currency !== 'IDR') {
        rateUnits = parseExchangeRate(valueOf(row, 'Kurs ke IDR'));
        if (rateUnits <= 0n) fail('Kurs ke IDR wajib positif untuk mata uang selain IDR.');
        exchangeRate = decimalText(rateUnits, 6);
        exchangeRateSource = valueOf(row, 'Sumber Kurs');
        exchangeRateDate = exactDate(valueOf(row, 'Tanggal Kurs'), 'Tanggal Kurs', true);
        if (!exchangeRateSource) fail('Sumber Kurs wajib diisi untuk konversi mata uang asing.');
      } else if (valueOf(row, 'Kurs ke IDR') && parseExchangeRate(valueOf(row, 'Kurs ke IDR')) !== 1000000n) fail('Kurs IDR ke IDR harus 1.');
      const factor = 10n ** BigInt(scale);
      const converted = original.map(amount => currency === 'IDR' ? amount : (amount * rateUnits + factor * 500000n) / (factor * 1000000n));
      const totalIdr = sum(converted);
      const monthlyIdr = converted.map((amount, month) => safeNumber(amount, `Bulan ${month + 1}`));
      const warnings: string[] = [];
      const rawPaymentMode = valueOf(row, 'Cara Bayar');
      const paymentMode = ({ kwartalan: 'Triwulanan', quarterly: 'Triwulanan', monthly: 'Bulanan', semiannual: 'Semesteran', annual: 'Tahunan', yearly: 'Tahunan', single: 'Single' } as Record<string, string>)[rawPaymentMode.toLowerCase()] || rawPaymentMode;
      if (paymentMode && !(MATRIX_PAYMENT_MODES as readonly string[]).includes(paymentMode)) fail('Cara Bayar tidak valid.');
      const populated = original.map((amount, month) => amount > 0n ? month + 1 : 0).filter(Boolean);
      if (paymentMode && paymentMode !== 'Lainnya') {
        const expectedCount = { Single: 1, Bulanan: 12, Triwulanan: 4, Semesteran: 2, Tahunan: 1 }[paymentMode];
        if (populated.length !== expectedCount) warnings.push(`Cara Bayar ${paymentMode} memiliki ${populated.length} bulan premi. Periksa apakah jadwal memang mencakup satu tahun penuh atau terdapat penyesuaian.`);
      }
      const targetClosingDate = exactDate(valueOf(row, 'Estimasi Tanggal Closing'), 'Estimasi Tanggal Closing', true);
      if (Number(targetClosingDate.slice(0, 4)) !== year) fail('Tahun Estimasi Tanggal Closing harus sama dengan Tahun RKAP.');
      const procurement = valueOf(row, 'Metode Pengadaan');
      if (!['Tender', 'Non Tender'].includes(procurement)) fail('Metode Pengadaan harus Tender atau Non Tender.');
      const existingPolicyNumber = valueOf(row, 'Existing Policy Number');
      const originalPolicyYearText = valueOf(row, 'Original Policy Year');
      if (originalPolicyYearText && (!/^\d{4}$/.test(originalPolicyYearText) || Number(originalPolicyYearText) < 1900 || Number(originalPolicyYearText) > year)) fail('Original Policy Year tidak valid.');
      const coverageStart = exactDate(valueOf(row, 'Coverage Start'), 'Coverage Start');
      const coverageEnd = exactDate(valueOf(row, 'Coverage End'), 'Coverage End');
      if (coverageStart && coverageEnd && coverageEnd < coverageStart) fail('Coverage End tidak boleh lebih awal dari Coverage Start.');
      const renewalType = valueOf(row, 'Renewal Type') as Pipeline['renewalType'] | '';
      if (renewalType && !['Regular Renewal', 'Salary / Exposure Adjustment', 'Benefit Adjustment', 'Other Renewal'].includes(renewalType)) fail('Renewal Type tidak valid.');
      if (businessType === 'Renewal Business' && !existingPolicyNumber) warnings.push('Renewal belum memiliki Existing Policy Number. Lengkapi referensi polis sebelum proses operasional membutuhkan polis existing.');
      const identity = pipelineMatrixIdentity(year, customerName, product.productName);
      if (seenOpportunities.has(identity)) fail('Duplikat Companies + Product dalam tahun yang sama. Satu opportunity hanya boleh memiliki satu PIC dan satu jadwal tahunan.');
      seenOpportunities.add(identity);
      results.push({ rowNumber, rowReference, year, customerName, productId: product.id, productName: product.productName, insuranceType: product.insuranceType, customerCategory: product.customerCategory, businessType, channel, owner, currency, exchangeRate, exchangeRateSource: exchangeRateSource || undefined, exchangeRateDate: exchangeRateDate || undefined, paymentMode: paymentMode || undefined, monthlyOriginal: original.map(value => decimalText(value, scale)), monthlyIdr, totalOriginal: decimalText(total, scale), totalIdr: safeNumber(totalIdr, 'Total premi IDR'), targetClosingDate, isTender: procurement === 'Tender', existingPolicyNumber: existingPolicyNumber || undefined, originalPolicyYear: originalPolicyYearText ? Number(originalPolicyYearText) : undefined, coverageStart: coverageStart || undefined, coverageEnd: coverageEnd || undefined, renewalType: renewalType || undefined, notes: valueOf(row, 'Catatan') || undefined, warnings });
    } catch (error) {
      throw new Error(`Baris ${rowNumber}: ${error instanceof Error ? error.message : 'Data Pipeline tidak valid.'}`);
    }
  }
  return results;
};

export const getRkapMonthlyValue = (pipeline: Pipeline, year: number, month: number): number => {
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error('Bulan Pipeline harus 1–12.');
  const schedule = pipeline.rkapPremiumSchedule;
  if (schedule) {
    if (!Array.isArray(schedule.monthlyIdr) || schedule.monthlyIdr.length !== 12 || schedule.monthlyIdr.some(value => !Number.isSafeInteger(value) || value < 0) || !Number.isSafeInteger(schedule.totalIdr) || !Number.isSafeInteger(schedule.monthlyIdr.reduce((total, value) => total + value, 0)) || schedule.monthlyIdr.reduce((total, value) => total + value, 0) !== schedule.totalIdr) throw new Error('Jadwal premi RKAP tersimpan tidak valid. Periksa integritas data sebelum menghitung laporan.');
    return schedule.year === year ? schedule.monthlyIdr[month - 1] : 0;
  }
  const explicitYear = Number((pipeline as Pipeline & { pipelineYear?: number }).pipelineYear);
  const explicitMonth = Number((pipeline as Pipeline & { pipelineMonth?: number }).pipelineMonth);
  const date = pipeline.currentTargetClosingDate || pipeline.originalTargetClosingDate;
  const fallbackYear = Number(date?.slice(0, 4));
  const fallbackMonth = Number(date?.slice(5, 7));
  return (Number.isInteger(explicitYear) && explicitYear > 0 ? explicitYear : fallbackYear) === year && (Number.isInteger(explicitMonth) && explicitMonth >= 1 && explicitMonth <= 12 ? explicitMonth : fallbackMonth) === month ? Number(pipeline.currentCommercialValue || 0) : 0;
};

export const getRkapWinMonthlyValue = (pipeline: Pipeline, year: number, month: number): number => {
  if (pipeline.rkapPremiumSchedule) return getRkapMonthlyValue(pipeline, year, month);
  const date = pipeline.winDate || pipeline.actualClosingDate || pipeline.currentTargetClosingDate;
  return Number(date?.slice(0, 4)) === year && Number(date?.slice(5, 7)) === month ? Number(pipeline.winningQuotationAmount || pipeline.currentCommercialValue || 0) : 0;
};
