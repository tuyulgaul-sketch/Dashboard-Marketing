import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const MATRIX_BASE = '9cf411d393b1acdfcbd98d34055e3a1750bc8b8e';
const read = path => readFileSync(path, 'utf8');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });
const once = (source, before, after, label) => {
  assert(source.includes(before), `Missing approved anchor: ${label}`);
  assert.equal(source.split(before).length, 2, `Non-unique approved anchor: ${label}`);
  return source.replace(before, after);
};
const between = (source, start, end, replacement, label) => {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  assert(a >= 0 && b > a, `Missing approved boundaries: ${label}`);
  assert.equal(source.indexOf(start, a + 1), -1, `Non-unique start boundary: ${label}`);
  return source.slice(0, a) + replacement + source.slice(b);
};

export const matrixTransforms = {
  'src/types/index.ts': original => once(original,
    'export interface Pipeline {\n',
    `export interface RkapPremiumSchedule {
  version: 1;
  year: number;
  sourceRow: string;
  sourceFile: string;
  sourceBatchId: string;
  currency: string;
  exchangeRate: string;
  exchangeRateSource?: string;
  exchangeRateDate?: string;
  paymentMode?: string;
  monthlyOriginal: string[];
  monthlyIdr: number[];
  totalOriginal: string;
  totalIdr: number;
  notes?: string;
}

export interface Pipeline {
  /** Original RKAP premium distribution, distinct from operational closing and quotations. */
  rkapPremiumSchedule?: RkapPremiumSchedule;
`, 'optional schedule schema'),
  'src/pages/TargetRealizationUploadPage.tsx': original => {
    let source = once(original,
      "import ProduksiPage from '@/pages/ProduksiPage';",
      "import ProduksiPage from '@/pages/ProduksiPage';\nimport RkapPipelineMatrixUpload from '@/components/rkap/RkapPipelineMatrixUpload';",
      'matrix upload import');
    source = once(source,
      '<TabsContent value="bulk" className="mt-4"><TargetRkapPage key="bulk" embedded initialUploadTab="bulk" publisherAuthorized={canPublish} /></TabsContent>',
      '<TabsContent value="bulk" className="mt-4"><RkapPipelineMatrixUpload publisherAuthorized={canPublish} /></TabsContent>',
      'primary matrix upload route');
    return source;
  },
  'src/pages/TargetRkapPage.tsx': original => {
    let source = once(original,
      "import { buildCompactTargetTemplateRows, normalizeTargetUploadRows } from '@/utils/targetCompact';",
      "import { buildCompactTargetTemplateRows, normalizeTargetUploadRows } from '@/utils/targetCompact';\nimport { getRkapMonthlyValue, getRkapWinMonthlyValue } from '@/utils/rkapPipelineMatrix';",
      'monthly schedule reader import');
    source = once(source,
      `        const referenceDate =
          pipeline.winDate ||
          pipeline.actualClosingDate ||
          pipeline.currentTargetClosingDate;

        return (
          getDateYear(
            referenceDate
          ) ===
          selectedTargetYear
        );`,
      `        if (pipeline.rkapPremiumSchedule) return pipeline.rkapPremiumSchedule.year === selectedTargetYear;
        const referenceDate =
          pipeline.winDate ||
          pipeline.actualClosingDate ||
          pipeline.currentTargetClosingDate;

        return (
          getDateYear(
            referenceDate
          ) ===
          selectedTargetYear
        );`,
      'WIN planning year');
    source = between(source,
      '        const pipelineRows =\n          activePipelines.filter(',
      '        const achievement =',
      `        const pipelineRows = activePipelines.filter(row => getRkapMonthlyValue(row, selectedTargetYear, monthNumber) !== 0);
        const pipeline = pipelineRows.reduce((total, row) => total + getRkapMonthlyValue(row, selectedTargetYear, monthNumber), 0);
        const winRows = winPendingProduction.filter(row => getRkapWinMonthlyValue(row, selectedTargetYear, monthNumber) !== 0);
        const winPending = winRows.reduce((total, row) => total + getRkapWinMonthlyValue(row, selectedTargetYear, monthNumber), 0);

`, 'monthly pipeline and WIN schedule aggregation');
    source = once(source,
      'Target bulanan vs Realisasi Produksi, WIN belum produksi, dan Active Pipeline berdasarkan Bulan Pipeline. Data lama tetap menggunakan Current Target Closing Date sebagai fallback.',
      'Target bulanan vs Realisasi Produksi, WIN belum produksi, dan Active Pipeline berdasarkan jadwal premi RKAP. Satu opportunity dihitung sekali pada total tahunan; jadwal bulanan tidak menjadi case terpisah. Data lama tetap menggunakan tanggal closing sebagai fallback. Perubahan nilai penawaran tidak otomatis mengubah jadwal RKAP awal.',
      'monthly dashboard explanation');
    return source;
  },
};

