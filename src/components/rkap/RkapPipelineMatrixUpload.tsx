import React, { useEffect, useState } from 'react';
import { store } from '@/services/store';
import type { BookingCase, Pipeline, ProductMaster, User } from '@/types';
import { useTargetRealizationPublisher } from '@/hooks/useTargetRealizationPublisher';
import { waitForCentralBusinessStorageSync } from '@/services/centralBusinessStorageRuntime';
import { readMarketingSpreadsheet, SPREADSHEET_ACCEPT } from '@/utils/marketingWorkbook';
import { downloadCompactPipelineWorkbook } from '@/utils/rkapPipelineCompactWorkbook';
import { COMPACT_PIPELINE_REQUIRED, normalizeCompactPipeline, type CompactMatrixPlan, type BatchExchangeRate } from '@/utils/rkapPipelineCompact';
import { makeCompactPipelineRecord } from '@/utils/rkapPipelineCompactImport';
import { pipelineMatrixIdentity, type MatrixRow } from '@/utils/rkapPipelineMatrix';
import { formatRupiah } from '@/utils/formatters';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Download, FileSpreadsheet, ShieldCheck } from 'lucide-react';

type Review = { file: File; year: number; rows: MatrixRow[]; plans: CompactMatrixPlan[]; warnings: string[]; signature: string };
const identity = (row: { customerName: string; productName: string }, year: number) => pipelineMatrixIdentity(year, row.customerName, row.productName);
const yearOf = (row: Pipeline | BookingCase): number => Number((row as Pipeline & { pipelineYear?: number }).pipelineYear) || Number(('currentTargetClosingDate' in row ? row.currentTargetClosingDate : row.targetClosingDate).slice(0, 4));
const signatureOf = (plans: CompactMatrixPlan[]) => JSON.stringify(plans.map(plan => ({ ...plan, owner: plan.owner.id })));
const checkDuplicates = (plans: CompactMatrixPlan[], pipelines: Pipeline[], bookings: BookingCase[], year: number): void => {
  for (const plan of plans) {
    const key = identity(plan, year);
    const existing = pipelines.find(row => yearOf(row) === year && identity(row, year) === key);
    if (existing) throw new Error(`Baris ${plan.rowNumber}: opportunity sudah terdaftar pada Pipeline ${existing.id}. Upload tidak boleh menggandakan atau menimpa data existing.`);
    const booking = bookings.find(row => yearOf(row) === year && row.status !== 'Rejected' && identity(row, year) === key);
    if (booking) throw new Error(`Baris ${plan.rowNumber}: opportunity sudah ada pada Booking Case ${booking.id}.`);
  }
};
const readPlans = async (file: File, year: number, users: User[], products: ProductMaster[], pipelines: Pipeline[], bookings: BookingCase[], rates: Record<string, BatchExchangeRate>) => {
  const rows = await readMarketingSpreadsheet(file, { sheetName: file.name.toLowerCase().endsWith('.xlsx') ? 'Data Pipeline' : undefined, requiredHeaders: COMPACT_PIPELINE_REQUIRED });
  const plans = normalizeCompactPipeline(rows, users, products, year, rates);
  checkDuplicates(plans, pipelines, bookings, year);
  return { rows, plans, warnings: plans.flatMap(plan => plan.warnings.map(message => `Baris ${plan.rowNumber}: ${message}`)), signature: signatureOf(plans) };
};
const allocateIds = (year: number, count: number, existing: Pipeline[]): string[] => {
  const ids = new Set(existing.map(row => row.id));
  const result: string[] = [];
  let sequence = 10000;
  while (result.length < count) {
    if (sequence > 99999) throw new Error('Nomor Pipeline untuk tahun ini habis. Hubungi administrator.');
    const id = `PL-${year}-${sequence++}`;
    if (!ids.has(id)) { ids.add(id); result.push(id); }
  }
  return result;
};

