import React from 'react';
import { Badge } from '@/components/ui/badge';
import {
  formatSlaDueDate,
  getSlaState,
  STANDARD_SLA_BUSINESS_DAYS,
} from '@/utils/slaGovernance';

interface SlaBadgeProps {
  startedAt?: string;
  compact?: boolean;
}

export const SlaBadge: React.FC<SlaBadgeProps> = ({
  startedAt,
  compact = false,
}) => {
  if (!startedAt) {
    return null;
  }

  const state = getSlaState(startedAt);

  const className =
    state === 'OVERDUE'
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : state === 'DUE_TODAY'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-emerald-200 bg-emerald-50 text-emerald-700';

  const label =
    state === 'OVERDUE'
      ? 'SLA Overdue'
      : state === 'DUE_TODAY'
        ? 'SLA Jatuh Tempo Hari Ini'
        : compact
          ? `SLA ${STANDARD_SLA_BUSINESS_DAYS} HK`
          : `On SLA • Due ${formatSlaDueDate(startedAt)}`;

  return (
    <Badge
      variant="outline"
      className={`text-[9px] font-bold ${className}`}
      title={`SLA standar ${STANDARD_SLA_BUSINESS_DAYS} hari kerja, Senin-Jumat.`}
    >
      {label}
    </Badge>
  );
};

export default SlaBadge;
