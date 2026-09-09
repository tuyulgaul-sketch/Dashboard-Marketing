import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, BarChart3, Database, RefreshCw, Target, TrendingUp } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatRupiah } from '@/utils/formatters';
import {
  buildPerformanceSummary, listDirectoratePerformance,
  normalizePerformanceScope, type BusinessTypeFilter, type DirectoratePerformanceSnapshot,
} from '@/services/directoratePerformanceService';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const formatCount = (value: number) => value.toLocaleString('id-ID');
const compact = (value: number) => new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
const formatTimestamp = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Tidak tersedia' : date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
};

const Metric: React.FC<{ label: string; value: string; detail?: string }> = ({ label, value, detail }) => (
  <Card className="border-slate-200">
    <CardContent className="space-y-2 p-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="break-words text-xl font-bold tracking-tight text-slate-900">{value}</p>
      {detail && <p className="text-xs text-slate-500">{detail}</p>}
    </CardContent>
  </Card>
);

/** Public-to-the-directorate aggregate view; it never mounts a mutation facade. */
const DirectoratePerformancePage: React.FC<{ view: 'target' | 'realization' }> = ({ view }) => {
  const { profile } = useAuth();
  const [snapshot, setSnapshot] = useState<DirectoratePerformanceSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [scope, setScope] = useState('ALL');
  const [business, setBusiness] = useState<BusinessTypeFilter>('OVERALL');
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const request = ++requestId.current;
    setRefreshing(true);
    setError(null);
    try {
      const next = await listDirectoratePerformance();
      if (request !== requestId.current) return;
      setSnapshot(next);
    } catch (caught) {
      if (request !== requestId.current) return;
      setSnapshot(null);
      setError(caught instanceof Error ? caught.message : 'Laporan pusat belum dapat dimuat.');
    } finally {
      if (request === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    setSnapshot(null);
    setLoading(true);
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 30_000);
    const onFocus = () => { void refresh(); };
    const onVisibility = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      requestId.current += 1;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refresh, profile?.id]);

  const years = useMemo(() => {
    const values = new Set<number>([new Date().getFullYear()]);
    snapshot?.targets.forEach(row => values.add(row.year));
    snapshot?.summaries.forEach(row => values.add(row.year));
    return [...values].sort((a, b) => b - a);
  }, [snapshot]);

  const scopes = useMemo(() => {
    const values = new Set<string>(['Advisor', 'Captive Marketing', 'Corporate & Retail Marketing']);
    snapshot?.targets.forEach(row => {
      const normalized = normalizePerformanceScope(row.unit, row.department);
      if (normalized.department !== 'None') values.add(normalized.department);
    });
    snapshot?.summaries.forEach(row => {
      const normalized = normalizePerformanceScope(row.unit, row.department);
      if (normalized.department !== 'None') values.add(normalized.department);
    });
    return [...values].sort((a, b) => a.localeCompare(b, 'id'));
  }, [snapshot]);

  const summary = useMemo(() => snapshot ? buildPerformanceSummary(snapshot, year, scope, business) : null,
    [snapshot, year, scope, business]);
  const title = view === 'target' ? 'Target Kinerja' : 'Realisasi Produksi';
  const scopeLabel = scope === 'ALL' ? 'Direktorat Marketing' : scope;
  const hasTarget = Boolean(summary?.targets.length);
  const monthly = summary?.monthly.map(row => ({ ...row, label: MONTHS[row.month - 1] })) || [];
  const actualRows = useMemo(() => summary?.productions || [], [summary]);
  const targetRows = useMemo(() => summary?.targets || [], [summary]);
  const breakdown = useMemo(() => {
    if (!summary) return [];
    const keys = new Set<string>();
    targetRows.forEach(row => {
      const normalized = normalizePerformanceScope(row.unit, row.department);
      keys.add(normalized.department !== 'None' ? normalized.department : normalized.unit);
    });
    actualRows.forEach(row => {
      const normalized = normalizePerformanceScope(row.unit, row.department);
      keys.add(normalized.department !== 'None' ? normalized.department : normalized.unit);
    });
    return [...keys].sort((a, b) => a.localeCompare(b, 'id')).map(key => {
      const rowTargets = targetRows.filter(row => {
        const normalized = normalizePerformanceScope(row.unit, row.department);
        return (normalized.department !== 'None' ? normalized.department : normalized.unit) === key;
      });
      const rowActual = actualRows.filter(row => {
        const normalized = normalizePerformanceScope(row.unit, row.department);
        return (normalized.department !== 'None' ? normalized.department : normalized.unit) === key;
      });
      const target = rowTargets.reduce((sum, row) => sum + (business === 'New Business' ? row.annualNB : business === 'Renewal Business' ? row.annualRN : row.annualTotal), 0);
      const actual = rowActual.reduce((sum, row) => sum + row.amount, 0);
      return { key, target, actual, achievement: target > 0 ? actual / target * 100 : null };
    });
  }, [summary, targetRows, actualRows, business]);

  const productBreakdown = useMemo(() => {
    const values = new Map<string, { name: string; amount: number; transactions: number }>();
    actualRows.forEach(row => {
      const name = row.productName || 'Produk belum terpetakan';
      const previous = values.get(name) || { name, amount: 0, transactions: 0 };
      previous.amount += row.amount;
      previous.transactions += row.transactionCount;
      values.set(name, previous);
    });
    return [...values.values()].sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name, 'id'));
  }, [actualRows]);
  const history = snapshot?.batches.filter(batch => batch.publishedPeriodKeys.some(period => period.startsWith(`${year}-`))).slice(0, 10) || [];

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-blue-50 p-2.5">{view === 'target' ? <Target className="h-5 w-5 text-blue-700" /> : <TrendingUp className="h-5 w-5 text-blue-700" />}</div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{title}</h1>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{view === 'target' ? 'Target terdistribusi dan pencapaian berdasarkan data yang telah dipublikasikan.' : 'Realisasi Official seluruh Direktorat Marketing berdasarkan snapshot produksi terakhir yang dipublikasikan.'}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2"><Badge variant="outline">READ ONLY</Badge><span className="text-[11px] text-slate-500">{snapshot ? `Diperbarui ${formatTimestamp(snapshot.refreshedAt)}` : loading ? 'Memuat laporan pusat...' : 'Data pusat'}</span></div>
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => void refresh()} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>

        {!snapshot ? (
          <Card className="border-slate-200"><CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            {error ? <AlertCircle className="h-8 w-8 text-amber-600" /> : <Database className="h-8 w-8 text-slate-400" />}
            <p className="text-sm font-semibold">{error ? 'Laporan pusat belum tersedia' : 'Memuat laporan pusat...'}</p>
            <p role={error ? 'alert' : 'status'} className="max-w-lg text-xs text-slate-500">{error || 'Mengambil data yang telah dipublikasikan. Tidak menggunakan data browser lama.'}</p>
            {error && <Button variant="outline" onClick={() => void refresh()}>Coba lagi</Button>}
          </CardContent></Card>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div><label className="mb-1 block text-xs font-semibold text-slate-600">Tahun</label><Select value={String(year)} onValueChange={value => setYear(Number(value))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{years.map(value => <SelectItem key={value} value={String(value)}>{value}</SelectItem>)}</SelectContent></Select></div>
              <div><label className="mb-1 block text-xs font-semibold text-slate-600">Scope</label><Select value={scope} onValueChange={setScope}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">Seluruh Direktorat</SelectItem>{scopes.map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
              <div><label className="mb-1 block text-xs font-semibold text-slate-600">Jenis Bisnis</label><Select value={business} onValueChange={value => setBusiness(value as BusinessTypeFilter)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="OVERALL">Overall</SelectItem><SelectItem value="New Business">New Business</SelectItem><SelectItem value="Renewal Business">Renewal Business</SelectItem></SelectContent></Select></div>
            </div>
            <p className="text-xs font-medium text-slate-500">Scope: {scopeLabel} • Tahun {year} • {business === 'OVERALL' ? 'NB + RN' : business}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {view === 'target' ? (
                <>
                  <Metric label="Target Tahunan" value={hasTarget ? formatRupiah(summary!.annualTarget) : 'Belum tersedia'} detail="Jumlah target pribadi yang terdistribusi; tanpa menghitung cascading berulang." />
                  <Metric label="Realisasi Official" value={formatRupiah(summary!.actual)} detail="Akumulasi produksi tahun terpilih" />
                  <Metric label="Achievement" value={summary!.achievement === null ? '—' : `${summary!.achievement.toFixed(2)}%`} detail={hasTarget ? 'Realisasi / Target' : 'Menunggu target dipublikasikan'} />
                  <Metric label="Sisa Target" value={hasTarget ? formatRupiah(Math.max(0, summary!.annualTarget - summary!.actual)) : '—'} />
                </>
              ) : (
                <>
                  <Metric label="Realisasi Official" value={formatRupiah(summary!.actual)} detail={`Tahun ${year}`} />
                  <Metric label="New Business" value={formatRupiah(summary!.nb)} />
                  <Metric label="Renewal Business" value={formatRupiah(summary!.rn)} />
                  <Metric label="Source Rows" value={formatCount(summary!.transactions)} detail="Jumlah baris sumber yang teragregasi" />
                </>
              )}
            </div>
            {view === 'target' && !hasTarget && <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">Target tahun {year} belum dipublikasikan. Sistem tidak membuat target atau achievement secara otomatis.</div>}
            <Card className="border-slate-200"><CardHeader><CardTitle className="flex items-center gap-2 text-sm"><BarChart3 className="h-4 w-4 text-blue-700" />{view === 'target' ? 'Monthly Target & Performance Outlook' : 'Produksi Bulanan Official'}</CardTitle><CardDescription className="text-xs">{view === 'target' ? 'Distribusi target bulanan dibandingkan realisasi, berdasarkan tanggal produksi.' : 'Nilai produksi dan jumlah baris sumber per bulan.'}</CardDescription></CardHeader><CardContent className="space-y-4">
              <div className="h-72 w-full min-w-0"><ResponsiveContainer width="100%" height="100%"><BarChart data={monthly} margin={{ top: 8, right: 8, bottom: 0, left: 4 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 10 }} /><YAxis tickFormatter={value => compact(Number(value))} tick={{ fontSize: 10 }} width={56} /><Tooltip formatter={value => formatRupiah(Number(value))} /><Legend wrapperStyle={{ fontSize: 11 }} />{view === 'target' && <Bar dataKey="target" name="Target" fill="#2563eb" radius={[3,3,0,0]} />}<Bar dataKey="actual" name="Realisasi" fill="#059669" radius={[3,3,0,0]} /></BarChart></ResponsiveContainer></div>
              <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-left text-xs"><thead className="border-b bg-slate-50 text-slate-600"><tr><th className="p-3">Bulan</th>{view === 'target' && <th className="p-3 text-right">Target</th>}<th className="p-3 text-right">Realisasi</th><th className="p-3 text-right">Source Rows</th></tr></thead><tbody className="divide-y">{monthly.map(row => <tr key={row.month}><td className="p-3 font-semibold">{row.label}</td>{view === 'target' && <td className="p-3 text-right">{formatRupiah(row.target)}</td>}<td className="p-3 text-right font-semibold text-emerald-700">{formatRupiah(row.actual)}</td><td className="p-3 text-right">{formatCount(row.transactions)}</td></tr>)}</tbody></table></div>
            </CardContent></Card>
            {view === 'target' && <Card className="border-slate-200"><CardHeader><CardTitle className="text-sm">Performance Breakdown</CardTitle><CardDescription className="text-xs">Target pribadi terdistribusi dan realisasi per unit/departemen. Baris perusahaan tidak menjumlahkan kembali target atasan dan bawahan.</CardDescription></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-xs"><thead className="border-b bg-slate-50"><tr><th className="p-3">Scope</th><th className="p-3 text-right">Target</th><th className="p-3 text-right">Realisasi</th><th className="p-3 text-right">Achievement</th></tr></thead><tbody className="divide-y">{breakdown.map(row => <tr key={row.key}><td className="p-3 font-semibold">{row.key}</td><td className="p-3 text-right">{formatRupiah(row.target)}</td><td className="p-3 text-right">{formatRupiah(row.actual)}</td><td className="p-3 text-right">{row.achievement === null ? '—' : `${row.achievement.toFixed(2)}%`}</td></tr>)}{breakdown.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-slate-500">Belum ada data untuk scope ini.</td></tr>}</tbody></table></div></CardContent></Card>}
            {view === 'realization' && <Card className="border-slate-200"><CardHeader><CardTitle className="text-sm">Realisasi per Produk</CardTitle><CardDescription className="text-xs">Agregat produk untuk scope dan jenis bisnis yang dipilih.</CardDescription></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full min-w-[480px] text-left text-xs"><thead className="border-b bg-slate-50"><tr><th className="p-3">Produk</th><th className="p-3 text-right">Realisasi</th><th className="p-3 text-right">Source Rows</th></tr></thead><tbody className="divide-y">{productBreakdown.map(row => <tr key={row.name}><td className="p-3 font-semibold">{row.name}</td><td className="p-3 text-right">{formatRupiah(row.amount)}</td><td className="p-3 text-right">{formatCount(row.transactions)}</td></tr>)}{productBreakdown.length === 0 && <tr><td colSpan={3} className="p-6 text-center text-slate-500">Belum ada realisasi Official untuk pilihan ini.</td></tr>}</tbody></table></div></CardContent></Card>}
            {view === 'realization' && history.length > 0 && <Card className="border-slate-200"><CardHeader><CardTitle className="text-sm">Riwayat Publish Snapshot</CardTitle><CardDescription className="text-xs">Re-upload periode yang sama mengganti snapshot periode tersebut. Riwayat tidak dijumlahkan kembali sebagai produksi.</CardDescription></CardHeader><CardContent className="space-y-2">{history.map(batch => <div key={batch.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-slate-200 p-3"><div><p className="text-xs font-semibold">{batch.filename || 'Snapshot Produksi'}</p><p className="mt-1 text-[11px] text-slate-500">{formatTimestamp(batch.uploadedAt)} • {batch.publishedPeriodKeys.join(', ')}</p></div><div className="text-right"><p className="text-xs font-semibold">{formatRupiah(batch.totalProductionAmount)}</p><p className="text-[11px] text-slate-500">{formatCount(batch.validRowCount)} valid rows</p></div></div>)}</CardContent></Card>}
            <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-4 text-xs leading-relaxed text-blue-900"><strong>Sumber data:</strong> Target berasal dari batch RKAP current yang dipublikasikan Arianie. Realisasi berasal dari ringkasan Official Production yang terhubung dengan batch published. Pembaruan diperiksa otomatis setiap 30 detik saat halaman aktif dan dapat diminta melalui Refresh. Ini bukan koneksi langsung ke core asuransi; angka baru muncul setelah snapshot dipublikasikan.</div>
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default DirectoratePerformancePage;
