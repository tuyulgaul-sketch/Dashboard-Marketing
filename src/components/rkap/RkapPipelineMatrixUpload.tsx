import React, { useEffect, useState } from 'react';
import { store } from '@/services/store';
import type { BookingCase, Pipeline, ProductMaster, User } from '@/types';
import { useTargetRealizationPublisher } from '@/hooks/useTargetRealizationPublisher';
import { waitForCentralBusinessStorageSync } from '@/services/centralBusinessStorageRuntime';
import { readMarketingSpreadsheet, SPREADSHEET_ACCEPT } from '@/utils/marketingWorkbook';
import { downloadRkapPipelineWorkbook } from '@/utils/rkapPipelineWorkbook';
import { MATRIX_REQUIRED_HEADERS, normalizePipelineMatrix, pipelineMatrixIdentity, type MatrixPlan, type MatrixRow } from '@/utils/rkapPipelineMatrix';
import { formatRupiah } from '@/utils/formatters';
import TargetRkapPage from '@/pages/TargetRkapPage';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Download, FileSpreadsheet, ShieldCheck } from 'lucide-react';

type Review = { file: File; year: number; rows: MatrixRow[]; plans: MatrixPlan[]; warnings: string[]; signature: string };
type StoredSchedule = {
  version: 1; year: number; sourceRow: string; sourceFile: string; sourceBatchId: string;
  currency: string; exchangeRate: string; exchangeRateSource?: string; exchangeRateDate?: string;
  paymentMode?: string; monthlyOriginal: string[]; monthlyIdr: number[]; totalOriginal: string; totalIdr: number;
};
type ScheduledPipeline = Pipeline & { pipelineYear: number; pipelineMonth: number; rkapPremiumSchedule: StoredSchedule };
const identity = (row: { customerName: string; productName: string }, year: number) => pipelineMatrixIdentity(year, row.customerName, row.productName);
const yearOf = (row: Pipeline | BookingCase): number => Number((row as Pipeline & { pipelineYear?: number }).pipelineYear) || Number(('currentTargetClosingDate' in row ? row.currentTargetClosingDate : row.targetClosingDate).slice(0, 4));
const signatureOf = (plans: MatrixPlan[]) => JSON.stringify(plans.map(plan => ({ ...plan, owner: plan.owner.id })));
const duplicateWarnings = (plans: MatrixPlan[], pipelines: Pipeline[], bookings: BookingCase[], year: number): string[] => {
  const messages: string[] = [];
  for (const plan of plans) {
    const key = identity(plan, year);
    const existing = pipelines.find(row => yearOf(row) === year && identity(row, year) === key);
    if (existing) throw new Error(`Baris ${plan.rowNumber}: opportunity sudah terdaftar pada Pipeline ${existing.id}. Upload tidak boleh menggandakan atau menimpa data existing.`);
    const booking = bookings.find(row => yearOf(row) === year && row.status !== 'Rejected' && identity(row, year) === key);
    if (booking) throw new Error(`Baris ${plan.rowNumber}: opportunity sudah ada pada Booking Case ${booking.id}.`);
  }
  return messages;
};
const readPlans = async (file: File, year: number, users: User[], products: ProductMaster[], pipelines: Pipeline[], bookings: BookingCase[]) => {
  const rows = await readMarketingSpreadsheet(file, { sheetName: file.name.toLowerCase().endsWith('.xlsx') ? 'Data Pipeline' : undefined, requiredHeaders: MATRIX_REQUIRED_HEADERS });
  const plans = normalizePipelineMatrix(rows, users, products, year);
  const warnings = [...plans.flatMap(plan => plan.warnings.map(message => `Baris ${plan.rowNumber}: ${message}`)), ...duplicateWarnings(plans, pipelines, bookings, year)];
  return { rows, plans, warnings, signature: signatureOf(plans) };
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
  const [showLegacy, setShowLegacy] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => store.subscribe(() => setRevision(value => value + 1)), []);
  const authorized = publisherAuthorized && canPublish && !loading && store.getCurrentUser().role === 'TEAM_LEADER_MARKETING_SUPPORT';
  const currentUsers = store.getUsers();
  const currentProducts = store.getProducts();
  const currentPipelines = store.getPipelines();
  const currentBookings = store.getBookings();
  void revision;
  const validate = async () => {
    if (!file || !authorized) return;
    setBusy(true); setReview(null); setMessage('');
    try {
      const result = await readPlans(file, year, store.getUsers(), store.getProducts(), store.getPipelines(), store.getBookings());
      setReview({ file, year, ...result });
      setMessage(`Validasi selesai: ${result.plans.length} opportunity, ${result.warnings.length} peringatan. Belum ada data yang dipublish.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Gagal memvalidasi Pipeline.'); }
    finally { setBusy(false); }
  };
  const publish = async () => {
    if (!review || !authorized || busy || review.file !== file || review.year !== year) return;
    setBusy(true); setMessage('');
    try {
      const latest = await readPlans(review.file, year, store.getUsers(), store.getProducts(), store.getPipelines(), store.getBookings());
      if (latest.signature !== review.signature || JSON.stringify(latest.warnings) !== JSON.stringify(review.warnings)) throw new Error('File atau User/Product Master berubah. Jalankan validasi ulang sebelum publish.');
      if (!window.confirm(`Publish ${latest.plans.length} opportunity RKAP ${year} dengan total ${formatRupiah(latest.plans.reduce((total, plan) => total + plan.totalIdr, 0))}? Setiap baris menjadi satu Pipeline dan jadwal bulanan disimpan terpisah.`)) return;
      const actor = store.getCurrentUser();
      if (actor.role !== 'TEAM_LEADER_MARKETING_SUPPORT') throw new Error('Otoritas publisher berubah. Login ulang dan validasi kembali.');
      const ids = allocateIds(year, latest.plans.length, store.getPipelines());
      const now = new Date().toISOString();
      const batchId = `BATCH-RKAP-${year}-${Date.now()}`;
      const records: ScheduledPipeline[] = latest.plans.map((plan, index) => ({
        id: ids[index], pipelineYear: plan.year, pipelineMonth: Number(plan.targetClosingDate.slice(5, 7)), source: 'RKAP_BULK',
        businessType: plan.businessType, customerName: plan.customerName, insuranceType: plan.insuranceType,
        customerCategory: plan.customerCategory, productId: plan.productId, productName: plan.productName,
        estimatedPremium: plan.totalIdr, currentCommercialValue: plan.totalIdr,
        originalTargetClosingDate: plan.targetClosingDate, currentTargetClosingDate: plan.targetClosingDate,
        isTender: plan.isTender, channel: plan.channel, picUserId: plan.owner.id, picName: plan.owner.name,
        unit: plan.owner.unit, department: plan.owner.department,
        status: 'Menunggu Upload Dokumen Marketing', currentHandler: 'MARKETING', lastProgressAt: now, dayLapse: 0,
        existingPolicyNumber: plan.existingPolicyNumber, originalPolicyYear: plan.originalPolicyYear,
        coverageStart: plan.coverageStart, coverageEnd: plan.coverageEnd, renewalType: plan.renewalType,
        documents: [], quotations: [], createdAt: now, createdBy: actor.name,
        rkapPremiumSchedule: { version: 1, year, sourceRow: plan.rowReference, sourceFile: review.file.name, sourceBatchId: batchId,
          currency: plan.currency, exchangeRate: plan.exchangeRate, exchangeRateSource: plan.exchangeRateSource,
          exchangeRateDate: plan.exchangeRateDate, paymentMode: plan.paymentMode, monthlyOriginal: plan.monthlyOriginal,
          monthlyIdr: plan.monthlyIdr, totalOriginal: plan.totalOriginal, totalIdr: plan.totalIdr },
      }));
      for (const record of records) store.addPipeline(record);
      await waitForCentralBusinessStorageSync('pertalife_pipelines');
      setReview(null); setFile(null);
      setMessage(`${records.length} opportunity berhasil tersimpan dan sinkron ke database. Jadwal premi 12 bulan tetap melekat pada masing-masing Pipeline.`);
    } catch (error) { setReview(null); setMessage(error instanceof Error ? error.message : 'Publish gagal. Periksa status sinkronisasi sebelum mencoba ulang.'); }
    finally { setBusy(false); }
  };
  const download = async () => {
    if (!authorized) return;
    setBusy(true); setMessage('');
    try { await downloadRkapPipelineWorkbook(store.getUsers(), year); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Gagal membuat template XLSX.'); }
    finally { setBusy(false); }
  };
  return <div className="space-y-4">
    <Card className="border-blue-200">
      <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><FileSpreadsheet className="h-5 w-5 text-blue-700"/>Bulk Pipeline RKAP – Jadwal Premi Tahunan</CardTitle><CardDescription>Satu baris adalah satu opportunity. Premi bulan 1–12 disimpan sebagai jadwal, bukan dibuat menjadi 12 case. Template memuat data operasional dan daftar User ID dari User Master.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="text-xs font-semibold text-slate-700">Tahun RKAP<select className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-2" value={year} onChange={event => { setYear(Number(event.target.value)); setReview(null); }} disabled={busy}><option value={2026}>2026</option><option value={2027}>2027</option></select></label>
          <div className="flex items-end"><Button variant="outline" className="w-full gap-2 text-xs" onClick={download} disabled={!authorized || busy}><Download className="h-4 w-4"/>Download Template XLSX</Button></div>
          <label className="text-xs font-semibold text-slate-700">Upload XLSX / CSV<Input className="mt-1" type="file" accept={SPREADSHEET_ACCEPT} disabled={!authorized || busy} onChange={event => { setFile(event.target.files?.[0] || null); setReview(null); setMessage(''); }}/></label>
          <div className="flex items-end"><Button className="w-full gap-2 text-xs" onClick={validate} disabled={!authorized || busy || !file}><ShieldCheck className="h-4 w-4"/>Validasi File</Button></div>
        </div>
        <p className="text-xs leading-relaxed text-slate-600">Format utama: No., Companies, Product, Dist. Channel, Currency, NB/RN, Jenis Asuransi, 1–12, TOTAL PREMI, UserID, ditambah Tahun, Cara Bayar, Kategori Nasabah, Estimasi Tanggal Closing, Metode Pengadaan, referensi polis/coverage, catatan, dan data kurs bila diperlukan. Bulan kosong berarti nol; TOTAL PREMI wajib sama dengan jumlah 12 bulan. Tanggal closing tidak menentukan jadwal premi.</p>
        {message && <div role="status" className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">{message}</div>}
        {!authorized && <div className="flex gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900"><AlertCircle className="h-4 w-4 shrink-0"/>Menunggu otoritas publisher resmi. Tidak ada akses publish tambahan.</div>}
        {review && <div className="space-y-3 rounded-lg border border-blue-100 bg-blue-50/30 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold">Preview {review.plans.length} opportunity</p><p className="text-xs text-slate-500">{review.file.name} • {review.year} • Belum dipublish</p></div><Button onClick={publish} disabled={busy || !authorized}>Publish Bulk Pipeline</Button></div>
          <div className="flex flex-wrap gap-2"><Badge variant="outline">Total IDR {formatRupiah(review.plans.reduce((total, plan) => total + plan.totalIdr, 0))}</Badge><Badge variant="outline">{review.warnings.length} peringatan</Badge></div>
          {review.warnings.length > 0 && <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{review.warnings.join('; ')}</div>}
          <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="border-b text-slate-500"><th className="p-2">No.</th><th className="p-2">Companies / Product</th><th className="p-2">PIC</th><th className="p-2">Currency / Total</th><th className="p-2">Jadwal</th><th className="p-2">Closing</th></tr></thead><tbody>{review.plans.map(plan => <tr className="border-b" key={plan.rowReference}><td className="p-2">{plan.rowReference}</td><td className="p-2"><strong>{plan.customerName}</strong><br/>{plan.productName}</td><td className="p-2">{plan.owner.name}<br/>{plan.owner.id}</td><td className="p-2">{plan.currency} {plan.totalOriginal}<br/>{formatRupiah(plan.totalIdr)}</td><td className="p-2">{plan.monthlyOriginal.map((amount, index) => Number(amount) > 0 ? `${index + 1}: ${amount}` : '').filter(Boolean).join(' • ')}</td><td className="p-2">{plan.targetClosingDate}</td></tr>)}</tbody></table></div>
        </div>}
      </CardContent>
    </Card>
    <div className="rounded-lg border border-slate-200 bg-white p-3"><Button variant="ghost" className="w-full justify-between text-xs" onClick={() => setShowLegacy(value => !value)}>{showLegacy ? 'Sembunyikan' : 'Buka'} format Bulk Pipeline operasional lama</Button>{showLegacy && <div className="mt-3"><TargetRkapPage embedded initialUploadTab="bulk" publisherAuthorized={authorized}/></div>}</div>
  </div>;
};
export default RkapPipelineMatrixUpload;
