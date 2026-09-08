import { buildMarketingWorkbook, readNativeXlsxRows } from '../../src/utils/marketingWorkbook';
import { normalizeTargetUploadRows } from '../../src/utils/targetCompact';

const users = [
  { id: 'USR-000001', name: 'Director', role: 'DIRECTOR_MARKETING', status: 'Active', superiorId: null, position: 'Director', unit: 'Directorate Marketing', department: 'None' },
  { id: 'USR-000004', name: 'DH', role: 'DEPARTMENT_HEAD_MARKETING', status: 'Active', superiorId: 'USR-000001', position: 'DH Captive I', unit: 'Captive Marketing', department: 'Captive I' },
  { id: 'USR-000005', name: 'Staff', role: 'STAFF_MARKETING', status: 'Active', superiorId: 'USR-000004', position: 'Staff Captive I', unit: 'Captive Marketing', department: 'Captive I' },
] as const;

(async () => {
  try {
    const rows = users.flatMap(user => Array.from({ length: 12 }, (_, month) => ['NB', 'RN'].map(kind => ({
      Tahun: 2026, 'User ID Penerima': user.id, Periode: month + 1, 'NB/RN': kind,
      'Target (Rp)': user.id === 'USR-000005' && month === 2 && kind === 'NB' ? 100000000 : 0,
    })) ).flat());
    const bytes = await buildMarketingWorkbook('target', rows, users as unknown as import('../../src/types').User[]);
    const parsed = await readNativeXlsxRows(bytes, { sheetName: 'Data Target', requiredHeaders: ['Tahun', 'User ID Penerima', 'Periode', 'NB/RN', 'Target (Rp)'] });
    const expanded = normalizeTargetUploadRows(parsed, [...users], 2026);
    const director = expanded.find(row => row['User ID Penerima'] === 'USR-000001');
    const staff = expanded.find(row => row['User ID Penerima'] === 'USR-000005');
    if (parsed.length !== 72 || expanded.length !== 3 || director?.['Target Tahunan'] !== '100000000' || staff?.['Target Pribadi NB'] !== '100000000') throw new Error('Hasil cascading atau jumlah baris tidak sesuai.');
    (window as unknown as { __xlsxProbe: unknown }).__xlsxProbe = { ok: true, rows: parsed.length, total: director['Target Tahunan'] };
  } catch (error) {
    (window as unknown as { __xlsxProbe: unknown }).__xlsxProbe = { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
})();