export const matrixHelperTransforms = {
  'src/utils/rkapPipelineMatrix.ts': original => {
    let source = once(original,
      "import type { Pipeline, ProductMaster, User } from '@/types';",
      "import type { Pipeline, ProductMaster, User, RkapPremiumSchedule } from '@/types';",
      'schedule type import');
    source = once(source,
      'const normalizedCustomer = (value: string)',
      'export const normalizedCustomer = (value: string)',
      'customer identity export');
    source = once(source,
      'const rowReference = valueOf(row, \'No.\');',
      "const rowReference = valueOf(row, 'No.');",
      'row reference anchor');
    source = once(source,
      'seenNumbers.add(rowReference);',
      "seenNumbers.add(rowReference);",
      'row number anchor');
    source = once(source,
      "const rateUnits = 1000000n;",
      "const rateUnits = 1000000n;",
      'rate anchor');
    source = once(source,
      'rateUnits = numeric(valueOf(row, \'Kurs ke IDR\'), \'Kurs ke IDR\', 6);',
      "rateUnits = parseExchangeRate(valueOf(row, 'Kurs ke IDR'));",
      'explicit exchange rate');
    source = once(source,
      "numeric(valueOf(row, 'Kurs ke IDR'), 'Kurs ke IDR', 6) !== 1000000n",
      "parseExchangeRate(valueOf(row, 'Kurs ke IDR')) !== 1000000n",
      'IDR identity exchange rate');
    source = once(source,
      "const paymentMode = valueOf(row, 'Cara Bayar');",
      "const rawPaymentMode = valueOf(row, 'Cara Bayar');\n      const paymentMode = ({ kwartalan: 'Triwulanan', quarterly: 'Triwulanan', monthly: 'Bulanan', semiannual: 'Semesteran', annual: 'Tahunan', yearly: 'Tahunan', single: 'Single' } as Record<string, string>)[rawPaymentMode.toLowerCase()] || rawPaymentMode;",
      'payment frequency aliases');
    source = once(source,
      "if (originalPolicyYearText && (!/^\\d{4}$/.test(originalPolicyYearText) || Number(originalPolicyYearText) > year))",
      "if (originalPolicyYearText && (!/^\\d{4}$/.test(originalPolicyYearText) || Number(originalPolicyYearText) < 1900 || Number(originalPolicyYearText) > year))",
      'original policy year bounds');
    source = once(source,
      "const rowReference = valueOf(row, 'No.');\n      if (!/^\\d+$/.test(rowReference) || BigInt(rowReference) <= 0n || seenNumbers.has(rowReference)) fail('No. harus angka positif dan unik dalam file.');\n      seenNumbers.add(rowReference);",
      "const rawRowReference = valueOf(row, 'No.');\n      if (!/^\\d+$/.test(rawRowReference) || BigInt(rawRowReference) <= 0n) fail('No. harus angka positif dan unik dalam file.');\n      const rowReference = BigInt(rawRowReference).toString();\n      if (seenNumbers.has(rowReference)) fail('No. harus angka positif dan unik dalam file.');\n      seenNumbers.add(rowReference);",
      'canonical row reference');
    source = once(source,
      "const numeric = (raw: unknown, label: string, scale: number, allowBlank = false): bigint => {",
      `const parseExchangeRate = (raw: unknown): bigint => {
  const text = clean(raw).replace(/\\s/g, '');
  if (!text || /[eE-]/.test(text)) fail('Kurs ke IDR harus angka desimal positif tanpa notasi ilmiah.');
  if (/^\\d{1,3}[.,]\\d{3}$/.test(text)) fail('Kurs ambigu. Isi tanpa pemisah ribuan, misalnya 16000.50.');
  const normalized = text.replace(',', '.');
  if (!/^\\d+(?:\\.\\d{1,6})?$/.test(normalized)) fail('Kurs ke IDR harus angka tanpa pemisah ribuan, maksimal 6 desimal.');
  const [whole, fraction = ''] = normalized.split('.');
  const units = BigInt(whole) * 1000000n + BigInt((fraction + '000000').slice(0, 6));
  if (units <= 0n) fail('Kurs ke IDR harus positif.');
  return units;
};

const numeric = (raw: unknown, label: string, scale: number, allowBlank = false): bigint => {`,
      'unambiguous approved exchange rate parser');
    source = between(source,
      'export const getRkapMonthlyValue =',
      '\n};',
      `export const getRkapMonthlyValue = (pipeline: Pipeline, year: number, month: number): number => {
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error('Bulan Pipeline harus 1–12.');
  const schedule = pipeline.rkapPremiumSchedule;
  if (schedule) {
    if (!Array.isArray(schedule.monthlyIdr) || schedule.monthlyIdr.length !== 12 || schedule.monthlyIdr.some(value => !Number.isSafeInteger(value) || value < 0) || !Number.isSafeInteger(schedule.totalIdr) || schedule.monthlyIdr.reduce((total, value) => total + value, 0) !== schedule.totalIdr) throw new Error('Jadwal premi RKAP tersimpan tidak valid. Periksa integritas data sebelum menghitung laporan.');
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
};`, 'validated monthly schedule and legacy fallback');
    // The previous boundary replacement leaves the original closing brace;
    // retain exactly one close for each exported function.
    return source;
  },
  'src/components/rkap/RkapPipelineMatrixUpload.tsx': original => {
    let source = once(original,
      "import type { BookingCase, Pipeline, ProductMaster, User } from '@/types';",
      "import type { BookingCase, Pipeline, ProductMaster, User, RkapPremiumSchedule } from '@/types';",
      'component schedule type');
    source = between(source,
      'type StoredSchedule = {',
      '\ntype ScheduledPipeline =',
      '', 'shared schedule type');
    source = once(source,
      'rkapPremiumSchedule: StoredSchedule',
      'rkapPremiumSchedule: RkapPremiumSchedule',
      'shared schedule usage');
    source = once(source,
      '  const currentUsers = store.getUsers();\n  const currentProducts = store.getProducts();\n  const currentPipelines = store.getPipelines();\n  const currentBookings = store.getBookings();\n  void revision;',
      '  void revision;', 'remove redundant unbound snapshots');
    source = once(source,
      'totalOriginal: plan.totalOriginal, totalIdr: plan.totalIdr },',
      'totalOriginal: plan.totalOriginal, totalIdr: plan.totalIdr, notes: plan.notes },',
      'retain RKAP source notes');
    return source;
  },
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  assert.equal(git('branch', '--show-current').trim(), 'feat/rkap-pipeline-monthly-matrix');
  for (const [path, transform] of Object.entries(matrixTransforms)) {
    const original = git('show', `${MATRIX_BASE}:${path}`);
    assert.equal(read(path), original, `${path} changed since the pinned production base`);
    writeFileSync(path, transform(original));
    console.log(`Integrated approved source: ${path}`);
  }
  for (const [path, transform] of Object.entries(matrixHelperTransforms)) {
    const original = read(path);
    const expected = transform(original);
    assert.notEqual(expected, original, `${path} was not modified`);
    writeFileSync(path, expected);
    console.log(`Hardened approved helper: ${path}`);
  }
}