const RkapPipelineMatrixUpload: React.FC<{ publisherAuthorized: boolean }> = ({ publisherAuthorized }) => {
  const { canPublish, loading } = useTargetRealizationPublisher();
  const [year, setYear] = useState(2026);
  const [file, setFile] = useState<File | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [revision, setRevision] = useState(0);
  const [currencies, setCurrencies] = useState<string[]>([]);
  const [rates, setRates] = useState<Record<string, BatchExchangeRate>>({});
  useEffect(() => { const unsubscribe = store.subscribe(() => setRevision(value => value + 1)); return () => { unsubscribe(); }; }, []);
  const authorized = publisherAuthorized && canPublish && !loading && store.getCurrentUser().role === 'TEAM_LEADER_MARKETING_SUPPORT';
  void revision;
  const changeRate = (currency: string, field: keyof BatchExchangeRate, value: string) => {
    setRates(previous => ({ ...previous, [currency]: { rate: '', source: '', date: '', ...previous[currency], [field]: value } }));
    setReview(null);
  };
  const validate = async () => {
    if (!file || !authorized) return;
    setBusy(true); setReview(null); setMessage('');
    try {
      const rows = await readMarketingSpreadsheet(file, { sheetName: file.name.toLowerCase().endsWith('.xlsx') ? 'Data Pipeline' : undefined, requiredHeaders: COMPACT_PIPELINE_REQUIRED });
      setCurrencies([...new Set(rows.map(row => String(row.Currency || '').trim().toUpperCase()).filter(currency => currency && currency !== 'IDR'))].sort());
      const result = await readPlans(file, year, store.getUsers(), store.getProducts(), store.getPipelines(), store.getBookings(), rates);
      setReview({ file, year, ...result });
      setMessage(`Validasi selesai: ${result.plans.length} opportunity, ${result.warnings.length} peringatan. Belum ada data yang dipublish.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Gagal memvalidasi Pipeline.'); }
    finally { setBusy(false); }
  };
  const publish = async () => {
    if (!review || !authorized || busy || review.file !== file || review.year !== year) return;
    setBusy(true); setMessage('');
    try {
      const latest = await readPlans(review.file, year, store.getUsers(), store.getProducts(), store.getPipelines(), store.getBookings(), rates);
      if (latest.signature !== review.signature || JSON.stringify(latest.warnings) !== JSON.stringify(review.warnings)) throw new Error('File, kurs, atau User/Product Master berubah. Jalankan validasi ulang sebelum publish.');
      if (!window.confirm(`Publish ${latest.plans.length} opportunity RKAP ${year} dengan total ${formatRupiah(latest.plans.reduce((total, plan) => total + plan.totalIdr, 0))}? Data operasional yang belum tersedia tetap berstatus belum dilengkapi; jadwal premi tidak digunakan untuk menebak tanggal closing.`)) return;
      const actor = store.getCurrentUser();
      if (actor.role !== 'TEAM_LEADER_MARKETING_SUPPORT') throw new Error('Otoritas publisher berubah. Login ulang dan validasi kembali.');
      const ids = allocateIds(year, latest.plans.length, store.getPipelines());
      const now = new Date().toISOString();
      const batchId = `BATCH-RKAP-${year}-${Date.now()}`;
      const records = latest.plans.map((plan, index) => makeCompactPipelineRecord(plan, ids[index], actor, batchId, review.file.name, now));
      for (const record of records) store.addPipeline(record);
      await waitForCentralBusinessStorageSync('pertalife_pipelines');
      setReview(null); setFile(null);
      setMessage(`${records.length} opportunity berhasil tersimpan dan sinkron ke database. Jadwal premi 12 bulan tetap melekat pada masing-masing Pipeline.`);
    } catch (error) { setReview(null); setMessage(error instanceof Error ? error.message : 'Publish gagal. Periksa status sinkronisasi sebelum mencoba ulang; jangan mengulang upload secara membabi buta.'); }
    finally { setBusy(false); }
  };
  const download = async () => {
    if (!authorized) return;
    setBusy(true); setMessage('');
    try { await downloadCompactPipelineWorkbook(store.getUsers(), store.getProducts(), year); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Gagal membuat template XLSX.'); }
    finally { setBusy(false); }
  };
  return <div className="space-y-4">
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm"><FileSpreadsheet className="h-5 w-5 text-blue-700"/>Import Bulk Pipeline RKAP Terpusat</CardTitle>
        <CardDescription>Pipeline yang telah disepakati saat RKAP dipublikasikan serentak tanpa melalui Booking Case. Satu baris adalah satu opportunity, dengan jadwal premi 12 bulan dan master pusat sebagai sumber kategori produk serta grup pelaporan.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="text-xs font-semibold text-slate-700">Tahun Bulk Pipeline<select className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-2" value={year} onChange={event => { setYear(Number(event.target.value)); setReview(null); }} disabled={busy}><option value={2026}>Tahun 2026</option><option value={2027}>Tahun 2027</option></select></label>
          <div className="flex items-end"><Button variant="outline" className="w-full gap-2 text-xs" onClick={download} disabled={!authorized || busy}><Download className="h-4 w-4"/>Download Template (.xlsx)</Button></div>
          <label className="text-xs font-semibold text-slate-700">Upload XLSX / CSV<Input className="mt-1" type="file" accept={SPREADSHEET_ACCEPT} disabled={!authorized || busy} onChange={event => { setFile(event.target.files?.[0] || null); setReview(null); setMessage(''); setRates({}); setCurrencies([]); }}/></label>
          <div className="flex items-end"><Button className="w-full gap-2 text-xs" onClick={validate} disabled={!authorized || busy || !file}><ShieldCheck className="h-4 w-4"/>Validasi File</Button></div>
        </div>
        <p className="text-xs leading-relaxed text-slate-600">Format ringkas 23 kolom: No., Companies, Product, Dist. Channel, Currency, NB/RN, Jenis Asuransi, 1–12, TOTAL PREMI, UserID, Tahun, dan Catatan (opsional). Cara Bayar, kategori nasabah, tanggal closing, pengadaan, referensi polis/coverage, dan kurs tidak diminta sebagai kolom. Jenis/kategori produk mengikuti Master Produk; grup Captive, Corporate & Retail, atau Advisor mengikuti User Master. Data operasional yang belum diketahui tidak ditebak dari bulan premi.</p>
        {currencies.length > 0 && <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3"><p className="text-xs font-semibold text-amber-950">Kurs resmi untuk nilai non-IDR</p><p className="text-xs text-amber-900">Kurs tidak perlu diisi per baris Excel. Isi satu referensi kurs yang telah disetujui untuk setiap mata uang pada batch ini. Sistem tidak menebak kurs dan tidak menganggap mata uang asing sama dengan IDR.</p>{currencies.map(currency => <div className="grid grid-cols-1 gap-2 md:grid-cols-4" key={currency}><div className="flex items-center text-xs font-semibold">{currency} ke IDR</div><Input aria-label={`Kurs ${currency}`} placeholder="Kurs, contoh 16000.50" value={rates[currency]?.rate || ''} onChange={event => changeRate(currency, 'rate', event.target.value)} disabled={busy}/><Input aria-label={`Sumber kurs ${currency}`} placeholder="Sumber kurs disetujui" value={rates[currency]?.source || ''} onChange={event => changeRate(currency, 'source', event.target.value)} disabled={busy}/><Input aria-label={`Tanggal kurs ${currency}`} type="date" value={rates[currency]?.date || ''} onChange={event => changeRate(currency, 'date', event.target.value)} disabled={busy}/></div>)}</div>}
        {message && <div role="status" className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">{message}</div>}
        {!authorized && <div className="flex gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900"><AlertCircle className="h-4 w-4 shrink-0"/>Menunggu otoritas publisher resmi. Tidak ada akses publish tambahan.</div>}
        {review && <div className="space-y-3 rounded-lg border border-blue-100 bg-blue-50/30 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold">Preview {review.plans.length} opportunity</p><p className="text-xs text-slate-500">{review.file.name} • {review.year} • Belum dipublish</p></div><Button onClick={publish} disabled={busy || !authorized}>Publish Bulk Pipeline</Button></div>
          <div className="flex flex-wrap gap-2"><Badge variant="outline">Total IDR {formatRupiah(review.plans.reduce((total, plan) => total + plan.totalIdr, 0))}</Badge><Badge variant="outline">{review.warnings.length} peringatan</Badge></div>
          {review.warnings.length > 0 && <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{review.warnings.join('; ')}</div>}
          <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="border-b text-slate-500"><th className="p-2">No.</th><th className="p-2">Companies / Product</th><th className="p-2">PIC / Grup Pelaporan</th><th className="p-2">Currency / Total</th><th className="p-2">Jadwal</th><th className="p-2">Status operasional</th></tr></thead><tbody>{review.plans.map(plan => <tr className="border-b" key={plan.rowReference}><td className="p-2">{plan.rowReference}</td><td className="p-2"><strong>{plan.customerName}</strong><br/>{plan.productName}</td><td className="p-2">{plan.owner.name}<br/>{plan.owner.id}<br/><strong>{plan.reportingGroup}</strong></td><td className="p-2">{plan.currency} {plan.totalOriginal}<br/>{formatRupiah(plan.totalIdr)}</td><td className="p-2">{plan.monthlyOriginal.map((amount, index) => Number(amount) > 0 ? `${index + 1}: ${amount}` : '').filter(Boolean).join(' • ')}</td><td className="p-2">{plan.targetClosingDate || 'Closing belum ditentukan'}<br/>{plan.procurementStatus === 'Unknown' ? 'Pengadaan belum ditentukan' : plan.procurementStatus}</td></tr>)}</tbody></table></div>
        </div>}
      </CardContent>
    </Card>
  </div>;
};
export default RkapPipelineMatrixUpload;
