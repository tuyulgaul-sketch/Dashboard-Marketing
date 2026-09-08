import React, { useEffect, useMemo, useState } from 'react';
import type { TargetEntry, TargetUploadBatch, User } from '@/types';
import { store } from '@/services/store';
import { listCentralTargets, publishCentralTargetBatch } from '@/services/targetService';
import { refreshCentralTargetRuntime } from '@/services/centralTargetRuntime';
import { useTargetRealizationPublisher } from '@/hooks/useTargetRealizationPublisher';
import { formatRupiah } from '@/utils/formatters';
import { parseExactTargetRupiah } from '@/utils/targetCompact';
import { calculateTargetSetup, seedTargetDraft, targetSetupHolders, TARGET_MONTHS, validateTargetSetup, type TargetBaseline, type TargetDraft, type TargetKind } from '@/utils/targetOnScreen';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, CheckCircle2, RefreshCw, Save, ShieldCheck } from 'lucide-react';

type Calculated = ReturnType<typeof calculateTargetSetup>;
const snapshot = (rows: TargetEntry[]) => JSON.stringify([...rows].sort((a, b) => a.userId.localeCompare(b.userId)));
const directorySignature = (users: User[]) => JSON.stringify(targetSetupHolders(users).map(user => [user.id, user.name, user.role, user.status, user.superiorId, user.unit, user.department, user.position]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
const amount = (value: string) => { try { return parseExactTargetRupiah(value); } catch { return null; } };
const money = (value: number | null) => value === null ? 'Periksa angka' : formatRupiah(value);
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

const TargetOnScreenSetup: React.FC<{ publisherAuthorized: boolean }> = ({ publisherAuthorized }) => {
  const { canPublish, loading } = useTargetRealizationPublisher();
  const [year, setYear] = useState(2026);
  const [users, setUsers] = useState<User[]>([]);
  const [draft, setDraft] = useState<TargetDraft>({});
  const [baseline, setBaseline] = useState<TargetBaseline>({ NB: '', RN: '' });
  const [confirmed, setConfirmed] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [sourceSnapshot, setSourceSnapshot] = useState('');
  const [sourceDirectory, setSourceDirectory] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [review, setReview] = useState<Calculated | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [batchNotes, setBatchNotes] = useState('');
  const actor = store.getCurrentUser();
  const authorized = publisherAuthorized && canPublish && !loading && actor.id === 'USR-000024' && actor.role === 'TEAM_LEADER_MARKETING_SUPPORT';

  const loadYear = async (selectedYear: number) => {
    setBusy(true); setLoaded(false); setReview(null); setMessage(''); setAcknowledged(false);
    try {
      await refreshCentralTargetRuntime();
      const directory = store.getUsers();
      const current = await listCentralTargets(selectedYear);
      const seeded = seedTargetDraft(directory, current, selectedYear);
      const holders = targetSetupHolders(directory);
      if (!holders.length) throw new Error('User Master target belum tersedia.');
      setUsers(directory); setDraft(seeded.draft); setBaseline(seeded.baseline); setConfirmed(seeded.confirmed);
      setSourceSnapshot(snapshot(current)); setSourceDirectory(directorySignature(directory));
      setSelectedId(holders.find(user => user.role === 'DIRECTOR_MARKETING')?.id || holders[0].id);
      setBatchNotes(''); setDirty(false); setLoaded(true);
      setMessage(current.length ? `Memuat ${current.length} target resmi ${selectedYear}. Perubahan belum disimpan ke database.` : `Belum ada target resmi ${selectedYear}. Isi dan konfirmasi seluruh alokasi, termasuk nilai nol.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Gagal memuat target resmi.'); }
    finally { setBusy(false); }
  };
  useEffect(() => { if (authorized) void loadYear(year); }, [authorized, year]);

  const holders = useMemo(() => targetSetupHolders(users), [users]);
  const selected = holders.find(user => user.id === selectedId);
  const allocation = draft[selectedId];
  const calculated = useMemo(() => {
    if (!loaded) return { result: null as Calculated | null, error: '' };
    try { return { result: calculateTargetSetup(users, draft, year, { NB: baseline.NB || '0', RN: baseline.RN || '0' }), error: '' }; }
    catch (error) { return { result: null, error: error instanceof Error ? error.message : 'Alokasi tidak valid.' }; }
  }, [users, draft, year, baseline, loaded]);
  const entries = calculated.result?.entries || [];
  const entryById = new Map(entries.map(entry => [entry.userId, entry]));
  const director = holders.find(user => user.role === 'DIRECTOR_MARKETING');
  const children = (id: string) => holders.filter(user => user.superiorId === id);
  const ordered = useMemo(() => {
    const result: { user: User; depth: number }[] = [];
    const seen = new Set<string>();
    const visit = (user: User, depth: number) => {
      if (seen.has(user.id)) return;
      seen.add(user.id); result.push({ user, depth });
      holders.filter(child => child.superiorId === user.id).forEach(child => visit(child, depth + 1));
    };
    const root = holders.find(user => user.role === 'DIRECTOR_MARKETING');
    if (root) visit(root, 0);
    holders.filter(user => !seen.has(user.id)).forEach(user => visit(user, 0));
    return result;
  }, [holders]);
  const markChanged = () => { setDirty(true); setReview(null); setAcknowledged(false); };
  const updateAmount = (kind: TargetKind, month: number, value: string) => {
    setDraft(previous => {
      const current = previous[selectedId]; if (!current) return previous;
      const next = [...current[kind]]; next[month] = value;
      return { ...previous, [selectedId]: { ...current, [kind]: next } };
    });
    setConfirmed(previous => previous.filter(id => id !== selectedId)); markChanged();
  };
  const updateBaseline = (kind: TargetKind, value: string) => {
    setBaseline(previous => ({ ...previous, [kind]: value })); markChanged();
  };
  const changeYear = (value: number) => {
    if (value === year || busy) return;
    if (dirty && !window.confirm('Perubahan yang belum dipublish akan dibuang. Ganti tahun?')) return;
    setYear(value);
  };
  const validate = () => {
    setReview(null); setMessage(''); setAcknowledged(false);
    try {
      if (!loaded) throw new Error('Data target belum selesai dimuat.');
      const result = validateTargetSetup(users, draft, year, baseline, confirmed);
      setReview(result); setMessage(`Validasi berhasil: ${result.entries.length} pemilik target, cascading NB/RN tepat. Belum dipublish.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Validasi gagal.'); }
  };
  const publish = async () => {
    if (!authorized || busy || !loaded || !review || !acknowledged) return;
    setBusy(true); setMessage('');
    let committed = false;
    try {
      const currentActor = store.getCurrentUser();
      if (currentActor.id !== 'USR-000024' || currentActor.role !== 'TEAM_LEADER_MARKETING_SUPPORT') throw new Error('Otoritas publisher berubah. Login ulang.');
      const latestUsers = store.getUsers();
      if (directorySignature(latestUsers) !== sourceDirectory) throw new Error('User Master berubah. Muat ulang dan validasi kembali.');
      const latest = await listCentralTargets(year);
      if (snapshot(latest) !== sourceSnapshot) throw new Error('Target resmi berubah sejak dimuat. Muat ulang sebelum publish agar tidak menimpa perubahan lain.');
      const checked = validateTargetSetup(latestUsers, draft, year, baseline, confirmed);
      if (JSON.stringify(checked.entries) !== JSON.stringify(review.entries)) throw new Error('Alokasi berubah setelah validasi. Jalankan validasi ulang.');
      if (!window.confirm(`Publish target resmi ${year}?\n\nNB: ${formatRupiah(checked.director.annualTargetNewBusiness)}\nRN: ${formatRupiah(checked.director.annualTargetRenewal)}\nTotal: ${formatRupiah(checked.total)}\n\nSeluruh snapshot target tahun ini akan diganti secara atomik. Snapshot sebelumnya tetap tersedia dalam riwayat batch. Lanjutkan?`)) return;
      const now = new Date().toISOString();
      const batch: TargetUploadBatch = { id: '', year, filename: `On-screen Target ${year}`, uploadedBy: currentActor.name, uploadedAt: now, recordCount: checked.entries.length, status: 'Published', notes: `Input on-screen. ${batchNotes}`.trim() };
      const response = await publishCentralTargetBatch(batch, checked.entries.map(entry => ({ ...entry, publishedAt: now, publishedBy: currentActor.name })));
      committed = true;
      await refreshCentralTargetRuntime();
      await loadYear(year);
      setMessage(`Target ${year} berhasil dipublish. Batch resmi: ${response.batchId}. ${response.recordCount} pemilik target.`);
    } catch (error) {
      setReview(null); setAcknowledged(false);
      setMessage(`${committed ? 'Publish sudah diterima server, tetapi pembaruan tampilan gagal. Muat ulang data resmi; jangan publish ulang. ' : ''}${error instanceof Error ? error.message : 'Publish gagal.'}`);
    } finally { setBusy(false); }
  };

  if (loading) return <Card><CardContent className="p-8 text-sm text-slate-500">Memverifikasi otoritas publisher...</CardContent></Card>;
  if (!authorized) return <Card><CardContent className="p-6 text-sm text-amber-800">Setup target hanya tersedia untuk akun publisher resmi Arianie.</CardContent></Card>;

  const personalNB = allocation ? sum(allocation.NB.map(value => amount(value) || 0)) : 0;
  const personalRN = allocation ? sum(allocation.RN.map(value => amount(value) || 0)) : 0;
  const expectedNB = amount(baseline.NB);
  const expectedRN = amount(baseline.RN);
  const expectedTotal = expectedNB !== null && expectedRN !== null ? expectedNB + expectedRN : null;
  const diffNB = calculated.result?.differences.NB;
  const diffRN = calculated.result?.differences.RN;

  return <div className="space-y-5">
    <Card>
      <CardHeader><CardTitle>Setup Target RKAP – Input On-screen</CardTitle><CardDescription>Isi target pribadi per bulan, kemudian sistem menghitung cascading dari struktur User Master. Data resmi yang sudah ada dimuat terlebih dahulu; tidak ada penghapusan atau publish otomatis.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-xs font-semibold">Tahun RKAP<select className="block h-10 rounded-md border border-slate-300 bg-white px-3" value={year} onChange={event => changeYear(Number(event.target.value))} disabled={busy}><option value={2026}>2026</option><option value={2027}>2027</option></select></label>
          <Button variant="outline" disabled={busy} onClick={() => { if (!dirty || window.confirm('Buang perubahan yang belum dipublish dan muat ulang data resmi?')) void loadYear(year); }}><RefreshCw className="mr-2 h-4 w-4"/>Muat ulang data resmi</Button>
          <Badge variant="outline">{dirty ? 'Draft belum dipublish' : 'Data resmi / draft awal'}</Badge>
        </div>
        {message && <div role="status" className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{message}</div>}
        {!loaded ? <p className="text-sm text-slate-500">Memuat target dan User Master...</p> : <>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border p-4 space-y-2"><p className="text-xs font-semibold text-slate-500">Target Direktorat NB</p><Input aria-label="Target Direktorat NB" inputMode="numeric" value={baseline.NB} onChange={event => updateBaseline('NB', event.target.value)} placeholder="Isi rupiah tanpa desimal"/><p className="text-xs text-slate-500">Cascading: {money(calculated.result?.director.annualTargetNewBusiness ?? null)}</p></div>
            <div className="rounded-lg border p-4 space-y-2"><p className="text-xs font-semibold text-slate-500">Target Direktorat RN</p><Input aria-label="Target Direktorat RN" inputMode="numeric" value={baseline.RN} onChange={event => updateBaseline('RN', event.target.value)} placeholder="Isi rupiah tanpa desimal"/><p className="text-xs text-slate-500">Cascading: {money(calculated.result?.director.annualTargetRenewal ?? null)}</p></div>
            <div className="rounded-lg border bg-slate-50 p-4 space-y-2"><p className="text-xs font-semibold text-slate-500">Total RKAP Direktorat</p><p className="text-xl font-bold">{money(expectedTotal)}</p><p className="text-xs">Selisih NB: {diffNB === undefined ? '—' : formatRupiah(diffNB)}<br/>Selisih RN: {diffRN === undefined ? '—' : formatRupiah(diffRN)}</p></div>
          </div>
          <div className="grid gap-4 lg:grid-cols-[290px_minmax(0,1fr)]">
            <div className="rounded-lg border p-3 space-y-2"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Struktur Marketing</h3><Badge variant="outline">{confirmed.length}/{holders.length}</Badge></div><p className="text-xs text-slate-500">Pilih pemilik target. Angka pada atasan mencakup target pribadi dan seluruh bawahan.</p><div className="max-h-[560px] overflow-y-auto space-y-1">{ordered.map(({ user, depth }) => { const entry = entryById.get(user.id); return <button type="button" key={user.id} onClick={() => setSelectedId(user.id)} className={`w-full rounded-md border p-2 text-left text-xs ${selectedId === user.id ? 'border-blue-400 bg-blue-50' : 'border-transparent hover:bg-slate-50'}`}><div className="flex items-start justify-between gap-2" style={{ paddingLeft: Math.min(depth, 5) * 10 }}><span className="min-w-0"><strong className="block truncate">{user.name}</strong><span className="text-slate-500">{user.position}</span></span>{confirmed.includes(user.id) && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-600"/>}</div><div className="mt-1 text-[11px] text-slate-500" style={{ paddingLeft: Math.min(depth, 5) * 10 }}>{entry ? formatRupiah(entry.annualTargetTotal) : '—'}</div></button>; })}</div></div>
            <div className="min-w-0 rounded-lg border p-4 space-y-4">{selected && allocation && <>
              <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold">{selected.name}</h3><p className="text-xs text-slate-500">{selected.position} • {selected.unit} • {selected.department} • {selected.id}</p></div><Badge variant="outline">{confirmed.includes(selected.id) ? 'Alokasi dikonfirmasi' : 'Perlu konfirmasi'}</Badge></div>
              <div className="grid gap-2 sm:grid-cols-3"><div className="rounded-md bg-slate-50 p-3 text-xs">Pribadi NB<strong className="mt-1 block text-sm">{formatRupiah(personalNB)}</strong></div><div className="rounded-md bg-slate-50 p-3 text-xs">Pribadi RN<strong className="mt-1 block text-sm">{formatRupiah(personalRN)}</strong></div><div className="rounded-md bg-slate-50 p-3 text-xs">Total pribadi<strong className="mt-1 block text-sm">{formatRupiah(personalNB + personalRN)}</strong></div></div>
              <div className="overflow-x-auto"><table className="w-full min-w-[460px] text-sm"><thead><tr className="border-b text-left"><th className="p-2">Bulan</th><th className="p-2">New Business (Rp)</th><th className="p-2">Renewal (Rp)</th></tr></thead><tbody>{TARGET_MONTHS.map((month, index) => <tr key={month} className="border-b"><td className="p-2 text-xs">{month}</td>{(['NB', 'RN'] as const).map(kind => <td className="p-1" key={kind}><Input aria-label={`${selected.name} ${month} ${kind}`} inputMode="numeric" className="min-w-[150px] text-right" value={allocation[kind][index]} onChange={event => updateAmount(kind, index, event.target.value)}/></td>)}</tr>)}</tbody><tfoot><tr className="font-semibold"><td className="p-2">Tahunan</td><td className="p-2 text-right">{formatRupiah(personalNB)}</td><td className="p-2 text-right">{formatRupiah(personalRN)}</td></tr></tfoot></table></div>
              <div className="space-y-1"><label className="text-xs font-semibold" htmlFor="target-personal-notes">Catatan alokasi pribadi</label><Textarea id="target-personal-notes" value={allocation.notes} onChange={event => { setDraft(previous => ({ ...previous, [selectedId]: { ...previous[selectedId], notes: event.target.value } })); markChanged(); }} placeholder="Opsional"/></div>
              <label className="flex items-start gap-2 text-xs leading-relaxed"><Checkbox checked={confirmed.includes(selected.id)} onCheckedChange={checked => { setConfirmed(previous => checked ? [...new Set([...previous, selected.id])] : previous.filter(id => id !== selected.id)); markChanged(); }} className="mt-0.5"/><span>Saya sudah memeriksa seluruh 12 bulan NB/RN untuk {selected.name}, termasuk nilai nol yang memang ditetapkan nol.</span></label>
              {children(selected.id).length > 0 && <div className="rounded-md bg-blue-50 p-3 text-xs text-blue-900">Target tahunan atasan dihitung otomatis dari target pribadi ditambah seluruh bawahan. Tidak perlu menginput ulang target bawahan pada baris atasan.</div>}
            </>}</div>
          </div>
          <Card className="border-slate-200"><CardHeader><CardTitle className="text-base">Preview Cascading</CardTitle><CardDescription>Perhitungan read-only sebelum publikasi. Selisih harus nol untuk NB dan RN secara terpisah.</CardDescription></CardHeader><CardContent className="space-y-3">{calculated.error && <p className="text-sm text-red-700">{calculated.error}</p>}<div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-b text-left"><th className="p-2">Pemilik / Jabatan</th><th className="p-2 text-right">Pribadi NB</th><th className="p-2 text-right">Pribadi RN</th><th className="p-2 text-right">Cascading NB</th><th className="p-2 text-right">Cascading RN</th><th className="p-2 text-right">Total Tahunan</th></tr></thead><tbody>{ordered.map(({ user, depth }) => { const entry = entryById.get(user.id); return <tr key={user.id} className="border-b"><td className="p-2" style={{ paddingLeft: 8 + Math.min(depth, 5) * 12 }}><strong>{user.name}</strong><br/><span className="text-slate-500">{user.position}</span></td>{[entry?.personalTargetNewBusiness,entry?.personalTargetRenewal,entry?.annualTargetNewBusiness,entry?.annualTargetRenewal,entry?.annualTargetTotal].map((value,index) => <td key={index} className="p-2 text-right whitespace-nowrap">{value === undefined ? '—' : formatRupiah(value)}</td>)}</tr>; })}</tbody></table></div><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500">{confirmed.length} dari {holders.length} pemilik target sudah dikonfirmasi.</p><Button onClick={validate} disabled={busy || !loaded}><ShieldCheck className="mr-2 h-4 w-4"/>Validasi Cascading</Button></div></CardContent></Card>
          {review && <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-3"><div className="flex items-center gap-2 text-sm font-semibold text-green-900"><CheckCircle2 className="h-4 w-4"/>Validasi berhasil: {formatRupiah(review.total)}</div><p className="text-xs text-green-900">Publikasi mengganti snapshot resmi satu tahun penuh, bukan menambah target atau menghapus data tahun lain. Snapshot sebelumnya tetap dalam riwayat batch.</p><label className="text-xs font-semibold" htmlFor="target-batch-notes">Alasan / catatan publikasi</label><Textarea id="target-batch-notes" value={batchNotes} onChange={event => setBatchNotes(event.target.value)} placeholder="Contoh: Penetapan RKAP 2026 yang disetujui manajemen"/><label className="flex items-start gap-2 text-xs"><Checkbox checked={acknowledged} onCheckedChange={checked => setAcknowledged(checked === true)} className="mt-0.5"/><span>Saya memahami bahwa Publish akan mengganti seluruh target resmi tahun {year} dengan hasil validasi ini.</span></label><Button onClick={publish} disabled={busy || !acknowledged}><Save className="mr-2 h-4 w-4"/>{busy ? 'Memproses...' : 'Publish Target Resmi'}</Button></div>}
          <div className="flex items-start gap-2 text-xs text-slate-500"><AlertCircle className="h-4 w-4 shrink-0"/><p>Perubahan pada layar belum menjadi target resmi sampai Publish berhasil. Jangan menutup halaman sebelum menyelesaikan alokasi. Bila struktur User Master atau target resmi berubah, muat ulang untuk mencegah penimpaan.</p></div>
        </>}
      </CardContent>
    </Card>
  </div>;
};
export default TargetOnScreenSetup;
