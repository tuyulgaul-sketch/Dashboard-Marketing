import { supabase } from '@/lib/supabase';

export type BusinessTypeFilter = 'OVERALL' | 'New Business' | 'Renewal Business';
export type PerformanceScope = { unit: string; department: string };

export interface DirectorateTargetGroup {
  year: number;
  unit: string;
  department: string;
  annualTotal: number;
  annualNB: number;
  annualRN: number;
  monthlyNB: number[];
  monthlyRN: number[];
  publishedAt: string | null;
}

export interface DirectorateProductionSummary {
  id: string;
  year: number;
  month: number;
  unit: string;
  department: string;
  businessType: 'New Business' | 'Renewal Business';
  productName: string;
  amount: number;
  transactionCount: number;
}

export interface DirectorateProductionBatch {
  id: string;
  uploadedAt: string;
  uploadedByName: string;
  filename: string;
  publishedPeriodKeys: string[];
  totalProductionAmount: number;
  validRowCount: number;
}

export interface DirectoratePerformanceSnapshot {
  refreshedAt: string;
  targets: DirectorateTargetGroup[];
  summaries: DirectorateProductionSummary[];
  batches: DirectorateProductionBatch[];
}

const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Format laporan pusat tidak valid.');
  }
  return value as Record<string, unknown>;
};
const text = (value: unknown): string => typeof value === 'string' ? value : '';
const number = (value: unknown): number => {
  const parsed = Number(value);
  if (value === null || value === undefined || value === '' || !Number.isFinite(parsed)) {
    throw new Error('Laporan pusat memiliki angka yang tidak valid.');
  }
  return parsed;
};
const rows = (value: unknown): unknown[] => {
  if (!Array.isArray(value)) throw new Error('Daftar laporan pusat tidak valid.');
  return value;
};
const moneyArray = (value: unknown): number[] => {
  const values = rows(value).map(number);
  if (values.length !== 12) throw new Error('Distribusi target bulanan tidak lengkap.');
  return values;
};

/** Normalize canonical and legacy organization labels without inventing users. */
export const normalizePerformanceScope = (unitValue: string, departmentValue: string): PerformanceScope => {
  const unit = unitValue.trim();
  const department = departmentValue.trim();
  if (/^Captive (I|II|III)$/.test(unit)) return { unit: 'Captive Marketing', department: unit };
  if (/^CRM (I|II|III)$/.test(unit)) return { unit: 'Corporate & Retail Marketing', department: unit };
  if (unit === 'Directorate Marketing' || unit === 'Direktorat Pemasaran') {
    return { unit: 'Direktorat Pemasaran', department: 'None' };
  }
  return { unit, department: department || 'None' };
};

/** Exact company, unit or department filtering. Never uses the user's write scope. */
export const matchesPerformanceScope = (row: PerformanceScope, scope: string): boolean => {
  if (scope === 'ALL') return true;
  const normalized = normalizePerformanceScope(row.unit, row.department);
  return normalized.unit === scope || normalized.department === scope;
};

export const targetAmount = (row: DirectorateTargetGroup, business: BusinessTypeFilter): number =>
  business === 'New Business' ? row.annualNB : business === 'Renewal Business' ? row.annualRN : row.annualTotal;

export const monthlyTargetAmount = (row: DirectorateTargetGroup, monthIndex: number, business: BusinessTypeFilter): number => {
  const nb = row.monthlyNB[monthIndex] || 0;
  const rn = row.monthlyRN[monthIndex] || 0;
  return business === 'New Business' ? nb : business === 'Renewal Business' ? rn : nb + rn;
};

export const buildPerformanceSummary = (
  snapshot: DirectoratePerformanceSnapshot,
  year: number,
  scope: string,
  business: BusinessTypeFilter,
  product = 'ALL'
) => {
  const targets = snapshot.targets.filter(row => row.year === year && matchesPerformanceScope(row, scope));
  const productions = snapshot.summaries.filter(row =>
    row.year === year && matchesPerformanceScope(row, scope) &&
    (business === 'OVERALL' || row.businessType === business) &&
    (product === 'ALL' || row.productName === product)
  );
  const annualTarget = targets.reduce((sum, row) => sum + targetAmount(row, business), 0);
  const actual = productions.reduce((sum, row) => sum + row.amount, 0);
  const monthly = Array.from({ length: 12 }, (_, index) => {
    const monthRows = productions.filter(row => row.month === index + 1);
    return {
      month: index + 1,
      target: targets.reduce((sum, row) => sum + monthlyTargetAmount(row, index, business), 0),
      actual: monthRows.reduce((sum, row) => sum + row.amount, 0),
      transactions: monthRows.reduce((sum, row) => sum + row.transactionCount, 0),
    };
  });
  return {
    targets, productions, annualTarget, actual, monthly,
    nb: productions.filter(row => row.businessType === 'New Business').reduce((sum, row) => sum + row.amount, 0),
    rn: productions.filter(row => row.businessType === 'Renewal Business').reduce((sum, row) => sum + row.amount, 0),
    transactions: productions.reduce((sum, row) => sum + row.transactionCount, 0),
    achievement: annualTarget > 0 ? actual / annualTarget * 100 : null,
  };
};

/** A separate server projection: no generic writable store or browser-data fallback. */
export const listDirectoratePerformance = async (): Promise<DirectoratePerformanceSnapshot> => {
  const { data, error } = await supabase.rpc('list_directorate_performance_v33');
  if (error) throw error;
  const payload = record(data as unknown);
  const targets = rows(payload.targets).map(value => {
    const row = record(value);
    return {
      year: number(row.year), unit: text(row.unit), department: text(row.department),
      annualTotal: number(row.annualTotal), annualNB: number(row.annualNB), annualRN: number(row.annualRN),
      monthlyNB: moneyArray(row.monthlyNB), monthlyRN: moneyArray(row.monthlyRN),
      publishedAt: text(row.publishedAt) || null,
    };
  });
  const summaries = rows(payload.summaries).map(value => {
    const row = record(value);
    const businessType = text(row.businessType);
    if (businessType !== 'New Business' && businessType !== 'Renewal Business') throw new Error('Jenis bisnis laporan tidak valid.');
    return {
      id: text(row.id), year: number(row.year), month: number(row.month),
      unit: text(row.unit), department: text(row.department), businessType,
      productName: text(row.productName), amount: number(row.amount), transactionCount: number(row.transactionCount),
    };
  });
  const batches = rows(payload.batches).map(value => {
    const row = record(value);
    return {
      id: text(row.id), uploadedAt: text(row.uploadedAt), uploadedByName: text(row.uploadedByName),
      filename: text(row.filename), publishedPeriodKeys: rows(row.publishedPeriodKeys).map(text),
      totalProductionAmount: number(row.totalProductionAmount), validRowCount: number(row.validRowCount),
    };
  });
  return { refreshedAt: text(payload.refreshedAt), targets, summaries, batches };
};
