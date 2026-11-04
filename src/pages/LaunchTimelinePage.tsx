import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronRight, Clock3, FileText, Loader2, Plus, RefreshCw, Search, UploadCloud } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Team = "DA" | "MARCOMM";
type Status = "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";
type Task = {
  id: string; code: string; title: string; workstream: string; detail: string | null;
  deliverable: string | null; supporting_pic: string | null; owner_team: Team;
  start_date: string; due_date: string; status: Status; notes: string | null;
  evidence_required: boolean; is_milestone: boolean;
};
type Evidence = { id: string; task_id: string; storage_path: string; file_name: string; file_size: number; created_at: string };
type Draft = { owner_team: Team; start_date: string; due_date: string; status: Status; notes: string };
const teamLabel: Record<Team, string> = { DA: "Digital & Affinity", MARCOMM: "Marcomm / Corcomm" };
const statusLabel: Record<Status, string> = { TODO: "Belum dimulai", IN_PROGRESS: "Sedang dikerjakan", BLOCKED: "Terkendala", DONE: "Selesai" };
const statusStyle: Record<Status, string> = {
  TODO: "bg-slate-100 text-slate-700", IN_PROGRESS: "bg-blue-100 text-blue-800",
  BLOCKED: "bg-amber-100 text-amber-800", DONE: "bg-emerald-100 text-emerald-800",
};
const bucket = "launch-timeline-evidence";
const dateValue = (s: string) => new Date(s + "T12:00:00+07:00").getTime();
const days = (a: string, b: string) => Math.round((dateValue(a) - dateValue(b)) / 86400000);
const todayString = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const showDate = (s: string) => new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short" }).format(new Date(s + "T12:00:00+07:00"));
const late = (t: Task, today: string) => t.status !== "DONE" && t.due_date < today;
const urgent = (t: Task, today: string) => t.status !== "DONE" && t.due_date >= today && days(t.due_date, today) <= 3;
const draftTask = (t: Task): Draft => ({ owner_team: t.owner_team, start_date: t.start_date, due_date: t.due_date, status: t.status, notes: t.notes || "" });
const selectClass = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm";
const labelClass = "mb-1 block text-xs font-semibold text-slate-600";

