import React, { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { store } from '@/services/store';
import type { AgentMaster } from '@/data/agentMasterData';
import type { BrokerMaster } from '@/data/brokerMasterData';
import { readMarketingSpreadsheet, SPREADSHEET_ACCEPT } from '@/utils/marketingWorkbook';
import {
  AGENT_BULK_HEADERS,
  BROKER_BULK_HEADERS,
  reviewAgentBulkRows,
  reviewBrokerBulkRows,
  type AgentBulkCandidate,
  type BrokerBulkCandidate,
  type MasterBulkKind,
  type MasterBulkReview,
} from '@/utils/masterIntermediaryBulk';
import { bulkAddCentralAgents, bulkAddCentralBrokers } from '@/services/masterIntermediaryBulkService';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, Download, FileSpreadsheet, ShieldCheck, Upload } from 'lucide-react';

const sourcePeriodDefault = () => new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(new Date());

const saveBlob = (bytes: BlobPart, filename: string, type: string) => {
  const blob = new Blob([bytes], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const downloadErrorReport = (
  kind: MasterBulkKind,
  review: MasterBulkReview<AgentBulkCandidate> | MasterBulkReview<BrokerBulkCandidate>
) => {
  const lines = [
    ['Baris', 'Field', 'Error'].map(csvCell).join(','),
    ...review.issues.map(issue => [issue.rowNumber, issue.field, issue.message].map(csvCell).join(',')),
  ];
  saveBlob(`\uFEFF${lines.join('\r\n')}`, `Error-Import-${kind === 'agent' ? 'Agent' : 'Broker'}.csv`, 'text/csv;charset=utf-8');
};

const downloadTemplate = async (kind: MasterBulkKind) => {
  const Excel = (await import('exceljs')).default;
  const workbook = new Excel.Workbook();
  workbook.creator = 'PertaLife Marketing Dashboard';
  workbook.created = new Date();
  const headers = kind === 'agent' ? [...AGENT_BULK_HEADERS] : [...BROKER_BULK_HEADERS];
  const sheet = workbook.addWorksheet(kind === 'agent' ? 'Sheet1' : 'Perusahaan Pialang Asuransi', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  sheet.addRow(headers);
  const header = sheet.getRow(1);
  header.height = 28;
  header.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF163C72' } };
    cell.alignment = { vertical: 'middle', wrapText: true };
  });
  sheet.columns = headers.map(name => ({ width: /Nama|Perusahaan|Alamat|Email|Website/.test(name) ? 30 : 20 }));
  sheet.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + headers.length)}2` };
  for (let index = 1; index <= headers.length; index += 1) {
    const name = headers[index - 1];
    if (/Kode|Nomor|Telepon|Fax|Pos|Lisensi|Izin/.test(name)) sheet.getColumn(index).numFmt = '@';
  }
  if (kind === 'agent') {
    for (let row = 2; row <= 1001; row += 1) {
      sheet.getCell(row, 9).dataValidation = {
        type: 'list',
        allowBlank: false,
        formulae: ['"Active,Inactive"'],
        showErrorMessage: true,
        errorTitle: 'Status tidak valid',
        error: 'Pilih Active atau Inactive.',
      };
    }
  }
  const bytes = await workbook.xlsx.writeBuffer();
  saveBlob(bytes as BlobPart, `Template-Import-${kind === 'agent' ? 'Agent' : 'Broker'}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
};

type ReviewState =
  | { kind: 'agent'; value: MasterBulkReview<AgentBulkCandidate> }
  | { kind: 'broker'; value: MasterBulkReview<BrokerBulkCandidate> }
  | null;

