import React, { useEffect, useMemo, useState } from 'react';
import { useTargetRealizationPublisher } from '@/hooks/useTargetRealizationPublisher';
import { store } from '@/services/store';
import { archiveOfficialUpload, listOfficialUploadBatches, previewOfficialUploadRemoval, refreshOfficialUploadReaders, type OfficialUploadBatch, type OfficialUploadKind, type OfficialUploadPreview } from '@/services/officialUploadArchiveService';
import { formatRupiah } from '@/utils/formatters';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, Archive, RefreshCw, ShieldCheck } from 'lucide-react';

const labels: Record<OfficialUploadKind, string> = { target: 'Target RKAP', pipeline: 'Bulk Pipeline', realization: 'Realisasi Produksi' };
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Permintaan gagal. Periksa koneksi dan coba lagi.';
const keyOf = (row: { kind: OfficialUploadKind; id: string }) => `${row.kind}:${row.id}`;

const OfficialUploadArchiveManager: React.FC = () => {
  const { canPublish, loading } = useTargetRealizationPublisher();
  const authorized = canPublish && !loading && store.getCurrentUser().id === 'USR-000024';
  const [rows, setRows] = useState<OfficialUploadBatch[]>([]);
  const [kind, setKind] = useState<OfficialUploadKind | 'all'>('all');
  const [year, setYear] = useState('all');
  const [selected, setSelected] = useState<OfficialUploadPreview | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failure, setFailure] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => store.subscribe(() => setRevision(value => value + 1)), []);
  void revision;
  const load = async () => {
    if (!authorized) return;
    setBusy(true); setFailure(false); setMessage(''); setSelected(null);
    try { setRows(await listOfficialUploadBatches()); }
    catch (error) { setFailure(true); setMessage(errorText(error)); }
    finally { setBusy(false); }
  };
  useEffect(() => {
    if (!authorized) { setRows([]); setSelected(null); return; }
    let active = true;
    setBusy(true);
    void listOfficialUploadBatches().then(data => { if (active) { setRows(data); setFailure(false); setMessage(''); } }, error => { if (active) { setFailure(true); setMessage(errorText(error)); } }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [authorized]);
  const years = useMemo(() => [...new Set(rows.map(row => row.year).filter((value): value is number => value !== null && value > 0))].sort((a,b) => b-a), [rows]);
  const filtered = useMemo(() => rows.filter(row => (kind === 'all' || row.kind === kind) && (year === 'all' || String(row.year) === year)), [rows, kind, year]);
  const select = async (row: OfficialUploadBatch) => {
    if (!authorized || busy) return;
    setBusy(true); setSelected(null); setConfirmation(''); setReason(''); setMessage(''); setFailure(false);
    try { setSelected(await previewOfficialUploadRemoval(row.kind, row.id)); }
    catch (error) { setFailure(true); setMessage(errorText(error)); }
    finally { setBusy(false); }
  };
  const archive = async () => {
    if (!selected || !authorized || busy || selected.blocked > 0 || confirmation.trim() !== selected.id || reason.trim().length < 10) return;
    setBusy(true); setMessage(''); setFailure(false);
    try {
      const receipt = await archiveOfficialUpload(selected, reason);
      setSelected(null); setConfirmation(''); setReason('');
      // Do not retry a committed deletion if a later cache refresh fails.
      try {
        await refreshOfficialUploadReaders();
        setRows(await listOfficialUploadBatches());
        setMessage(`${receipt.recordCount} record telah diarsipkan. Bukti arsip: ${receipt.archiveId}. Data tidak lagi masuk pembacaan aktif.`);
      } catch (refreshError) {
        setRows(current => current.filter(row => keyOf(row) !== keyOf(receipt)));
        setFailure(true);
        setMessage(`Arsip berhasil tersimpan (${receipt.archiveId}), tetapi penyegaran data gagal: ${errorText(refreshError)}. Muat ulang halaman; jangan ulangi penghapusan.`);
      }
    } catch (error) { setSelected(null); setFailure(true); setMessage(errorText(error)); }
    finally { setBusy(false); }
  };
  return <Card className="border-slate-200">
    <CardHeader className="space-y-2">
      <CardTitle className="flex items-center gap-2 text-base"><Archive className="h-5 w-5 text-slate-700"/>Kelola / Hapus Data Upload</CardTitle>
      <CardDescription>Penghapusan berdasarkan batch atau ID sumber yang pasti. Snapshot lengkap disimpan di arsip database untuk pemulihan oleh IT. Tidak ada tombol hapus seluruh database.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">Target yang dihapus tidak otomatis diganti target lama. Realisasi yang dihapus tidak mengembalikan batch periode sebelumnya. Pipeline yang sudah diproses, memiliki dokumen, atau terkait transaksi operasional tidak dapat dihapus lewat menu ini. Tidak ada data yang dihapus sampai konfirmasi terakhir dilakukan.</div>
      {!authorized && <p className="text-sm text-slate-600">Menunggu otoritas publisher resmi Arianie Fajarwati.</p>}
      {authorized && <>
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-xs font-medium text-slate-700">Jenis data<select className="block h-9 rounded-md border border-slate-300 bg-white px-2" value={kind} disabled={busy} onChange={event => { setKind(event.target.value as OfficialUploadKind | 'all'); setSelected(null); }}><option value="all">Semua</option><option value="target">Target RKAP</option><option value="pipeline">Bulk Pipeline</option><option value="realization">Realisasi Produksi</option></select></label>
          <label className="space-y-1 text-xs font-medium text-slate-700">Tahun<select className="block h-9 rounded-md border border-slate-300 bg-white px-2" value={year} disabled={busy} onChange={event => { setYear(event.target.value); setSelected(null); }}><option value="all">Semua tahun</option>{years.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
          <Button variant="outline" size="sm" onClick={load} disabled={busy}><RefreshCw className="mr-2 h-4 w-4"/>Muat ulang</Button>
        </div>
        {message && <div role="status" className={`rounded-lg border p-3 text-xs ${failure ? 'border-red-200 bg-red-50 text-red-800' : 'border-green-200 bg-green-50 text-green-800'}`}>{message}</div>}
        <div className="overflow-x-auto rounded-lg border border-slate-200"><table className="w-full min-w-[640px] text-left text-xs"><thead className="bg-slate-50 text-slate-600"><tr><th className="p-3">Jenis / Sumber</th><th className="p-3">Tahun</th><th className="p-3">Upload</th><th className="p-3 text-right">Record</th><th className="p-3 text-right">Total</th><th className="p-3">Tindakan</th></tr></thead><tbody>{filtered.map(row => <tr className="border-t" key={keyOf(row)}><td className="p-3"><strong>{labels[row.kind]}</strong><div className="mt-1 max-w-[250px] break-words text-slate-600">{row.label}</div><div className="mt-1 break-all text-[10px] text-slate-400">{row.id}</div></td><td className="p-3">{row.year || '—'}</td><td className="p-3">{row.uploadedAt ? new Date(row.uploadedAt).toLocaleString('id-ID') : '—'}</td><td className="p-3 text-right">{row.recordCount}</td><td className="p-3 text-right">{formatRupiah(row.amount)}</td><td className="p-3"><Button variant="outline" size="sm" disabled={busy} onClick={() => select(row)}>Periksa hapus</Button></td></tr>)}{filtered.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-slate-500">{busy ? 'Memuat daftar...' : 'Tidak ada upload aktif untuk filter ini.'}</td></tr>}</tbody></table></div>
        {selected && <div className="space-y-4 rounded-xl border border-red-200 bg-red-50/40 p-4">
          <div className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-slate-700"/><div><h3 className="text-sm font-semibold">Konfirmasi penghapusan {labels[selected.kind]}</h3><p className="mt-1 break-all text-xs text-slate-600">{selected.id}</p></div></div>
          <div className="grid gap-2 text-xs sm:grid-cols-2"><p><strong>Sumber:</strong> {selected.label}</p><p><strong>Tahun:</strong> {selected.year || 'Lintas periode'}</p><p><strong>Record aktif:</strong> {selected.recordCount}</p><p><strong>Nilai:</strong> {formatRupiah(selected.amount)}</p><p><strong>Record yang diblokir:</strong> {selected.blocked}</p><p><strong>Periode:</strong> {selected.periods.length ? selected.periods.join(', ') : '—'}</p></div>
          {selected.blocked > 0 ? <div className="flex gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800"><AlertCircle className="h-4 w-4 shrink-0"/>Batch tidak dapat dihapus karena ada record yang telah diproses atau mempunyai referensi. Tidak ada penghapusan sebagian. Hubungi IT untuk penanganan data yang sudah operasional.</div> : <>
            <p className="text-xs leading-relaxed text-slate-700">Penghapusan ini akan mengeluarkan seluruh record dalam preview dari data aktif. Isi alasan dan ketik ID batch persis untuk mengonfirmasi.</p>
            <label className="block space-y-1 text-xs font-medium">Alasan penghapusan (wajib)<Textarea value={reason} onChange={event => setReason(event.target.value)} placeholder="Contoh: Koreksi upload RKAP yang salah, akan diganti dengan file resmi yang sudah divalidasi." maxLength={1000} disabled={busy} className="bg-white"/></label>
            <label className="block space-y-1 text-xs font-medium">Ketik ID batch untuk konfirmasi<Input value={confirmation} onChange={event => setConfirmation(event.target.value)} placeholder={selected.id} disabled={busy} className="bg-white"/></label>
            <div className="flex flex-wrap gap-2"><Button variant="destructive" onClick={archive} disabled={busy || reason.trim().length < 10 || confirmation.trim() !== selected.id}>Arsipkan & Hapus Data Aktif</Button><Button variant="outline" onClick={() => setSelected(null)} disabled={busy}>Batal</Button></div>
          </>}
        </div>}
      </>}
    </CardContent>
  </Card>;
};
export default OfficialUploadArchiveManager;
