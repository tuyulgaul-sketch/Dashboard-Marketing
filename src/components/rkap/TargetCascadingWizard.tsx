import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TargetEntry, TargetUploadBatch, User } from '@/types';
import { store } from '@/services/store';
import { listCentralTargets, publishCentralTargetBatch } from '@/services/targetService';
import { refreshCentralTargetRuntime } from '@/services/centralTargetRuntime';
import { useTargetRealizationPublisher } from '@/hooks/useTargetRealizationPublisher';
import { formatRupiah } from '@/utils/formatters';
import { parseExactTargetRupiah } from '@/utils/targetCompact';
import { targetSetupHolders, TARGET_MONTHS } from '@/utils/targetOnScreen';
import { buildWizardTree, buildSteps, seedWizard, continueWizard, acceptStep, validateWizard, normalizeAutomatic, availableFor, sumMonths, ZERO, blankMonths, type Amounts, type Months, type WizardState, type WizardTree, type WizardStep, type Phase } from '@/utils/targetCascadingWizard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ArrowLeft, ArrowRight, CheckCircle2, RefreshCw, Save, ShieldCheck, AlertCircle } from 'lucide-react';

const snapshot = (rows: TargetEntry[]) => JSON.stringify([...rows].sort((a, b) => a.userId.localeCompare(b.userId)));
const directorySignature = (users: User[]) => JSON.stringify(targetSetupHolders(users).map(user => [user.id, user.name, user.role, user.status, user.superiorId, user.unit, user.department, user.position]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Proses belum dapat diselesaikan.';
const money = (value: string | number | undefined) => { if (value === undefined || value === '') return '—'; try { return formatRupiah(parseExactTargetRupiah(value)); } catch { return 'Angka tidak valid'; } };
const amountInput = (label: string, value: string, onChange: (value: string) => void, disabled = false) => <label className="block min-w-0 space-y-1.5 text-xs font-semibold"><span>{label}</span><Input aria-label={label} inputMode="numeric" value={value} disabled={disabled} onChange={event => onChange(event.target.value)} placeholder="0" className="h-11 text-right font-medium" /></label>;
const AmountCards: React.FC<{ values: Amounts; label: string }> = ({ values, label }) => <div className="grid grid-cols-2 gap-3">{(['NB', 'RN'] as const).map(kind => <div key={kind} className="min-w-0 rounded-lg border bg-slate-50 p-3"><p className="text-[11px] text-slate-500">{label} {kind}</p><p className="mt-1 break-words text-sm font-bold">{money(values[kind])}</p></div>)}</div>;
const phaseLabel: Record<Phase, string> = { team: 'Target tim tahunan', teamMonths: 'Breakdown bulanan tim', personal: 'Target pribadi tahunan', personalMonths: 'Breakdown bulanan pribadi' };
const empty = (): WizardState => ({ allocations: {}, accepted: [] });
type Review = ReturnType<typeof validateWizard>;
type WizardForm = { key: string; annual: Amounts; monthly: Months };
type SavedDraft = { version: 2 | 3; year: number; actorId: string; sourceSnapshot: string; sourceDirectory: string; state: WizardState; savedAt: string; form?: WizardForm; modalOpen?: boolean; reviewMonth?: string; batchNotes?: string };
const storageKey = (id: string, year: number) => `pertalife:target-wizard:v3:${id}:${year}`;
const legacyStorageKey = (id: string, year: number) => `pertalife:target-wizard:v2:${id}:${year}`;
const validForm = (value: unknown): value is WizardForm => {
  if (!value || typeof value !== 'object') return false;
  const form = value as WizardForm;
  return typeof form.key === 'string' && ['NB', 'RN'].every(kind => {
    const k = kind as 'NB' | 'RN';
    return typeof form.annual?.[k] === 'string' && Array.isArray(form.monthly?.[k]) && form.monthly[k].length === 12 && form.monthly[k].every(item => typeof item === 'string');
  });
};
const stepKey = (step?: WizardStep) => step ? `${step.id}:${step.phase}` : 'review';
const isMonths = (phase: Phase) => phase.endsWith('Months');

const MonthlyEditor: React.FC<{ title: string; values: Months; annual: Amounts; onChange: (value: Months) => void }> = ({ title, values, annual, onChange }) => {
  const totals = useMemo(() => { try { return sumMonths(values); } catch { return null; } }, [values]);
  const set = (kind: 'NB' | 'RN', month: number, value: string) => onChange({ ...values, [kind]: values[kind].map((item, index) => index === month ? value : item) });
  const [fillError, setFillError] = useState('');
  const fillDecember = (kind: 'NB' | 'RN') => {
    try {
      const first = values[kind].slice(0, 11).map(value => parseExactTargetRupiah(value || '0'));
      const used = first.reduce((total, value) => total + value, 0);
      const remaining = parseExactTargetRupiah(annual[kind]) - used;
      if (!Number.isSafeInteger(used) || remaining < 0) throw new Error('Alokasi Januari–November sudah melebihi pagu.');
      set(kind, 11, String(remaining)); setFillError('');
    } catch (error) { setFillError(errorText(error)); }
  };
  return <div className="space-y-3"><AmountCards values={annual} label="Pagu tahunan"/><p className="text-xs text-slate-500">{title}. Isi nilai rupiah setiap bulan, termasuk nol. Tidak ada pembagian otomatis 1/12.</p><div className="max-h-[44vh] overflow-auto rounded-lg border"><table className="w-full min-w-[440px] text-sm"><thead className="sticky top-0 z-10 bg-slate-50"><tr><th className="p-2 text-left">Bulan</th><th className="p-2 text-right">NB (Rp)</th><th className="p-2 text-right">RN (Rp)</th></tr></thead><tbody>{TARGET_MONTHS.map((month, index) => <tr key={month} className="border-t"><td className="p-2 text-xs font-medium">{month}</td>{(['NB', 'RN'] as const).map(kind => <td key={kind} className="p-1"><Input aria-label={`${title} ${month} ${kind}`} inputMode="numeric" className="h-9 min-w-[150px] text-right" value={values[kind][index]} onChange={event => set(kind, index, event.target.value)}/></td>)}</tr>)}</tbody><tfoot className="sticky bottom-0 bg-slate-50 font-semibold"><tr className="border-t"><td className="p-2">Total 12 bulan</td><td className="p-2 text-right">{totals ? money(totals.NB) : 'Periksa angka'}</td><td className="p-2 text-right">{totals ? money(totals.RN) : 'Periksa angka'}</td></tr></tfoot></table></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => fillDecember('NB')}>Isi sisa NB di Desember</Button><Button size="sm" variant="outline" onClick={() => fillDecember('RN')}>Isi sisa RN di Desember</Button></div>{fillError && <p role="alert" className="text-xs text-red-700">{fillError}</p>}<p className="text-xs text-slate-500">Tombol sisa hanya mengisi Desember setelah diklik. Januari–November tidak diubah.</p></div>;
};

const TargetCascadingWizard: React.FC<{ publisherAuthorized: boolean }> = ({ publisherAuthorized }) => {
  const { canPublish, loading } = useTargetRealizationPublisher();
  const actor = store.getCurrentUser(); const actorId = actor.id;
  const authorized = publisherAuthorized && canPublish && !loading && actorId === 'USR-000024' && actor.role === 'TEAM_LEADER_MARKETING_SUPPORT';
  const [year, setYear] = useState(2026);
  const [users, setUsers] = useState<User[]>([]);
  const [official, setOfficial] = useState<TargetEntry[]>([]);
  const [sourceSnapshot, setSourceSnapshot] = useState(''); const [sourceDirectory, setSourceDirectory] = useState('');
  const [loaded, setLoaded] = useState(false); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const [draft, setDraft] = useState<WizardState>(empty); const [dirty, setDirty] = useState(false); const [modalOpen, setModalOpen] = useState(false);
  const [savedDraft, setSavedDraft] = useState<SavedDraft | null>(null);
  const [form, setForm] = useState<WizardForm>({ key: '', annual: ZERO, monthly: blankMonths() });
  const [review, setReview] = useState<Review | null>(null); const [acknowledged, setAcknowledged] = useState(false); const [batchNotes, setBatchNotes] = useState('');
  const [reviewMonth, setReviewMonth] = useState('annual');
  const treeResult = useMemo(() => { try { return { tree: users.length ? buildWizardTree(users) : null as WizardTree | null, error: '' }; } catch (error) { return { tree: null, error: errorText(error) }; } }, [users]);
  const tree = treeResult.tree;
  const steps = useMemo(() => tree ? buildSteps(tree) : [], [tree]);
  const progress = useMemo(() => { if (!tree || !loaded) return { state: draft, error: '' }; try { return { state: normalizeAutomatic(tree, draft, draft.accepted.length), error: '' }; } catch (error) { return { state: draft, error: errorText(error) }; } }, [tree, draft, loaded]);
  const index = progress.state.accepted.length; const step = steps[index]; const current = step && tree?.nodes[step.id];
  const allocation = step ? progress.state.allocations[step.id] : undefined;
  const formKey = stepKey(step); const field = step?.phase;
  const annual = form.key === formKey ? form.annual : allocation && field && !isMonths(field) ? allocation[field] as Amounts : ZERO;
  const monthly = form.key === formKey ? form.monthly : allocation && field && isMonths(field) ? allocation[field] as Months : blankMonths();
  const finished = loaded && !progress.error && index === steps.length && steps.length > 0;
  const clearForm = useCallback(() => setForm({ key: '', annual: ZERO, monthly: blankMonths() }), []);
  const markChanged = () => { setDirty(true); setReview(null); setAcknowledged(false); setMessage(''); };
  const updateForm = (value: WizardForm) => { setForm(value); markChanged(); };
  const draftKey = storageKey(actorId, year);
  const workspaceRef = useRef<{ key: string; saved: SavedDraft; shouldSave: boolean } | null>(null);
  workspaceRef.current = { key: draftKey, shouldSave: authorized && loaded && (dirty || modalOpen), saved: { version: 3, year, actorId, sourceSnapshot, sourceDirectory, state: draft, form, modalOpen, reviewMonth, batchNotes, savedAt: new Date().toISOString() } };
  const persist = useCallback((open?: boolean) => {
    const current = workspaceRef.current;
    if (!current?.shouldSave) return;
    try { window.sessionStorage.setItem(current.key, JSON.stringify({ ...current.saved, modalOpen: open ?? current.saved.modalOpen })); } catch { /* Keep the in-memory draft. */ }
  }, []);
  const clearStored = () => { try { window.sessionStorage.removeItem(draftKey); window.sessionStorage.removeItem(legacyStorageKey(actorId, year)); } catch { /* Optional local draft only. */ } };
  const loadYear = useCallback(async (selectedYear: number) => {
    setBusy(true); setLoaded(false); setModalOpen(false); setReview(null); setAcknowledged(false); setMessage(''); setSavedDraft(null);
    try {
      await refreshCentralTargetRuntime();
      const directory = store.getUsers(); const current = await listCentralTargets(selectedYear); const nextTree = buildWizardTree(directory);
      const seeded = seedWizard(nextTree, current); const source = snapshot(current); const signature = directorySignature(directory);
      let stored: SavedDraft | null = null;
      try {
        const raw = window.sessionStorage.getItem(storageKey(actorId, selectedYear)) || window.sessionStorage.getItem(legacyStorageKey(actorId, selectedYear));
        if (raw) {
          const candidate = JSON.parse(raw) as SavedDraft;
          if ((candidate.version === 2 || candidate.version === 3) && candidate.actorId === actorId && candidate.year === selectedYear && candidate.sourceSnapshot === source && candidate.sourceDirectory === signature && candidate.state && Array.isArray(candidate.state.accepted)) {
            const expected = buildSteps(nextTree);
            if (candidate.state.accepted.length <= expected.length && candidate.state.accepted.every((key, i) => key === stepKey(expected[i]))) {
              const restored = normalizeAutomatic(nextTree, candidate.state, candidate.state.accepted.length);
              // Recheck every previously accepted step against the current hierarchy.
              for (let i = 0; i < candidate.state.accepted.length; i++) {
                const checked = acceptStep(nextTree, { ...restored, accepted: expected.slice(0, i).map(stepKey) }, i);
                if (checked.accepted.length !== i + 1) throw new Error('Draft tidak valid.');
              }
              stored = { ...candidate, state: restored };
            }
          }
        }
      } catch { /* Ignore malformed or inaccessible session drafts. */ }
      setUsers(directory); setOfficial(current); setSourceSnapshot(source); setSourceDirectory(signature);
      if (stored?.version === 3) {
        setDraft(stored.state); setDirty(true); setSavedDraft(null);
        setForm(validForm(stored.form) && (!stored.form.key || buildSteps(nextTree)[stored.state.accepted.length] && stored.form.key === stepKey(buildSteps(nextTree)[stored.state.accepted.length])) ? stored.form : { key: '', annual: ZERO, monthly: blankMonths() });
        setReviewMonth(stored.reviewMonth === 'annual' || (typeof stored.reviewMonth === 'string' && /^(?:[0-9]|1[01])$/.test(stored.reviewMonth)) ? stored.reviewMonth : 'annual');
        setBatchNotes(stored.batchNotes || '');
        setModalOpen(stored.modalOpen === true);
      } else {
        setDraft(seeded); setDirty(false); setSavedDraft(stored); setBatchNotes(''); clearForm(); setModalOpen(false);
      }
      setLoaded(true);
      setMessage(stored?.version === 3 ? 'Draft dan posisi terakhir dipulihkan. Validasi Publish harus dijalankan kembali.' : stored ? 'Draft sebelumnya ditemukan. Lanjutkan atau mulai ulang dari data resmi.' : current.length ? `Memuat ${current.length} target resmi ${selectedYear}. Angka existing tidak berubah sampai Publish.` : 'Belum ada target resmi. Klik Mulai Setup Target untuk membuka wizard.');
    } catch (error) { setMessage(errorText(error)); } finally { setBusy(false); }
  }, [actorId, clearForm]);
  useEffect(() => { if (authorized) void loadYear(year); }, [authorized, year, loadYear]);
  useEffect(() => { persist(); }, [persist, authorized, loaded, dirty, year, actorId, sourceSnapshot, sourceDirectory, draft, form, modalOpen, reviewMonth, batchNotes]);
  useEffect(() => {
    const save = () => persist();
    window.addEventListener('pagehide', save);
    const visibility = () => { if (document.visibilityState === 'hidden') persist(); };
    document.addEventListener('visibilitychange', visibility);
    return () => { window.removeEventListener('pagehide', save); document.removeEventListener('visibilitychange', visibility); };
  }, [persist]);
  const resume = () => { if (!savedDraft || !tree) return; try { const restored = continueWizard(tree, savedDraft.state); setDraft(restored); setDirty(true); setSavedDraft(null); setModalOpen(true); if (validForm(savedDraft.form)) setForm(savedDraft.form); else clearForm(); } catch (error) { setMessage(errorText(error)); } };
  const start = () => { setSavedDraft(null); setModalOpen(true); persist(true); };
  const changeYear = (value: number) => { if (value === year || busy) return; if (dirty && !window.confirm('Draft tetap tersimpan di sesi browser. Ganti tahun?')) return; persist(); setYear(value); };
  const next = () => {
    if (!tree || !step || busy || progress.error) return;
    try {
      const nextState = structuredClone(draft); const field = step.phase; const value = isMonths(field) ? monthly : annual;
      nextState.allocations[step.id][field] = value as never;
      const accepted = continueWizard(tree, acceptStep(tree, nextState, index));
      setDraft(accepted); clearForm(); markChanged();
    } catch (error) { setMessage(errorText(error)); }
  };
  const goTo = (target: number) => {
    if (!tree || target < 0 || target >= steps.length || steps[target].automatic || target > index) return;
    const nextState = structuredClone(draft); if (step && form.key === formKey) nextState.allocations[step.id][step.phase] = (isMonths(step.phase) ? monthly : annual) as never; nextState.accepted = nextState.accepted.slice(0, target); setDraft(nextState); clearForm(); markChanged(); setModalOpen(true);
  };
  const back = () => { for (let i = index - 1; i >= 0; i--) if (!steps[i].automatic) { goTo(i); return; } };
  const editNode = (id: string): void => { const first = steps.findIndex(step => step.id === id && !step.automatic); if (first >= 0) goTo(first); else { const parent = tree?.nodes[id]?.user.superiorId; if (parent) editNode(parent); } };
  const validate = () => {
    if (!tree || !finished || busy) return;
    try { const checked = validateWizard(tree, draft, year); setReview(checked); setAcknowledged(false); setModalOpen(false); setMessage(`Validasi berhasil: ${checked.entries.length} pemilik target, seluruh NB/RN tahunan dan 12 bulan balance. Belum dipublish.`); }
    catch (error) { setMessage(errorText(error)); }
  };
  const publish = async () => {
    if (!authorized || busy || !loaded || !review || !acknowledged || !tree) return;
    setBusy(true); setMessage(''); let committed = false;
    try {
      const currentActor = store.getCurrentUser(); if (currentActor.id !== 'USR-000024' || currentActor.role !== 'TEAM_LEADER_MARKETING_SUPPORT') throw new Error('Otoritas publisher berubah. Login ulang.');
      const latestUsers = store.getUsers(); if (directorySignature(latestUsers) !== sourceDirectory) throw new Error('User Master berubah. Muat ulang dan validasi kembali.');
      const latest = await listCentralTargets(year); if (snapshot(latest) !== sourceSnapshot) throw new Error('Target resmi berubah sejak dimuat. Muat ulang sebelum publish agar tidak menimpa perubahan lain.');
      const checked = validateWizard(buildWizardTree(latestUsers), draft, year);
      if (JSON.stringify(checked.entries) !== JSON.stringify(review.entries)) throw new Error('Alokasi berubah setelah validasi. Jalankan validasi ulang.');
      if (!window.confirm(`Publish target resmi ${year}?\n\nNB: ${formatRupiah(checked.director.annualTargetNewBusiness)}\nRN: ${formatRupiah(checked.director.annualTargetRenewal)}\nTotal: ${formatRupiah(checked.total)}\n\nSeluruh snapshot tahun ini akan diganti secara atomik. Snapshot sebelumnya tetap dalam riwayat batch. Lanjutkan?`)) return;
      const now = new Date().toISOString(); const batch: TargetUploadBatch = { id: '', year, filename: `Wizard Target ${year}`, uploadedBy: currentActor.name, uploadedAt: now, recordCount: checked.entries.length, status: 'Published', notes: `Wizard tahunan dan bulanan. ${batchNotes}`.trim() };
      const response = await publishCentralTargetBatch(batch, checked.entries.map(entry => ({ ...entry, publishedAt: now, publishedBy: currentActor.name })));
      committed = true; setReview(null); setAcknowledged(false); setDirty(false); clearStored();
      await refreshCentralTargetRuntime(); await loadYear(year); setModalOpen(false);
      setMessage(`Target ${year} berhasil dipublish. Batch resmi: ${response.batchId}. ${response.recordCount} pemilik target.`);
    } catch (error) { setReview(null); setAcknowledged(false); setMessage(`${committed ? 'Publish sudah diterima server, tetapi pembaruan tampilan gagal. Muat ulang data resmi; jangan publish ulang. ' : ''}${errorText(error)}`); } finally { setBusy(false); }
  };
  if (loading) return <Card><CardContent className="p-8 text-sm text-slate-500">Memverifikasi otoritas publisher...</CardContent></Card>;
  if (!authorized) return <Card><CardContent className="p-6 text-sm text-amber-800">Setup target hanya tersedia untuk akun publisher resmi Arianie.</CardContent></Card>;
  const available = step && tree ? availableFor(tree, progress.state, step) : undefined;
  const annualAvailable = step && !isMonths(step.phase) && available ? available as Amounts : undefined;
  const monthlyAvailable = step && isMonths(step.phase) && available ? available as Months : undefined;
  const personalAvailable = step && step.phase === 'personal' ? allocation?.team : step && step.phase === 'personalMonths' ? allocation?.teamMonths : undefined;
  const capacity = annualAvailable || (monthlyAvailable ? sumMonths(monthlyAvailable) : undefined) || (personalAvailable && step && isMonths(step.phase) ? sumMonths(personalAvailable as Months) : personalAvailable as Amounts | undefined);
  return <div className="space-y-5">
    <Card><CardHeader><CardTitle>Setup Target RKAP – Wizard Cascading</CardTitle><CardDescription>Satu alur untuk target tahunan, target pribadi, dan breakdown Januari–Desember. NB dan RN divalidasi terpisah pada setiap level.</CardDescription></CardHeader><CardContent className="space-y-4">
      <div className="flex flex-wrap items-end gap-3"><label className="space-y-1 text-xs font-semibold">Tahun RKAP<select className="block h-10 rounded-md border border-slate-300 bg-white px-3" value={year} onChange={event => changeYear(Number(event.target.value))} disabled={busy}><option value={2026}>2026</option><option value={2027}>2027</option></select></label><Button variant="outline" disabled={busy} onClick={() => { if (!dirty || window.confirm('Muat ulang data resmi? Draft sesi akan tetap tersedia sampai diganti.')) void loadYear(year); }}><RefreshCw className="mr-2 h-4 w-4"/>Muat ulang</Button><Badge variant="outline">{dirty ? 'Draft belum dipublish' : 'Data resmi / draft awal'}</Badge></div>
      {message && <div role="status" className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{message}</div>}
      {treeResult.error && <p className="text-sm text-red-700">{treeResult.error}</p>}
      {savedDraft && <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-2"><p className="font-semibold text-sm">Draft sesi sebelumnya tersedia</p><p className="text-xs">Data resmi belum berubah. Draft hanya dapat dipakai jika versi target dan User Master masih sama.</p><div className="flex flex-wrap gap-2"><Button onClick={resume}>Lanjutkan Draft</Button><Button variant="outline" onClick={() => { if (window.confirm('Mulai ulang dari target resmi? Draft sesi sebelumnya akan diganti.')) { clearStored(); setDraft(seedWizard(tree!, official)); clearForm(); setReview(null); setAcknowledged(false); setDirty(false); setSavedDraft(null); setModalOpen(true); } }}>Mulai Ulang</Button></div></div>}
      {loaded && tree && !savedDraft && <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-slate-50 p-4"><div><p className="font-semibold text-sm">{finished ? 'Seluruh langkah selesai' : `Langkah ${index + 1} dari ${steps.length}`}</p><p className="text-xs text-slate-500">{tree.order.length} pemilik target aktif • Direktorat, Captive, CRM, dan Advisor</p></div><Button onClick={start}>{finished ? 'Buka Review Wizard' : dirty ? 'Lanjutkan Wizard' : official.length ? 'Revisi dengan Wizard' : 'Mulai Setup Target'}</Button></div>}
      {review && <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-3"><div className="flex items-center gap-2 text-sm font-semibold text-green-900"><CheckCircle2 className="h-4 w-4"/>Validasi tahunan dan bulanan berhasil</div><p className="text-xs text-green-900">Publikasi mengganti snapshot resmi satu tahun penuh. Data existing tidak diubah sebelum konfirmasi Publish. Riwayat batch sebelumnya tetap tersedia.</p><AmountCards values={{ NB: String(review.director.annualTargetNewBusiness), RN: String(review.director.annualTargetRenewal) }} label="Direktorat tahunan"/><label className="block space-y-1 text-xs font-semibold">Alasan / catatan publikasi<Textarea value={batchNotes} onChange={event => setBatchNotes(event.target.value)} placeholder="Contoh: Penetapan RKAP 2027 yang disetujui manajemen"/></label><label className="flex items-start gap-2 text-xs"><Checkbox checked={acknowledged} onCheckedChange={checked => setAcknowledged(checked === true)} className="mt-0.5"/><span>Saya memahami Publish akan mengganti seluruh target resmi tahun {year} dengan alokasi NB/RN tahunan dan bulanan yang telah divalidasi.</span></label><Button onClick={publish} disabled={busy || !acknowledged}><Save className="mr-2 h-4 w-4"/>{busy ? 'Memproses...' : 'Publish Target Resmi'}</Button></div>}
      {loaded && tree && <div className="flex items-start gap-2 text-xs text-slate-500"><AlertCircle className="h-4 w-4 shrink-0"/><p>Target resmi hanya berubah setelah Publish berhasil. Tidak ada pembagian otomatis rata-rata bulanan. Perubahan pagu mengharuskan validasi ulang seluruh alokasi terdampak.</p></div>}
    </CardContent></Card>
    <Dialog open={modalOpen && loaded && Boolean(tree)} onOpenChange={open => { if (!busy) setModalOpen(open); }}><DialogContent className="flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0"><DialogHeader className="shrink-0 border-b p-5 pr-12"><DialogTitle>{finished ? 'Review Seluruh Cascading' : step && current ? `${phaseLabel[step.phase]} — ${current.user.name}` : 'Setup Target'}</DialogTitle><DialogDescription>{finished ? 'Periksa target tim dan pribadi tahunan serta 12 bulan sebelum validasi.' : current ? `${current.user.position} • ${current.user.id} • ${current.user.unit} • ${current.user.department}` : 'Memuat struktur target...'}</DialogDescription><div className="pt-3"><div className="flex items-center justify-between text-xs text-slate-500"><span>{finished ? 'Seluruh langkah selesai' : `Langkah ${index + 1} dari ${steps.length}`}</span><span>{steps.length ? Math.round(index / steps.length * 100) : 0}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-blue-600 transition-all" style={{ width: `${steps.length ? index / steps.length * 100 : 0}%` }}/></div></div></DialogHeader>
      <div className="min-h-0 flex-1 overflow-y-auto p-5 space-y-4">{progress.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{progress.error}</p>}{message && <p role="status" className="rounded-lg border bg-slate-50 p-3 text-sm">{message}</p>}
        {!finished && step && allocation && <><div className="text-xs text-slate-500">{step.parent ? `${tree!.nodes[step.parent].user.name} → ` : ''}{current?.user.name}{step.lastChild && <span className="ml-2 text-green-700">Member terakhir: sisa tim otomatis</span>}</div>{capacity && <AmountCards values={capacity} label="Pagu tersedia"/>}{isMonths(step.phase) ? <MonthlyEditor key={formKey} title={phaseLabel[step.phase]} values={monthly} annual={step.phase === 'teamMonths' ? allocation.team : allocation.personal} onChange={value => updateForm({ key: formKey, annual, monthly: value })}/> : <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2">{amountInput(`${phaseLabel[step.phase]} NB`, annual.NB, value => updateForm({ key: formKey, annual: { ...annual, NB: value }, monthly }))}{amountInput(`${phaseLabel[step.phase]} RN`, annual.RN, value => updateForm({ key: formKey, annual: { ...annual, RN: value }, monthly }))}</div><div className="rounded-lg border bg-slate-50 p-3 text-xs text-slate-600">{step.phase === 'team' ? 'Target tim adalah pagu yang mencakup target pribadi dan seluruh bawahan, bukan target tambahan.' : 'Target pribadi mengurangi jatah cascading ke bawahan. Isi nol jika tidak memiliki target pribadi.'}</div></div>}{step.phase === 'personalMonths' && <label className="block space-y-1 text-xs font-semibold">Catatan alokasi (opsional)<Textarea value={allocation.notes} onChange={event => { setDraft(previous => ({ ...previous, allocations: { ...previous.allocations, [step.id]: { ...previous.allocations[step.id], notes: event.target.value } } })); markChanged(); }}/></label>}</>}
        {finished && tree && <div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-2"><AmountCards values={progress.state.allocations[tree.root].team} label="Direktorat tahunan"/><label className="text-xs font-semibold">Tampilan<select className="ml-2 h-9 rounded-md border bg-white px-2" value={reviewMonth} onChange={event => setReviewMonth(event.target.value)}><option value="annual">Tahunan</option>{TARGET_MONTHS.map((month, i) => <option key={month} value={String(i)}>{month}</option>)}</select></label></div><div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[700px] text-xs"><thead className="bg-slate-50"><tr><th className="p-2 text-left">Pemilik / Jabatan</th><th className="p-2 text-right">Tim NB</th><th className="p-2 text-right">Tim RN</th><th className="p-2 text-right">Pribadi NB</th><th className="p-2 text-right">Pribadi RN</th><th className="p-2">Aksi</th></tr></thead><tbody>{tree.order.map(id => { const node = tree.nodes[id]; const a = progress.state.allocations[id]; const month = reviewMonth === 'annual' ? null : Number(reviewMonth); const team = month === null ? a.team : { NB: a.teamMonths.NB[month], RN: a.teamMonths.RN[month] }; const personal = month === null ? a.personal : { NB: a.personalMonths.NB[month], RN: a.personalMonths.RN[month] }; return <tr key={id} className="border-t"><td className="p-2" style={{ paddingLeft: 8 + Math.min(node.depth, 5) * 12 }}><strong>{node.user.name}</strong><br/><span className="text-slate-500">{node.user.position}</span></td>{[team.NB,team.RN,personal.NB,personal.RN].map((value,i)=><td key={i} className="p-2 text-right whitespace-nowrap">{money(value)}</td>)}<td className="p-2"><Button size="sm" variant="ghost" onClick={() => editNode(id)}>Ubah</Button></td></tr>; })}</tbody></table></div><p className="text-xs text-slate-500">Target tim mencakup pribadi dan bawahan. Total Direktorat tidak menjumlahkan ulang seluruh baris tim.</p></div>}
      </div><DialogFooter className="shrink-0 flex-row flex-wrap items-center justify-between gap-2 border-t bg-white p-4"><div className="flex items-center gap-2"><Button variant="outline" disabled={busy || index === 0} onClick={back}><ArrowLeft className="mr-1 h-4 w-4"/>Kembali</Button><Button variant="ghost" disabled={busy} onClick={() => { persist(false); setModalOpen(false); }}>Simpan Draft & Tutup</Button></div>{finished ? <Button disabled={busy || Boolean(progress.error)} onClick={validate}><ShieldCheck className="mr-2 h-4 w-4"/>Validasi Semua Target</Button> : <Button disabled={busy || Boolean(progress.error)} onClick={next}>Lanjut<ArrowRight className="ml-1 h-4 w-4"/></Button>}</DialogFooter></DialogContent></Dialog>
  </div>;
};
export default TargetCascadingWizard;
