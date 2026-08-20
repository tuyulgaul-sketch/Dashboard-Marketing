import React from 'react';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet } from 'lucide-react';
import { exportToExcel } from '@/utils/excelExport';

interface ExcelExportButtonProps {
  data: Record<string, any>[];
  filename: string;
  label?: string;
  variant?: 'outline' | 'default' | 'secondary';
  size?: 'sm' | 'default';
}

export const ExcelExportButton: React.FC<ExcelExportButtonProps> = ({
  data,
  filename,
  label = 'Export Excel',
  variant = 'outline',
  size = 'sm'
}) => {
  const handleExport = () => {
    exportToExcel(data, filename);
  };

  return (
    <Button variant={variant} size={size} onClick={handleExport} className="gap-2 border-emerald-300 text-emerald-800 hover:bg-emerald-50 font-medium">
      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
      <span>{label}</span>
    </Button>
  );
};