const MasterIntermediaryBulkImportPage: React.FC = () => {
  const [kind, setKind] = useState<MasterBulkKind>('agent');
  const [file, setFile] = useState<File | null>(null);
  const [review, setReview] = useState<ReviewState>(null);
  const [sourcePeriod, setSourcePeriod] = useState(sourcePeriodDefault);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [agents, setAgents] = useState<AgentMaster[]>(() => store.getAgents());
  const [brokers, setBrokers] = useState<BrokerMaster[]>(() => store.getBrokers());

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setAgents(store.getAgents());
      setBrokers(store.getBrokers());
    });
    return () => { unsubscribe(); };
  }, []);

  const current = review?.value || null;
  const previewRows = useMemo(() => current?.rows.slice(0, 100) || [], [current]);

  const resetFileState = (nextKind?: MasterBulkKind) => {
    if (nextKind) setKind(nextKind);
    setFile(null);
    setReview(null);
    setMessage('');
  };

  const validate = async () => {
    if (!file) return;
    setBusy(true);
    setReview(null);
    setMessage('');
    try {
      const requiredHeaders = kind === 'agent' ? [...AGENT_BULK_HEADERS] : [...BROKER_BULK_HEADERS];
      const rows = await readMarketingSpreadsheet(file, { requiredHeaders });
      if (!rows.length) throw new Error('File tidak memiliki baris data.');
      if (kind === 'agent') {
        const value = reviewAgentBulkRows(rows, agents);
        setReview({ kind, value });
        setMessage(`Validasi Agent selesai: ${value.addCount} data baru, ${value.skipCount} sudah identik, ${value.errorCount} perlu diperbaiki.`);
      } else {
        const value = reviewBrokerBulkRows(rows, brokers);
        setReview({ kind, value });
        setMessage(`Validasi Broker selesai: ${value.addCount} data baru, ${value.skipCount} sudah identik, ${value.errorCount} perlu direkonsiliasi.`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Validasi file gagal.');
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (!file || !review || review.kind !== kind || review.value.errorCount > 0 || !sourcePeriod.trim()) return;
    const addCount = review.value.addCount;
    const skipCount = review.value.skipCount;
    if (!window.confirm(
      `Import ${addCount} ${kind === 'agent' ? 'Agent' : 'Broker'} baru? ${skipCount} baris yang sudah identik akan dilewati. Bulk import tidak mengubah atau menghapus data existing.`
    )) return;

    setBusy(true);
    setMessage('');
    try {
      if (review.kind === 'agent') {
        const result = await bulkAddCentralAgents(review.value.rows, file.name, sourcePeriod.trim());
        setMessage(`Import Agent berhasil: ${result.inserted} ditambahkan, ${result.skipped} dilewati karena sudah identik.`);
      } else {
        const result = await bulkAddCentralBrokers(review.value.rows, file.name, sourcePeriod.trim());
        setMessage(`Import Broker berhasil: ${result.inserted} ditambahkan, ${result.skipped} dilewati karena sudah identik.`);
      }
      setReview(null);
      setFile(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Bulk import gagal. Tidak ada batch parsial yang boleh disimpan.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-5">
          <div className="rounded-lg bg-blue-50 p-2.5"><Upload className="h-5 w-5 text-blue-700" /></div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Import Bulk Agent & Broker</h1>
            <p className="mt-1 text-xs text-slate-500">Tambahkan banyak Agent atau Broker sekaligus dari Excel tanpa mengganti fungsi tambah/edit satu per satu pada Booking & Pipeline.</p>
            <p className="mt-2 text-[11px] font-semibold text-blue-700">Otoritas: Marketing Administration • Add-new only • Audit server tetap aktif</p>
          </div>
        </div>

        <Tabs value={kind} onValueChange={value => resetFileState(value as MasterBulkKind)}>
          <TabsList className="grid w-full max-w-lg grid-cols-2 bg-white">
            <TabsTrigger value="agent">Import Agent</TabsTrigger>
            <TabsTrigger value="broker">Import Broker</TabsTrigger>
          </TabsList>

          <TabsContent value="agent" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Format Daftar Agent</CardTitle>
                <CardDescription className="text-xs">Mengikuti 9 kolom file Daftar Agent. Status Active/Inactive tetap dikelola PertaLife.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button type="button" variant="outline" size="sm" onClick={() => void downloadTemplate('agent')} disabled={busy} className="gap-2 text-xs"><Download className="h-4 w-4" />Download Template Agent</Button>
                <p className="text-[11px] leading-relaxed text-slate-600">Kolom: {AGENT_BULK_HEADERS.join(' • ')}</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="broker" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Format Daftar Broker</CardTitle>
                <CardDescription className="text-xs">Mengikuti 12 kolom file Perusahaan Pialang Asuransi. Broker tidak memiliki status Active/Inactive yang dikelola PertaLife; data izin merupakan informasi OJK.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button type="button" variant="outline" size="sm" onClick={() => void downloadTemplate('broker')} disabled={busy} className="gap-2 text-xs"><Download className="h-4 w-4" />Download Template Broker</Button>
                <p className="text-[11px] leading-relaxed text-slate-600">Kolom: {BROKER_BULK_HEADERS.join(' • ')}</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm"><FileSpreadsheet className="h-5 w-5 text-blue-700" />Upload & Validasi</CardTitle>
            <CardDescription className="text-xs">File hanya dibaca di sesi browser untuk preview. File tidak disimpan ke browser storage dan belum mengubah database sebelum konfirmasi Import.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-[1fr_240px_auto]">
              <label className="text-xs font-semibold text-slate-700">Excel XLSX / CSV
                <Input type="file" accept={SPREADSHEET_ACCEPT} disabled={busy} className="mt-1" onChange={event => { setFile(event.target.files?.[0] || null); setReview(null); setMessage(''); }} />
              </label>
              <label className="text-xs font-semibold text-slate-700">Periode sumber
                <Input value={sourcePeriod} onChange={event => setSourcePeriod(event.target.value)} disabled={busy} className="mt-1" placeholder="Contoh: September 2026" />
              </label>
              <div className="flex items-end"><Button type="button" onClick={() => void validate()} disabled={!file || busy} className="w-full gap-2 text-xs"><ShieldCheck className="h-4 w-4" />Validasi File</Button></div>
            </div>

            {message && <div role="status" className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">{message}</div>}

            {current && (
              <div className="space-y-3 rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">{current.addCount} Baru</Badge>
                    <Badge variant="outline" className="border-slate-200">{current.skipCount} Sudah identik</Badge>
                    <Badge variant="outline" className={current.errorCount ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-slate-200'}>{current.errorCount} Error</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {current.errorCount > 0 && <Button type="button" variant="outline" size="sm" onClick={() => downloadErrorReport(kind, current as MasterBulkReview<AgentBulkCandidate> & MasterBulkReview<BrokerBulkCandidate>)} className="gap-2 text-xs"><Download className="h-4 w-4" />Download Error Report</Button>}
                    <Button type="button" size="sm" onClick={() => void publish()} disabled={busy || current.errorCount > 0 || current.addCount === 0 || !sourcePeriod.trim()} className="text-xs">Import Data Baru</Button>
                  </div>
                </div>

                {current.errorCount > 0 && (
                  <div className="flex gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>Seluruh batch diblokir sampai error direkonsiliasi. Duplikat nomor izin/lisensi tidak pernah digabung otomatis.</p>
                  </div>
                )}

                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="min-w-[900px] w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
                      <tr><th className="p-2">Baris</th><th className="p-2">Identitas</th><th className="p-2">Lisensi / Izin</th><th className="p-2">Status Agent</th><th className="p-2">Hasil</th><th className="p-2">Catatan</th></tr>
                    </thead>
                    <tbody>
                      {previewRows.map(row => (
                        <tr key={row.rowNumber} className="border-t border-slate-100 align-top">
                          <td className="p-2">{row.rowNumber}</td>
                          <td className="p-2 font-semibold">{'agentCode' in row ? `${row.agentCode} • ${row.agentName}` : row.companyName}</td>
                          <td className="p-2">{row.licenseNumber || '-'}<br /><span className="text-[10px] text-slate-500">{'licenseExpiryDate' in row ? `${row.licenseDate || '-'} s.d. ${row.licenseExpiryDate || '-'}` : row.licenseDate || '-'}</span></td>
                          <td className="p-2">{'agentCode' in row ? row.status : '—'}</td>
                          <td className="p-2"><Badge variant="outline" className={row.disposition === 'ERROR' ? 'border-rose-200 bg-rose-50 text-rose-700' : row.disposition === 'ADD' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200'}>{row.disposition}</Badge></td>
                          <td className="p-2 text-[10px] text-slate-600">{row.issues.map(issue => issue.message).join(' • ') || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {current.rows.length > previewRows.length && <p className="text-[10px] text-slate-500">Preview layar dibatasi 100 baris; seluruh {current.rows.length} baris tetap divalidasi sebelum import.</p>}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3 text-xs leading-relaxed text-blue-900">
          Bulk Import hanya menambahkan record baru dan tidak melakukan Update/Delete. Status Active/Inactive hanya berlaku untuk Agent dan tetap dikelola PertaLife. Broker mengikuti data izin OJK tanpa status bisnis internal. Untuk perubahan satu record, tetap gunakan tombol Tambah/Edit pada Master Agent atau Master Broker di menu Booking & Pipeline.
        </div>
      </div>
    </AppLayout>
  );
};

export default MasterIntermediaryBulkImportPage;
