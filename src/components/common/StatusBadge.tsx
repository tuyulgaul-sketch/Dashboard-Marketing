import React from 'react';
import { Badge } from '@/components/ui/badge';
import { PipelineCanonicalStatus } from '@/types';

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  let color = 'bg-gray-100 text-gray-700 border-gray-200';

  if (status === 'WIN' || status === 'POSTED' || status === 'Approved' || status === 'Valid' || status === 'Completed' || status === 'Published') {
    color = 'bg-emerald-100 text-emerald-800 border-emerald-300';
  } else if (status === 'LOSE' || status === 'Rejected' || status === 'REKOMENDASI TOLAK') {
    color = 'bg-rose-100 text-rose-800 border-rose-300';
  } else if (status === 'Perlu Perbaikan Dokumen Marketing' || status === 'Needs Revision') {
    color = 'bg-amber-100 text-amber-800 border-amber-300';
  } else if (status.includes('On Process') || status.includes('Dalam Verifikasi') || status.includes('Pending')) {
    color = 'bg-blue-100 text-blue-800 border-blue-300';
  }

  return (
    <Badge variant="outline" className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${color}`}>
      {status}
    </Badge>
  );
};