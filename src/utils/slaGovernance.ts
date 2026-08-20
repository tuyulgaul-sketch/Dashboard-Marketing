import {
  addBusinessDays,
  toLocalDateKey,
} from '@/utils/businessDay';

export const STANDARD_SLA_BUSINESS_DAYS = 3;

export type SlaState =
  | 'ON_SLA'
  | 'DUE_TODAY'
  | 'OVERDUE';

const atLocalNoon = (
  value: string | Date
): Date => {
  const source =
    value instanceof Date
      ? value
      : new Date(value);

  return new Date(
    source.getFullYear(),
    source.getMonth(),
    source.getDate(),
    12,
    0,
    0,
    0
  );
};

export const getSlaDueDate = (
  startedAt: string | Date,
  businessDays = STANDARD_SLA_BUSINESS_DAYS
): Date =>
  addBusinessDays(
    atLocalNoon(startedAt),
    businessDays
  );

export const getSlaDueDateKey = (
  startedAt: string | Date,
  businessDays = STANDARD_SLA_BUSINESS_DAYS
): string =>
  toLocalDateKey(
    getSlaDueDate(
      startedAt,
      businessDays
    )
  );

export const getSlaState = (
  startedAt: string | Date,
  now: Date = new Date(),
  businessDays = STANDARD_SLA_BUSINESS_DAYS
): SlaState => {
  const due = getSlaDueDate(
    startedAt,
    businessDays
  );

  const today = atLocalNoon(now);
  const dueDay = atLocalNoon(due);

  if (
    today.getTime() >
    dueDay.getTime()
  ) {
    return 'OVERDUE';
  }

  if (
    today.getTime() ===
    dueDay.getTime()
  ) {
    return 'DUE_TODAY';
  }

  return 'ON_SLA';
};

export const formatSlaDueDate = (
  startedAt: string | Date,
  businessDays = STANDARD_SLA_BUSINESS_DAYS
): string =>
  getSlaDueDate(
    startedAt,
    businessDays
  ).toLocaleDateString(
    'id-ID',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }
  );