export default function LaunchTimelinePage() {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const myTeam: Team = profile?.department?.trim().toLowerCase() === "marketing communication" ? "MARCOMM" : "DA";
  const [tasks, setTasks] = useState<Task[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [teamFilter, setTeamFilter] = useState<"MINE" | "ALL" | Team>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "LATE" | "DONE">("ALL");
  const [view, setView] = useState<"LIST" | "GANTT">("LIST");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get("task"));
  const [draft, setDraft] = useState<Draft | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newOutput, setNewOutput] = useState("");
  const [newTeam, setNewTeam] = useState<Team>(myTeam);
  const [newStart, setNewStart] = useState("2026-11-04");
  const [newDue, setNewDue] = useState("2026-11-20");
  const today = todayString();

  const refresh = useCallback(async () => {
    try {
      const [t, e] = await Promise.all([
        supabase.from("launch_timeline_tasks").select("*").order("start_date").order("code"),
        supabase.from("launch_timeline_evidence").select("id,task_id,storage_path,file_name,file_size,created_at").order("created_at", { ascending: false }),
      ]);
      if (t.error) throw t.error;
      if (e.error) throw e.error;
      setTasks((t.data || []) as Task[]);
      setEvidence((e.data || []) as Evidence[]);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Timeline tidak bisa dibuka.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void refresh();
    // Bell + email reminders are deduplicated server-side per deadline and recipient.
    void supabase.rpc("launch_timeline_due_reminders").then(({ error: reminderError }) => {
      if (reminderError) console.warn("Pengingat belum dapat diproses", reminderError);
    });
  }, [refresh]);

  const selected = tasks.find(t => t.id === selectedId) || null;
  const taskEvidence = (id: string) => evidence.filter(e => e.task_id === id);
  const openTask = (t: Task) => {
    setSelectedId(t.id);
    setDraft(draftTask(t));
    setSearchParams({ task: t.id });
  };
  const closeTask = () => { setSelectedId(null); setDraft(null); setSearchParams({}); };
  useEffect(() => {
    const id = searchParams.get("task");
    if (id && tasks.length && (!draft || selectedId !== id)) {
      const t = tasks.find(x => x.id === id);
      if (t) { setSelectedId(id); setDraft(draftTask(t)); }
    }
  }, [searchParams, tasks, selectedId, draft]);

  const filtered = useMemo(() => tasks.filter(t => {
    if (teamFilter === "MINE" && t.owner_team !== myTeam) return false;
    if ((teamFilter === "DA" || teamFilter === "MARCOMM") && t.owner_team !== teamFilter) return false;
    if (statusFilter === "PENDING" && t.status === "DONE") return false;
    if (statusFilter === "DONE" && t.status !== "DONE") return false;
    if (statusFilter === "LATE" && !late(t, today)) return false;
    const q = query.trim().toLowerCase();
    return !q || [t.title, t.workstream, t.deliverable, t.supporting_pic].some(x => (x || "").toLowerCase().includes(q));
  }), [tasks, teamFilter, myTeam, statusFilter, query, today]);

  const completed = tasks.filter(t => t.status === "DONE").length;
  const overdue = tasks.filter(t => late(t, today)).length;
  const upcoming = tasks.filter(t => urgent(t, today)).length;
  // All progress figures are computed from the complete task set, never filtered.
  const progress = tasks.length ? Math.round(completed / tasks.length * 100) : 0;
  const teamProgress = (team: Team) => {
    const teamTasks = tasks.filter(t => t.owner_team === team);
    const done = teamTasks.filter(t => t.status === "DONE").length;
    return {
      total: teamTasks.length,
      done,
      pct: teamTasks.length ? Math.round(done / teamTasks.length * 100) : 0,
    };
  };
  const milestones = tasks.filter(t => t.is_milestone).sort((a, b) => a.due_date.localeCompare(b.due_date));
  const minStart = tasks.length ? tasks.reduce((v, t) => t.start_date < v ? t.start_date : v, tasks[0].start_date) : "2026-11-02";
  const maxEnd = tasks.length ? tasks.reduce((v, t) => t.due_date > v ? t.due_date : v, tasks[0].due_date) : "2026-12-12";
  const span = Math.max(1, days(maxEnd, minStart) + 1);
  const leftPercent = (s: string) => Math.max(0, 100 * days(s, minStart) / span);
  const widthPercent = (a: string, b: string) => Math.max(1, Math.min(100 - leftPercent(a), 100 * (days(b, a) + 1) / span));
  const axis = Array.from({ length: Math.ceil(span / 7) }, (_, i) => {
    const v = new Date(dateValue(minStart) + i * 7 * 86400000);
    return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" }).format(v);
  });

  const save = async () => {
    if (!selected || !draft) return;
    if (!draft.start_date || !draft.due_date || draft.start_date > draft.due_date) return toast.error("Periksa kembali tanggal mulai dan deadline.");
    setBusy(true);
    try {
      const { error: saveError } = await supabase.from("launch_timeline_tasks").update({
        owner_team: draft.owner_team, status: draft.status, start_date: draft.start_date,
        due_date: draft.due_date, notes: draft.notes.trim() || null,
      }).eq("id", selected.id).select("id").single();
      if (saveError) throw saveError;
      await refresh(); closeTask(); toast.success("Status dan penanggung jawab tersimpan.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal menyimpan."); }
    finally { setBusy(false); }
  };

  const addEvidence = async (file: File, t: Task) => {
    if (!profile) return;
    if (!file.size || file.size > 50 * 1024 * 1024) return toast.error("Ukuran berkas maksimal 50 MB.");
    setBusy(true);
    try {
      const fileName = file.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
      const path = t.id + "/" + crypto.randomUUID() + "-" + fileName;
      const upload = await supabase.storage.from(bucket).upload(path, file, { upsert: false, contentType: file.type || "application/octet-stream" });
      if (upload.error) throw upload.error;
      const { error: insertError } = await supabase.from("launch_timeline_evidence").insert({
        task_id: t.id, storage_path: path, file_name: file.name,
        mime_type: file.type || null, file_size: file.size, uploaded_by: profile.id,
      });
      if (insertError) throw insertError;
      await refresh();
      toast.success("Evidence berhasil diunggah. Jika tugas tuntas, ubah status ke Selesai.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Evidence gagal diunggah."); }
    finally { setBusy(false); }
  };

  const viewEvidence = async (e: Evidence) => {
    const { data, error: fileError } = await supabase.storage.from(bucket).createSignedUrl(e.storage_path, 60);
    if (fileError || !data?.signedUrl) return toast.error("Berkas tidak bisa dibuka.");
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const addTask = async () => {
    if (!newTitle.trim() || !newStart || !newDue || newStart > newDue) return toast.error("Isi nama dan tanggal tugas dengan benar.");
    setBusy(true);
    try {
      const { error: addError } = await supabase.from("launch_timeline_tasks").insert({
        code: "CUSTOM-" + crypto.randomUUID(), title: newTitle.trim(),
        workstream: "Tambahan", deliverable: newOutput.trim() || null,
        owner_team: newTeam, start_date: newStart, due_date: newDue,
        status: "TODO", evidence_required: true, is_milestone: false,
      });
      if (addError) throw addError;
      setNewTitle(""); setNewOutput(""); setCreateOpen(false);
      await refresh(); toast.success("Pekerjaan tambahan berhasil dibuat.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Tugas tidak dapat ditambahkan."); }
    finally { setBusy(false); }
  };

  return <AppLayout><div className="space-y-5 pb-12">
    <section className="rounded-2xl bg-gradient-to-r from-blue-950 to-blue-700 p-6 text-white">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-widest text-blue-200">Workspace DA × Marcomm</p>
          <h1 className="mt-2 text-2xl font-black sm:text-3xl">Kesiapan MyPertaLife & HUT Pertamina</h1>
          <p className="mt-2 max-w-2xl text-sm text-blue-100">Lihat apa yang perlu disiapkan, kapan batas waktunya, siapa yang bertugas, dan evidence penyelesaiannya.</p>
        </div>
        <Button variant="secondary" onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" />Tambah tugas</Button>
      </div>
      <div className="mt-6 rounded-xl border border-white/20 bg-white/10 p-4 sm:p-5" aria-live="polite">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-blue-100">Overall Progress • seluruh pekerjaan</p>
            <p className="mt-1 text-sm text-blue-100">Total gabungan Digital &amp; Affinity dan Marcomm, tidak berubah karena filter.</p>
          </div>
          <strong className="text-4xl font-black tabular-nums sm:text-5xl">{loading ? "—" : progress + "%"}</strong>
        </div>
        <div className="mt-4 h-4 overflow-hidden rounded-full bg-white/20" role="progressbar" aria-label="Persentase seluruh task yang selesai" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: progress + "%" }} />
        </div>
        <div className="mt-2 flex flex-wrap justify-between gap-2 text-sm">
          <span className="font-semibold">{loading ? "Memuat data..." : completed + " dari " + tasks.length + " pekerjaan selesai"}</span>
          <span className="text-blue-100">Dihitung dari tugas berstatus Selesai (Done)</span>
        </div>
      </div>
    </section>

    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}
      <Button className="ml-2" variant="outline" size="sm" onClick={() => void refresh()}>Coba lagi</Button></div>}
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[
      { label: "Total pekerjaan", n: tasks.length, icon: CalendarDays, color: "text-blue-600" },
      { label: "Selesai", n: completed, icon: CheckCircle2, color: "text-emerald-600" },
      { label: "Deadline ≤ 3 hari", n: upcoming, icon: Clock3, color: "text-amber-600" },
      { label: "Terlambat", n: overdue, icon: AlertTriangle, color: "text-red-600" },
    ].map(x => <Card key={x.label}><CardContent className="flex items-center justify-between p-4">
      <div><p className="text-xs text-slate-500">{x.label}</p><p className="mt-1 text-3xl font-black text-slate-900">{x.n}</p></div>
      <x.icon className={"h-6 w-6 " + x.color} />
    </CardContent></Card>)}</div>

    <Card><CardContent className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold text-slate-900">Progress per tim</h2>
        <span className="text-xs text-slate-500">Bagian dari 47 pekerjaan bersama • selalu menampilkan seluruh data</span>
      </div>
      <div className="mt-4 grid gap-5 md:grid-cols-2">
        {(["DA", "MARCOMM"] as Team[]).map(team => {
          const stats = teamProgress(team);
          return <div key={team} className="rounded-xl bg-slate-50 p-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-bold text-slate-800">{teamLabel[team]}</span>
              <strong className="text-2xl font-black tabular-nums text-slate-900">{stats.pct}%</strong>
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200">
              <div className={"h-full rounded-full transition-all " + (team === "DA" ? "bg-blue-600" : "bg-emerald-600")} style={{ width: stats.pct + "%" }} />
            </div>
            <p className="mt-2 text-xs text-slate-600">{stats.done} dari {stats.total} pekerjaan tim selesai</p>
          </div>;
        })}
      </div>
    </CardContent></Card>

    {overdue > 0 && <button onClick={() => { setTeamFilter("ALL"); setStatusFilter("LATE"); }}
      className="flex w-full items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-left text-sm text-red-800">
      <AlertTriangle className="h-5 w-5 shrink-0" /><span><strong>{overdue} pekerjaan belum Done dan melewati deadline.</strong> Klik untuk melihat tugas yang perlu ditindaklanjuti.</span><ChevronRight className="ml-auto h-4 w-4" />
    </button>}

    <Card><CardContent className="p-5"><h2 className="text-base font-bold">Tiga momen penting</h2>
      <p className="mt-1 text-xs text-slate-500">Target perencanaan, bukan konfirmasi resmi bahwa aplikasi sudah go-live.</p>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {milestones.map((t, i) => <button key={t.id} onClick={() => openTask(t)} className="flex items-start gap-3 rounded-xl border bg-slate-50 p-4 text-left hover:border-blue-400 hover:bg-blue-50">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-900 text-white">{i + 1}</span>
          <span><span className="text-xs font-bold text-blue-700">{showDate(t.due_date)}</span><span className="mt-1 block text-sm font-semibold">{t.title}</span>
            <span className="mt-2 block text-xs text-slate-500">{statusLabel[t.status]}</span></span>
        </button>)}
      </div>
    </CardContent></Card>

    <Card><CardContent className="p-5"><h2 className="text-base font-bold">Cara menggunakan</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-4">{["1. Pilih pekerjaan", "2. Lihat hasil yang harus disiapkan", "3. Upload bukti pekerjaan", "4. Tandai Selesai"].map(x =>
        <div key={x} className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{x}</div>)}</div>
    </CardContent></Card>

    <div className="flex flex-wrap items-center gap-2">
      <h2 className="mr-auto text-lg font-black">Daftar pekerjaan</h2>
      <Button size="sm" variant="outline" onClick={() => void refresh()}><RefreshCw className="mr-1.5 h-4 w-4" />Refresh</Button>
      <Button size="sm" variant={view === "LIST" ? "default" : "outline"} onClick={() => setView("LIST")}>Daftar mudah</Button>
      <Button size="sm" variant={view === "GANTT" ? "default" : "outline"} onClick={() => setView("GANTT")}>Timeline durasi</Button>
    </div>
    <div className="grid gap-2 rounded-xl border bg-white p-3 sm:grid-cols-3">
      <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <Input className="pl-9" value={query} onChange={e => setQuery(e.target.value)} placeholder="Cari pekerjaan..." /></div>
      <select className={selectClass} aria-label="Filter tim" value={teamFilter} onChange={e => setTeamFilter(e.target.value as typeof teamFilter)}>
        <option value="MINE">Tugas tim saya</option><option value="ALL">Semua tim</option><option value="DA">Digital & Affinity</option><option value="MARCOMM">Marcomm / Corcomm</option>
      </select>
      <select className={selectClass} aria-label="Filter status" value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}>
        <option value="ALL">Semua status</option><option value="PENDING">Belum selesai</option><option value="LATE">Terlambat</option><option value="DONE">Selesai</option>
      </select>
    </div>

    {loading ? <div className="flex justify-center gap-2 p-12 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />Memuat timeline...</div> :
      filtered.length === 0 ? <div className="rounded-xl border bg-white p-10 text-center text-sm text-slate-500">Belum ada pekerjaan sesuai filter.</div> :
      view === "LIST" ? <div className="space-y-3">
        {filtered.map(t => <button key={t.id} onClick={() => openTask(t)} className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-blue-400 hover:shadow-sm">
          <div className="flex flex-wrap items-start gap-3"><div className="min-w-0 flex-1">
            <div className="text-xs text-slate-500">{t.workstream} • {teamLabel[t.owner_team]}</div>
            <h3 className="mt-1 text-sm font-bold sm:text-base">{t.title}</h3>
            <p className="mt-1 text-sm text-slate-600">{t.deliverable || "Buka detail untuk melihat output."}</p>
          </div><span className={"whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold " + statusStyle[t.status]}>{statusLabel[t.status]}</span></div>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-600">
            <span className="flex items-center gap-1"><CalendarDays className="h-4 w-4" />{showDate(t.start_date)} – {showDate(t.due_date)}</span>
            <span className="flex items-center gap-1"><FileText className="h-4 w-4" />{taskEvidence(t.id).length} evidence</span>
            {late(t, today) && <strong className="text-red-600">Terlambat {days(today, t.due_date)} hari</strong>}
            {urgent(t, today) && <strong className="text-amber-700">Segera jatuh tempo</strong>}
            <span className="ml-auto font-semibold text-blue-700">Lihat / update <ChevronRight className="inline h-4 w-4" /></span>
          </div>
        </button>)}
      </div> : <div className="overflow-x-auto rounded-xl border bg-white">
        <div className="min-w-[940px]"><div className="flex border-b bg-slate-50 text-xs font-bold text-slate-600">
          <div className="w-[330px] shrink-0 p-3">Pekerjaan (klik untuk detail)</div>
          <div className="flex flex-1 justify-between p-3">{axis.map((x, i) => <span key={i}>{x}</span>)}</div>
        </div>
        {filtered.map(t => <button key={t.id} onClick={() => openTask(t)} className="flex w-full items-center border-b border-slate-100 text-left hover:bg-blue-50">
          <div className="w-[330px] shrink-0 p-3"><p className="truncate text-xs font-semibold" title={t.title}>{t.title}</p><p className="mt-1 text-[11px] text-slate-500">{showDate(t.start_date)} – {showDate(t.due_date)}</p></div>
          <div className="relative h-12 flex-1 bg-[repeating-linear-gradient(to_right,transparent_0%,transparent_calc(100%/6_-_1px),#e2e8f0_calc(100%/6_-_1px),#e2e8f0_calc(100%/6))]">
            <div className={"absolute top-4 h-4 rounded-full " + (t.status === "DONE" ? "bg-emerald-400" : t.owner_team === "DA" ? "bg-blue-600" : "bg-emerald-600")}
              title={showDate(t.start_date) + " – " + showDate(t.due_date)}
              style={{ left: leftPercent(t.start_date) + "%", width: widthPercent(t.start_date, t.due_date) + "%" }} />
          </div>
        </button>)}
        <div className="flex flex-wrap gap-4 p-3 text-xs text-slate-500"><span>🔵 Digital & Affinity</span><span>🟢 Marcomm</span><span>Bar menunjukkan tanggal mulai s.d. deadline</span></div></div>
      </div>}

    <p className="text-xs text-slate-500">Panduan Kado HUT terlampir masih merujuk periode sebelumnya. Corcomm perlu memastikan kategori, batas waktu, spesifikasi, dan portal pengiriman HUT 2026 kepada Intercomm Pertamina.</p>

    <Dialog open={Boolean(selected)} onOpenChange={open => { if (!open) closeTask(); }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        {selected && draft && <>
          <DialogHeader><DialogTitle className="pr-5">{selected.title}</DialogTitle><DialogDescription>Periksa target, upload evidence, lalu ubah status pekerjaan.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-blue-50 p-4 text-sm text-slate-800"><p className="text-xs font-bold uppercase text-blue-700">Hasil yang harus disiapkan</p>
              <p className="mt-1">{selected.deliverable || selected.detail || "Belum ditentukan."}</p>
              {selected.supporting_pic && <p className="mt-2 text-xs text-slate-500">Pihak yang terlibat: {selected.supporting_pic}</p>}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label><span className={labelClass}>Tim penanggung jawab (bisa dipindahkan)</span>
                <select className={selectClass} value={draft.owner_team} onChange={e => setDraft({ ...draft, owner_team: e.target.value as Team })}>
                  <option value="DA">Digital & Affinity</option><option value="MARCOMM">Marcomm / Corcomm</option>
                </select></label>
              <label><span className={labelClass}>Status pekerjaan</span>
                <select className={selectClass} value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as Status })}>
                  {(Object.keys(statusLabel) as Status[]).map(k => <option key={k} value={k}>{statusLabel[k]}</option>)}
                </select></label>
              <label><span className={labelClass}>Tanggal mulai</span><Input type="date" value={draft.start_date} onChange={e => setDraft({ ...draft, start_date: e.target.value })} /></label>
              <label><span className={labelClass}>Deadline</span><Input type="date" value={draft.due_date} onChange={e => setDraft({ ...draft, due_date: e.target.value })} /></label>
            </div>
            <label className="block"><span className={labelClass}>Catatan / hasil diskusi perubahan PIC</span>
              <Textarea rows={3} value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} placeholder="Mis. Sesuai meeting, tim DA mengambil alih materi demo..." /></label>
            <div className="rounded-xl border border-slate-200 p-4">
              <h3 className="flex items-center gap-2 text-sm font-bold"><UploadCloud className="h-5 w-5 text-blue-700" />Evidence / bukti penyelesaian</h3>
              <p className="mt-1 text-xs text-slate-500">Dokumen, screenshot, spreadsheet, atau video. Maks. 50 MB per berkas. Evidence hanya dapat diakses akun DA dan Marcomm.</p>
              <label className="mt-3 block cursor-pointer rounded-lg border border-dashed border-blue-300 bg-blue-50 p-3 text-center text-sm font-semibold text-blue-700">
                {busy ? "Memproses..." : "+ Pilih file evidence untuk diunggah"}
                <input disabled={busy} type="file" className="sr-only"
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.mp4,.txt"
                  onChange={e => { const f = e.target.files?.[0]; if (f) void addEvidence(f, selected); e.target.value = ""; }} />
              </label>
              <div className="mt-3 space-y-2">{taskEvidence(selected.id).map(e => <button key={e.id} onClick={() => void viewEvidence(e)}
                className="flex w-full items-center gap-2 rounded-lg border border-slate-200 p-2 text-left text-xs text-blue-700 hover:bg-blue-50">
                <FileText className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1 truncate">{e.file_name}</span><span>{(e.file_size / 1024 / 1024).toFixed(1)} MB</span>
              </button>)}
                {!taskEvidence(selected.id).length && <p className="text-xs text-amber-700">Belum ada evidence terunggah.</p>}
              </div>
            </div>
            {draft.status === "DONE" && selected.evidence_required && !taskEvidence(selected.id).length &&
              <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Untuk menyelesaikan tugas ini, unggah minimal satu evidence terlebih dahulu.</p>}
          </div>
          <DialogFooter><Button variant="outline" disabled={busy} onClick={closeTask}>Batal</Button>
            <Button disabled={busy || (draft.status === "DONE" && selected.evidence_required && !taskEvidence(selected.id).length)} onClick={() => void save()}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Simpan perubahan
            </Button></DialogFooter>
        </>}
      </DialogContent>
    </Dialog>

    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
      <DialogContent><DialogHeader><DialogTitle>Tambah pekerjaan</DialogTitle><DialogDescription>Tugas baru otomatis masuk daftar dan memerlukan evidence sebelum selesai.</DialogDescription></DialogHeader>
        <div className="space-y-3"><label className="block"><span className={labelClass}>Nama pekerjaan</span><Input value={newTitle} onChange={e => setNewTitle(e.target.value)} /></label>
          <label className="block"><span className={labelClass}>Hasil yang harus disiapkan</span><Textarea value={newOutput} onChange={e => setNewOutput(e.target.value)} /></label>
          <label className="block"><span className={labelClass}>Tim</span><select className={selectClass} value={newTeam} onChange={e => setNewTeam(e.target.value as Team)}>
            <option value="DA">Digital & Affinity</option><option value="MARCOMM">Marcomm / Corcomm</option></select></label>
          <div className="grid grid-cols-2 gap-3"><label><span className={labelClass}>Mulai</span><Input type="date" value={newStart} onChange={e => setNewStart(e.target.value)} /></label>
            <label><span className={labelClass}>Deadline</span><Input type="date" value={newDue} onChange={e => setNewDue(e.target.value)} /></label></div>
        </div><DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Batal</Button>
          <Button disabled={busy} onClick={() => void addTask()}>Tambah pekerjaan</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div></AppLayout>;
}