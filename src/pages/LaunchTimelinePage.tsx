import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronRight, FileText, Loader2, Plus, RefreshCw, Search, Trash2, UploadCloud } from "lucide-react";
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
type Group = { id: string; group_code: string; title: string; description: string | null; sort_order: number };
type Task = { id: string; group_id: string; code: string; title: string; owner_team: Team; start_date: string; due_date: string; status: Status; deliverable: string | null; notes: string | null; evidence_required: boolean; is_milestone: boolean };
type Evidence = { id: string; task_id: string; storage_path: string; file_name: string; file_size: number };
type ItemDraft = { title: string; owner_team: Team; start_date: string; due_date: string; status: Status; deliverable: string; notes: string };
type GroupDraft = { title: string; description: string };
type GroupStats = Group & { subtasks: Task[]; count: number; completed: number; daCount: number; marcommCount: number; progress: number; start: string | null; end: string | null; late: number };
const teamName: Record<Team, string> = { DA: "Digital & Affinity", MARCOMM: "Marketing Communication" };
const statusName: Record<Status, string> = { TODO: "Belum mulai", IN_PROGRESS: "Dikerjakan", BLOCKED: "Terkendala", DONE: "Selesai" };
const statusColor: Record<Status, string> = { TODO: "bg-slate-100 text-slate-600", IN_PROGRESS: "bg-blue-50 text-blue-700", BLOCKED: "bg-amber-50 text-amber-700", DONE: "bg-emerald-50 text-emerald-800" };
const selectClass = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm";
const labelClass = "mb-1 block text-xs font-semibold text-slate-600";
const asDate = (x: string) => new Date(x + "T12:00:00+07:00").getTime();
const days = (a: string, b: string) => Math.round((asDate(a) - asDate(b)) / 86400000);
const formatDate = (s: string) => new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", year: "numeric" }).format(new Date(s + "T12:00:00+07:00"));
const todayJakarta = () => {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const v = (k: string) => p.find(x => x.type === k)?.value || "";
  return v("year") + "-" + v("month") + "-" + v("day");
};
const percent = (done: number, total: number) => total ? Math.round(done * 1000 / total) / 10 : 0;
const itemDraftFrom = (t: Task): ItemDraft => ({ title: t.title, owner_team: t.owner_team, start_date: t.start_date, due_date: t.due_date, status: t.status, deliverable: t.deliverable || "", notes: t.notes || "" });

export default function LaunchTimelinePage() {
  const { profile } = useAuth();
  const [params, setParams] = useSearchParams();
  const myTeam: Team = profile?.department?.trim().toLowerCase() === "marketing communication" ? "MARCOMM" : "DA";
  const today = todayJakarta();
  const [groups, setGroups] = useState<Group[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterTeam, setFilterTeam] = useState<"ALL" | Team>("ALL");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "PENDING" | "DONE" | "LATE">("ALL");
  const [search, setSearch] = useState("");
  const [activeGroupId, setActiveGroupId] = useState<string | null>(params.get("group"));
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [groupDraft, setGroupDraft] = useState<GroupDraft | null>(null);
  const [itemDraft, setItemDraft] = useState<ItemDraft | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deletingGroup, setDeletingGroup] = useState(false);
  const [deleteGroupMode, setDeleteGroupMode] = useState<"MOVE" | "ARCHIVE_ALL">("MOVE");
  const [deleteGroupTarget, setDeleteGroupTarget] = useState("");
  const [adding, setAdding] = useState(false);
  const [newItem, setNewItem] = useState({ title: "", deliverable: "", owner_team: myTeam, start_date: today, due_date: today });

  const refresh = useCallback(async () => {
    try {
      const [g, t, e] = await Promise.all([
        supabase.from("launch_timeline_groups").select("id,group_code,title,description,sort_order").is("deleted_at", null).order("sort_order"),
        supabase.from("launch_timeline_tasks").select("id,group_id,code,title,owner_team,start_date,due_date,status,deliverable,notes,evidence_required,is_milestone").is("deleted_at", null).order("start_date").order("code"),
        supabase.from("launch_timeline_evidence").select("id,task_id,storage_path,file_name,file_size"),
      ]);
      if (g.error) throw g.error;
      if (t.error) throw t.error;
      if (e.error) throw e.error;
      setGroups((g.data || []) as Group[]);
      setTasks((t.data || []) as Task[]);
      setEvidence((e.data || []) as Evidence[]);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Data timeline gagal dimuat.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void refresh();
    const onFocus = () => { void refresh(); };
    window.addEventListener("focus", onFocus);
    const interval = window.setInterval(() => void refresh(), 120000);
    return () => { window.removeEventListener("focus", onFocus); window.clearInterval(interval); };
  }, [refresh]);

  const statistics = useMemo<GroupStats[]>(() => groups.map(g => {
    const subtasks = tasks.filter(t => t.group_id === g.id);
    const completed = subtasks.filter(t => t.status === "DONE").length;
    const start = subtasks.length ? subtasks.reduce((v, t) => v < t.start_date ? v : t.start_date, subtasks[0].start_date) : null;
    const end = subtasks.length ? subtasks.reduce((v, t) => v > t.due_date ? v : t.due_date, subtasks[0].due_date) : null;
    return { ...g, subtasks, count: subtasks.length, completed,
      daCount: subtasks.filter(t => t.owner_team === "DA").length,
      marcommCount: subtasks.filter(t => t.owner_team === "MARCOMM").length,
      progress: percent(completed, subtasks.length),
      start, end, late: subtasks.filter(t => t.status !== "DONE" && t.due_date < today).length };
  }), [groups, tasks, today]);

  const visible = useMemo(() => statistics.filter(g => {
    if (filterTeam !== "ALL" && !g.subtasks.some(t => t.owner_team === filterTeam)) return false;
    if (filterStatus === "DONE" && !(g.count > 0 && g.completed === g.count)) return false;
    if (filterStatus === "PENDING" && g.count > 0 && g.completed === g.count) return false;
    if (filterStatus === "LATE" && !g.late) return false;
    const q = search.trim().toLowerCase();
    return !q || (g.title + " " + (g.description || "")).toLowerCase().includes(q)
      || g.subtasks.some(t => (t.title + " " + (t.deliverable || "")).toLowerCase().includes(q));
  }), [statistics, filterTeam, filterStatus, search]);

  const done = tasks.filter(t => t.status === "DONE").length;
  const overall = percent(done, tasks.length);
  const totalLate = tasks.filter(t => t.status !== "DONE" && t.due_date < today).length;
  const teamSummary = (team: Team) => {
    const relevant = tasks.filter(t => t.owner_team === team);
    const completed = relevant.filter(t => t.status === "DONE").length;
    return { completed, count: relevant.length, percent: percent(completed, relevant.length) };
  };
  const activeGroup = statistics.find(g => g.id === activeGroupId) || null;
  const selectedItem = activeGroup?.subtasks.find(t => t.id === activeItemId) || null;
  const filesFor = (id: string) => evidence.filter(e => e.task_id === id);

  const openGroup = (g: GroupStats, item?: Task) => {
    setActiveGroupId(g.id);
    setGroupDraft({ title: g.title, description: g.description || "" });
    setActiveItemId(item?.id || null);
    setItemDraft(item ? itemDraftFrom(item) : null);
    setDeleteId(null);
    setDeletingGroup(false); setDeleteGroupMode("MOVE"); setDeleteGroupTarget("");
    setAdding(false);
    setParams(item ? { task: item.id } : { group: g.id });
  };
  const closeGroup = () => {
    setActiveGroupId(null); setActiveItemId(null); setGroupDraft(null); setItemDraft(null);
    setDeleteId(null); setDeletingGroup(false); setDeleteGroupTarget("");
    setAdding(false); setParams({});
  };
  useEffect(() => {
    if (activeGroupId || !groups.length) return;
    const requestedTask = params.get("task");
    const requestedGroup = params.get("group");
    const item = tasks.find(t => t.id === requestedTask);
    const group = statistics.find(g => g.id === (item?.group_id || requestedGroup));
    if (group) openGroup(group, item);
  }, [activeGroupId, groups, params, statistics, tasks]);

  const saveGroup = async () => {
    if (!activeGroup || !groupDraft || busy) return;
    const title = groupDraft.title.trim();
    if (!title || title.length > 160) return toast.error("Nama kelompok maksimal 160 karakter dan tidak boleh kosong.");
    setBusy(true);
    try {
      const { error: saveError } = await supabase.from("launch_timeline_groups").update({
        title, description: groupDraft.description.trim() || null,
      }).eq("id", activeGroup.id).select("id").single();
      if (saveError) throw saveError;
      await refresh(); toast.success("Kelompok diperbarui.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal menyimpan kelompok."); }
    finally { setBusy(false); }
  };
  const saveChecklist = async () => {
    if (!selectedItem || !itemDraft || busy) return;
    const title = itemDraft.title.trim();
    if (!title || title.length > 200) return toast.error("Nama checklist wajib diisi, maksimal 200 karakter.");
    if (!itemDraft.start_date || !itemDraft.due_date || itemDraft.start_date > itemDraft.due_date) return toast.error("Tanggal mulai tidak boleh melewati deadline.");
    if (itemDraft.status === "DONE" && selectedItem.evidence_required && filesFor(selectedItem.id).length === 0) return toast.error("Unggah evidence sebelum memilih Selesai.");
    setBusy(true);
    try {
      const { error: saveError } = await supabase.from("launch_timeline_tasks").update({
        title, status: itemDraft.status, owner_team: itemDraft.owner_team,
        start_date: itemDraft.start_date, due_date: itemDraft.due_date,
        deliverable: itemDraft.deliverable.trim() || null, notes: itemDraft.notes.trim() || null,
      }).eq("id", selectedItem.id).select("id").single();
      if (saveError) throw saveError;
      await refresh(); toast.success("Checklist disimpan; progress dan Gantt otomatis diperbarui.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal menyimpan checklist."); }
    finally { setBusy(false); }
  };
  const assignChecklist = async (t: Task, team: Team) => {
    if (busy || t.owner_team === team) return;
    setBusy(true);
    try {
      const { error: assignError } = await supabase.from("launch_timeline_tasks")
        .update({ owner_team: team }).eq("id", t.id).select("id").single();
      if (assignError) throw assignError;
      setItemDraft(current => activeItemId === t.id && current ? { ...current, owner_team: team } : current);
      await refresh();
      toast.success("PIC checklist diperbarui ke " + teamName[team] + ". Progress tim ikut menyesuaikan.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Gagal mengganti PIC checklist.");
    } finally { setBusy(false); }
  };

  const setChecked = async (t: Task) => {
    if (busy) return;
    const next = t.status === "DONE" ? "TODO" : "DONE";
    if (next === "DONE" && t.evidence_required && filesFor(t.id).length === 0) {
      setActiveItemId(t.id); setItemDraft(itemDraftFrom(t));
      return toast.error("Upload evidence pada checklist ini sebelum mencentang Selesai.");
    }
    setBusy(true);
    try {
      const { error: saveError } = await supabase.from("launch_timeline_tasks").update({ status: next }).eq("id", t.id).select("id").single();
      if (saveError) throw saveError;
      setItemDraft(current => activeItemId === t.id && current ? { ...current, status: next } : current);
      await refresh(); toast.success(next === "DONE" ? "Checklist selesai, progres diperbarui." : "Checklist dibuka kembali.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Status checklist gagal diubah."); }
    finally { setBusy(false); }
  };
  const uploadFile = async (t: Task, file: File) => {
    if (!profile || busy) return;
    if (!file.size || file.size > 50 * 1024 * 1024) return toast.error("Maksimal 50 MB per file.");
    setBusy(true);
    try {
      const path = t.id + "/" + crypto.randomUUID() + "-" + file.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
      const upload = await supabase.storage.from("launch-timeline-evidence").upload(path, file, { upsert: false, contentType: file.type || "application/octet-stream" });
      if (upload.error) throw upload.error;
      const { error: insertError } = await supabase.from("launch_timeline_evidence").insert({
        task_id: t.id, storage_path: path, file_name: file.name, mime_type: file.type || null,
        file_size: file.size, uploaded_by: profile.id,
      });
      if (insertError) throw insertError;
      await refresh(); toast.success("Evidence diunggah. Checklist sekarang bisa ditandai selesai.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal mengunggah evidence."); }
    finally { setBusy(false); }
  };
  const openFile = async (e: Evidence) => {
    const { data, error: fileError } = await supabase.storage.from("launch-timeline-evidence").createSignedUrl(e.storage_path, 60);
    if (fileError || !data?.signedUrl) return toast.error("Evidence tidak dapat dibuka.");
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };
  const deleteChecklist = async () => {
    if (!selectedItem || deleteId !== selectedItem.id || busy) return;
    setBusy(true);
    try {
      const { data, error: rpcError } = await supabase.rpc("archive_launch_timeline_task", { p_task_id: selectedItem.id });
      if (rpcError) throw rpcError;
      if (data !== true) throw new Error("Checklist tidak berhasil dihapus.");
      setActiveItemId(null); setItemDraft(null); setDeleteId(null);
      await refresh(); toast.success("Checklist dihapus dari progress dan Gantt; evidence disimpan untuk audit.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal menghapus checklist."); }
    finally { setBusy(false); }
  };
  const archiveGroup = async () => {
    if (!activeGroup || !deletingGroup || busy) return;
    if (groups.length <= 1) return toast.error("Kategori terakhir tidak dapat dihapus.");
    const action: "MOVE" | "ARCHIVE_ALL" = activeGroup.count === 0 ? "ARCHIVE_ALL" : deleteGroupMode;
    if (action === "MOVE" && (!deleteGroupTarget || deleteGroupTarget === activeGroup.id)) {
      return toast.error("Pilih kategori tujuan untuk memindahkan checklist.");
    }
    setBusy(true);
    try {
      const { data, error: archiveError } = await supabase.rpc("archive_launch_timeline_group", {
        p_group_id: activeGroup.id,
        p_action: action,
        p_target_group_id: action === "MOVE" ? deleteGroupTarget : null,
      });
      if (archiveError) throw archiveError;
      const result = data as { success?: boolean; affected_checklists?: number } | null;
      if (!result?.success) throw new Error("Kategori belum berhasil dihapus.");
      closeGroup();
      await refresh();
      toast.success(action === "MOVE"
        ? "Kategori dihapus; " + result.affected_checklists + " checklist dipindahkan, PIC dan evidence tetap."
        : "Kategori beserta checklist aktif diarsipkan. Overall progress dan Gantt diperbarui.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Kategori tidak dapat dihapus.");
    } finally { setBusy(false); }
  };

  const addChecklist = async () => {
    if (!activeGroup || busy) return;
    const title = newItem.title.trim();
    if (!title || title.length > 200) return toast.error("Nama checklist wajib diisi, maksimal 200 karakter.");
    if (!newItem.start_date || !newItem.due_date || newItem.start_date > newItem.due_date) return toast.error("Periksa kembali tanggal checklist.");
    setBusy(true);
    try {
      const { error: insertError } = await supabase.from("launch_timeline_tasks").insert({
        code: "CUSTOM-" + crypto.randomUUID(), group_id: activeGroup.id, title, workstream: "Checklist tambahan",
        deliverable: newItem.deliverable.trim() || null, owner_team: newItem.owner_team,
        start_date: newItem.start_date, due_date: newItem.due_date, status: "TODO",
        evidence_required: true, is_milestone: false,
      });
      if (insertError) throw insertError;
      setAdding(false); setNewItem(v => ({ ...v, title: "", deliverable: "" }));
      await refresh(); toast.success("Checklist ditambahkan ke kelompok.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal menambah checklist."); }
    finally { setBusy(false); }
  };

  const startDates = visible.flatMap(g => g.start ? [g.start] : []);
  const endDates = visible.flatMap(g => g.end ? [g.end] : []);
  const first = startDates.length ? startDates.reduce((a, b) => a < b ? a : b) : today;
  const last = endDates.length ? endDates.reduce((a, b) => a > b ? a : b) : today;
  const span = Math.max(1, days(last, first) + 1);
  const left = (d: string) => Math.max(0, Math.min(100, days(d, first) * 100 / span));
  const width = (a: string, b: string) => Math.max(0.9, Math.min(100 - left(a), (days(b, a) + 1) * 100 / span));
  const ticks = Array.from({ length: Math.ceil(span / 7) }, (_, i) => {
    const d = new Date(asDate(first) + i * 7 * 86400000);
    const year = d.getUTCFullYear(), month = String(d.getUTCMonth() + 1).padStart(2, "0"), day = String(d.getUTCDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  });
  return <AppLayout><div className="space-y-5 pb-12">
    <section className="rounded-2xl bg-gradient-to-r from-blue-950 to-blue-700 p-5 text-white sm:p-6">
      <p className="text-xs font-bold uppercase tracking-widest text-blue-200">Digital &amp; Affinity × Marketing Communication</p>
      <h1 className="mt-2 text-2xl font-black sm:text-3xl">Timeline MyPertaLife &amp; HUT Pertamina</h1>
      <p className="mt-2 text-sm text-blue-100">Kategori mengelompokkan pekerjaan; penanggung jawab DA/Marcomm ditentukan pada setiap checklist.</p>
      <div className="mt-5 rounded-xl border border-white/20 bg-white/10 p-4">
        <div className="flex items-end justify-between gap-4">
          <div><p className="text-xs font-bold uppercase text-blue-100">Overall Progress • seluruh checklist aktif</p>
            <p className="mt-1 text-sm text-blue-100">{done} dari {tasks.length} checklist selesai • tidak terpengaruh filter</p></div>
          <strong className="text-4xl font-black tabular-nums">{loading ? "—" : overall + "%"}</strong>
        </div>
        <div className="mt-3 h-4 overflow-hidden rounded-full bg-white/20" role="progressbar" aria-label="Overall progress"
          aria-valuenow={overall} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-emerald-400" style={{ width: overall + "%" }} />
        </div>
      </div>
    </section>
    {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}
      <Button variant="outline" size="sm" onClick={() => void refresh()} className="ml-2">Muat ulang</Button></div>}
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Kelompok pekerjaan</p><p className="mt-1 text-3xl font-black">{groups.length}</p></CardContent></Card>
      <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Checklist selesai</p><p className="mt-1 text-3xl font-black text-emerald-700">{done} <span className="text-lg text-slate-400">/ {tasks.length}</span></p></CardContent></Card>
      <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Checklist terlambat</p><p className="mt-1 text-3xl font-black text-red-700">{totalLate}</p></CardContent></Card>
    </div>
    <Card><CardContent className="p-4">
      <h2 className="font-bold">Progress per tim</h2>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        {(["DA", "MARCOMM"] as Team[]).map(team => {
          const stats = teamSummary(team);
          return <div key={team} className="rounded-xl bg-slate-50 p-3">
            <div className="flex justify-between gap-2 text-sm"><strong>{teamName[team]}</strong><strong>{stats.percent}%</strong></div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-200">
              <div className={"h-full rounded-full " + (team === "DA" ? "bg-blue-600" : "bg-emerald-600")} style={{ width: stats.percent + "%" }} />
            </div>
            <p className="mt-2 text-xs text-slate-500">{stats.completed} dari {stats.count} checklist selesai</p>
          </div>;
        })}
      </div>
    </CardContent></Card>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-lg font-black">{groups.length} Kategori Pekerjaan</h2>
        <p className="text-xs text-slate-500">Klik kategori untuk mengelola checklist. Filter tim menampilkan kategori yang memuat checklist tim tersebut, tanpa mengubah persentase kategori.</p></div>
      <Button size="sm" variant="outline" onClick={() => void refresh()}><RefreshCw className="mr-2 h-4 w-4"/>Refresh</Button>
    </div>
    <div className="grid gap-2 rounded-xl border bg-white p-3 sm:grid-cols-3">
      <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/>
        <Input className="pl-9" placeholder="Cari kelompok atau checklist" value={search} onChange={e => setSearch(e.target.value)}/></div>
      <select className={selectClass} aria-label="Filter tim" value={filterTeam} onChange={e => setFilterTeam(e.target.value as "ALL" | Team)}>
        <option value="ALL">Semua tim</option><option value="DA">Digital &amp; Affinity</option><option value="MARCOMM">Marketing Communication</option></select>
      <select className={selectClass} aria-label="Filter progres" value={filterStatus} onChange={e => setFilterStatus(e.target.value as typeof filterStatus)}>
        <option value="ALL">Semua progres</option><option value="PENDING">Belum 100%</option>
        <option value="DONE">100% selesai</option><option value="LATE">Ada checklist terlambat</option></select>
    </div>
    {loading ? <p className="p-8 text-center text-sm text-slate-500"><Loader2 className="mr-2 inline h-5 w-5 animate-spin"/>Memuat pekerjaan...</p>
      : visible.length === 0 ? <p className="rounded-xl border bg-white p-8 text-center text-sm text-slate-500">Tidak ada kelompok sesuai filter.</p>
      : <div className="grid gap-3 md:grid-cols-2">{visible.map(g => (
        <button key={g.id} className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-400 hover:shadow-md" onClick={() => openGroup(g)}>
          <div className="flex items-start justify-between gap-3"><div className="min-w-0">
            <p className="text-xs font-bold text-blue-700">{g.group_code} • {g.daCount} DA · {g.marcommCount} Marcomm</p>
            <h3 className="mt-1 text-base font-black text-slate-900">{g.title}</h3>
            <p className="mt-1 text-xs text-slate-500">{g.description}</p>
          </div><ChevronRight className="h-5 w-5 shrink-0 text-slate-400"/></div>
          <div className="mt-4 flex items-baseline justify-between gap-2"><span className="text-xs font-semibold">{g.completed} / {g.count} checklist Done</span>
            <strong className="text-xl font-black tabular-nums">{g.progress}%</strong></div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-blue-600" style={{ width: g.progress + "%" }}/></div>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
            <span><CalendarDays className="mr-1 inline h-4 w-4"/>{g.start && g.end ? formatDate(g.start) + " – " + formatDate(g.end) : "Belum ada jadwal"}</span>
            {g.late > 0 && <span className="font-semibold text-red-700"><AlertTriangle className="mr-1 inline h-4 w-4"/>{g.late} terlambat</span>}
            {g.count > 0 && g.count === g.completed && <span className="text-emerald-700"><CheckCircle2 className="mr-1 inline h-4 w-4"/>Selesai</span>}
          </div>
        </button>
      ))}</div>}
    <section className="overflow-hidden rounded-xl border bg-white" aria-labelledby="gantt-heading">
      <div className="border-b bg-slate-50 p-4">
        <h2 id="gantt-heading" className="text-lg font-black">Gantt Chart • {groups.length} Kategori Pekerjaan</h2>
        <p className="mt-1 text-sm text-slate-600">Rentang bar berasal dari tanggal paling awal hingga deadline terakhir dalam checklist kelompok. Perubahan checklist otomatis memperbarui bar.</p>
        <div className="mt-3 flex gap-5 text-xs"><span>🔵 Rentang waktu kategori</span><span>Bagian terang: proporsi checklist selesai</span><span>Garis merah: hari ini</span></div>
      </div>
      {!loading && visible.length > 0 && <div className="overflow-x-auto" role="region" aria-label="Gantt Chart Kelompok" tabIndex={0}>
        <div className="min-w-[1030px]">
          <div className="flex border-b bg-slate-100 text-xs font-semibold text-slate-600">
            <div className="w-[360px] shrink-0 p-3">Kelompok pekerjaan</div>
            <div className="relative h-12 flex-1">{ticks.map(d => <span key={d} className="absolute top-3 whitespace-nowrap border-l border-slate-300 pl-1"
              style={{ left: left(d) + "%" }}>{formatDate(d).replace(" 2026", "")}</span>)}</div>
          </div>
          {visible.map(g => <button key={g.id} className="flex w-full items-stretch border-b border-slate-100 text-left hover:bg-blue-50" onClick={() => openGroup(g)}>
            <div className="w-[360px] shrink-0 p-3"><p className="truncate text-xs font-bold">{g.group_code} • {g.title}</p>
              <p className="mt-1 text-[11px] text-slate-500">{g.completed}/{g.count} checklist • {g.progress}%</p></div>
            <div className="relative h-14 flex-1">{ticks.map(d => <span key={d} className="pointer-events-none absolute inset-y-0 border-l border-slate-100" style={{ left: left(d) + "%" }}/>)}
              {today >= first && today <= last && <span className="pointer-events-none absolute inset-y-0 z-10 border-l-2 border-dashed border-red-500" style={{ left: left(today) + "%" }}/>}
              {g.start && g.end && <div className="absolute top-4 h-6 overflow-hidden rounded-md bg-blue-700 shadow-sm"
                title={g.title + ": " + formatDate(g.start) + " – " + formatDate(g.end)}
                style={{ left: left(g.start) + "%", width: width(g.start, g.end) + "%" }}>
                <div className="h-full bg-white/30" style={{ width: g.progress + "%" }}/></div>}
            </div>
          </button>)}
        </div>
      </div>}
    </section>
    <p className="text-xs text-slate-500">Baseline Kado HUT berasal dari panduan periode lama. Ketentuan dan deadline HUT Pertamina 2026 perlu dikonfirmasi dengan Intercomm.</p>
    <Dialog open={Boolean(activeGroup)} onOpenChange={open => { if (!open) closeGroup(); }}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        {activeGroup && <><DialogHeader>
          <DialogTitle>{activeGroup.group_code} • {activeGroup.title}</DialogTitle>
          <DialogDescription>Checklist detail, progress parsial, evidence per item, dan penugasan DA/Marcomm pada masing-masing checklist.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="rounded-xl bg-blue-50 p-4">
            <div className="flex items-center justify-between"><div><p className="text-sm font-bold text-blue-950">Progress kelompok</p>
              <p className="mt-1 text-xs text-blue-700">{activeGroup.completed} dari {activeGroup.count} checklist Done</p></div>
              <strong className="text-3xl font-black text-blue-900">{activeGroup.progress}%</strong></div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-blue-200"><div className="h-full rounded-full bg-blue-700" style={{ width: activeGroup.progress + "%" }}/></div>
          </div>
          <details className="rounded-xl border p-3"><summary className="cursor-pointer text-sm font-bold text-slate-700">Edit nama & deskripsi kategori</summary>
            {groupDraft && <div className="mt-3 space-y-3">
              <label className="block"><span className={labelClass}>Nama kelompok</span><Input maxLength={160} value={groupDraft.title} onChange={e => setGroupDraft({ ...groupDraft, title: e.target.value })}/></label>
              <label className="block"><span className={labelClass}>Deskripsi</span><Textarea value={groupDraft.description} onChange={e => setGroupDraft({ ...groupDraft, description: e.target.value })}/></label>
              <Button size="sm" disabled={busy} onClick={() => void saveGroup()}>Simpan Kelompok</Button>
            </div>}
          </details>
          <div className="rounded-xl border border-red-200 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-red-800">Hapus kategori pekerjaan</h3>
                <p className="mt-1 text-xs text-slate-600">Kategori dapat dihapus tanpa menghilangkan evidence atau riwayat audit.</p>
              </div>
              {!deletingGroup && <Button type="button" size="sm" variant="destructive"
                disabled={busy || groups.length <= 1} onClick={() => {
                  setDeletingGroup(true); setDeleteGroupMode(activeGroup.count ? "MOVE" : "ARCHIVE_ALL");
                  setDeleteGroupTarget("");
                }}><Trash2 className="mr-1.5 h-4 w-4"/>Hapus Kategori</Button>}
            </div>
            {groups.length <= 1 && <p className="mt-2 text-xs text-amber-700">Kategori terakhir tidak bisa dihapus agar workspace tetap bisa digunakan.</p>}
            {deletingGroup && <div role="alert" className="mt-3 space-y-3 rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-bold text-red-900">Konfirmasi hapus: {activeGroup.title}</p>
              <p className="text-xs text-red-800">Kategori ini memiliki <strong>{activeGroup.count} checklist aktif</strong>. Pilihan berikut memengaruhi progress dan Gantt.</p>
              {activeGroup.count > 0 && <div className="space-y-2">
                <label className="flex cursor-pointer items-start gap-2 text-xs text-slate-800">
                  <input type="radio" name="delete-group-mode" value="MOVE" checked={deleteGroupMode === "MOVE"}
                    onChange={() => setDeleteGroupMode("MOVE")} className="mt-0.5"/>
                  <span><strong>Pindahkan checklist ke kategori lain</strong> — checklist, PIC, evidence, status, dan kontribusi overall progress tetap ada.</span>
                </label>
                {deleteGroupMode === "MOVE" && <label className="block">
                  <span className={labelClass}>Kategori tujuan</span>
                  <select className={selectClass} aria-label="Kategori tujuan" value={deleteGroupTarget}
                    onChange={e => setDeleteGroupTarget(e.target.value)}>
                    <option value="">Pilih kategori tujuan...</option>
                    {groups.filter(g => g.id !== activeGroup.id).map(g =>
                      <option key={g.id} value={g.id}>{g.group_code} • {g.title}</option>)}
                  </select>
                </label>}
                <label className="flex cursor-pointer items-start gap-2 text-xs text-slate-800">
                  <input type="radio" name="delete-group-mode" value="ARCHIVE_ALL" checked={deleteGroupMode === "ARCHIVE_ALL"}
                    onChange={() => setDeleteGroupMode("ARCHIVE_ALL")} className="mt-0.5"/>
                  <span><strong>Arsipkan kategori dan seluruh checklist di dalamnya</strong> — seluruh checklist tersebut dikeluarkan dari progress dan Gantt; evidence tetap tersimpan untuk audit.</span>
                </label>
              </div>}
              {activeGroup.count === 0 && <p className="text-xs text-slate-700">Kategori kosong akan diarsipkan tanpa mengubah jumlah checklist dan overall progress.</p>}
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setDeletingGroup(false)}>Batal</Button>
                <Button type="button" size="sm" variant="destructive"
                  disabled={busy || groups.length <= 1 || (activeGroup.count > 0 && deleteGroupMode === "MOVE" && !deleteGroupTarget)}
                  onClick={() => void archiveGroup()}>
                  {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin"/>Ya, Hapus Kategori
                </Button>
              </div>
            </div>}
          </div>
          <div className="flex items-center justify-between gap-2"><div><h3 className="font-black">Checklist detail</h3>
              <p className="text-xs text-slate-500">Upload evidence tiap item, baru tandai Done.</p></div>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => {
              setAdding(true); setNewItem({ title: "", deliverable: "", owner_team: myTeam,
                start_date: activeGroup.start || today, due_date: activeGroup.end || today });
            }}><Plus className="mr-1 h-4 w-4"/>Tambah</Button>
          </div>
          <div className="space-y-3">
            {activeGroup.subtasks.length === 0 && <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Belum ada checklist aktif di kelompok ini.</p>}
            {activeGroup.subtasks.map(t => {
              const files = filesFor(t.id), open = activeItemId === t.id;
              return <div key={t.id} className={"rounded-xl border " + (t.status === "DONE" ? "border-emerald-200 bg-emerald-50/20" : "border-slate-200")}>
                <div className="flex items-start gap-3 p-3">
                  <input type="checkbox" checked={t.status === "DONE"} disabled={busy} aria-label={"Checklist " + t.title}
                    onChange={() => void setChecked(t)} className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-emerald-600"/>
                  <div className="min-w-0 flex-1"><p className="text-sm font-bold text-slate-900">{t.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatDate(t.start_date)} – {formatDate(t.due_date)}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className={"rounded-full px-2 py-0.5 " + statusColor[t.status]}>{statusName[t.status]}</span>
                      <span className="text-slate-500">{files.length} evidence</span>
                      {t.is_milestone && <span className="font-bold text-violet-700">Milestone</span>}
                      {t.status !== "DONE" && !files.length && <span className="text-amber-700">Evidence belum ada</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <label className="text-[11px] font-bold text-slate-600" htmlFor={"pic-" + t.id}>PIC Checklist</label>
                    <select id={"pic-" + t.id} aria-label={"Tim PIC untuk " + t.title} className="max-w-[160px] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold"
                      value={t.owner_team} disabled={busy} onChange={e => void assignChecklist(t, e.target.value as Team)}>
                      <option value="DA">Digital &amp; Affinity</option>
                      <option value="MARCOMM">Marcomm</option>
                    </select>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => {
                      if (open) { setActiveItemId(null); setItemDraft(null); setDeleteId(null); }
                      else { setActiveItemId(t.id); setItemDraft(itemDraftFrom(t)); setDeleteId(null); }
                    }}>{open ? "Tutup" : "Edit / Evidence"}</Button>
                  </div>
                </div>
                {open && itemDraft && <div className="space-y-3 border-t bg-slate-50/60 p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block sm:col-span-2"><span className={labelClass}>Nama checklist</span><Input maxLength={200} value={itemDraft.title} onChange={e => setItemDraft({ ...itemDraft, title: e.target.value })}/></label>
                    <label><span className={labelClass}>Tanggal mulai</span><Input type="date" value={itemDraft.start_date} onChange={e => setItemDraft({ ...itemDraft, start_date: e.target.value })}/></label>
                    <label><span className={labelClass}>Deadline</span><Input type="date" value={itemDraft.due_date} onChange={e => setItemDraft({ ...itemDraft, due_date: e.target.value })}/></label>
                    <label><span className={labelClass}>Tim PIC</span><select className={selectClass} value={itemDraft.owner_team} onChange={e => setItemDraft({ ...itemDraft, owner_team: e.target.value as Team })}>
                      <option value="DA">Digital &amp; Affinity</option><option value="MARCOMM">Marketing Communication</option></select></label>
                    <label><span className={labelClass}>Status</span><select className={selectClass} value={itemDraft.status} onChange={e => setItemDraft({ ...itemDraft, status: e.target.value as Status })}>
                      <option value="TODO">Belum mulai</option><option value="IN_PROGRESS">Dikerjakan</option><option value="BLOCKED">Terkendala</option><option value="DONE">Selesai</option></select></label>
                    <label className="block sm:col-span-2"><span className={labelClass}>Hasil yang diharapkan</span><Textarea rows={2} value={itemDraft.deliverable} onChange={e => setItemDraft({ ...itemDraft, deliverable: e.target.value })}/></label>
                    <label className="block sm:col-span-2"><span className={labelClass}>Catatan</span><Textarea rows={2} value={itemDraft.notes} onChange={e => setItemDraft({ ...itemDraft, notes: e.target.value })}/></label>
                  </div>
                  <Button size="sm" disabled={busy} onClick={() => void saveChecklist()}>Simpan Checklist</Button>
                  <div className="rounded-lg border bg-white p-3"><h4 className="flex items-center gap-2 text-sm font-bold"><UploadCloud className="h-4 w-4 text-blue-700"/>Evidence checklist ini</h4>
                    <p className="mt-1 text-xs text-slate-500">Maks. 50 MB per berkas, privat untuk DA dan Marcomm.</p>
                    <label className="mt-3 block cursor-pointer rounded-lg border border-dashed border-blue-300 bg-blue-50 p-3 text-center text-xs font-bold text-blue-700">+ Upload Evidence
                      <input className="sr-only" type="file" disabled={busy} accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.mp4,.txt"
                        onChange={e => { const file = e.target.files?.[0]; if (file) void uploadFile(t, file); e.target.value = ""; }}/></label>
                    <div className="mt-3 space-y-2">{files.length === 0 && <p className="text-xs text-amber-700">Belum ada evidence.</p>}
                      {files.map(e => <button key={e.id} onClick={() => void openFile(e)} className="flex w-full items-center gap-2 rounded-lg border p-2 text-left text-xs text-blue-700 hover:bg-blue-50">
                        <FileText className="h-4 w-4 shrink-0"/><span className="min-w-0 flex-1 truncate">{e.file_name}</span><span>{(e.file_size/1048576).toFixed(1)} MB</span></button>)}
                    </div>
                  </div>
                  {deleteId === t.id && <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-800">
                    <strong>Yakin hapus checklist ini?</strong> Item tidak lagi dihitung ke progress maupun Gantt. Evidence dan jejak audit tetap tersimpan.
                  </div>}
                  <div className="flex flex-wrap gap-2">{deleteId === t.id ? <>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => setDeleteId(null)}>Batal</Button>
                    <Button size="sm" variant="destructive" disabled={busy} onClick={() => void deleteChecklist()}>Ya, Hapus Checklist</Button>
                  </> : <Button size="sm" variant="destructive" disabled={busy} onClick={() => setDeleteId(t.id)}><Trash2 className="mr-2 h-4 w-4"/>Hapus Checklist</Button>}</div>
                </div>}
              </div>;
            })}
          </div>
          {adding && <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <h3 className="text-sm font-bold text-blue-900">Tambah Checklist ke {activeGroup.group_code}</h3>
            <label className="block"><span className={labelClass}>Nama checklist baru</span><Input maxLength={200} value={newItem.title} onChange={e => setNewItem({ ...newItem, title: e.target.value })}/></label>
            <label className="block"><span className={labelClass}>Hasil yang diharapkan</span><Textarea value={newItem.deliverable} onChange={e => setNewItem({ ...newItem, deliverable: e.target.value })}/></label>
            <div className="grid grid-cols-2 gap-3">
              <label><span className={labelClass}>Mulai</span><Input type="date" value={newItem.start_date} onChange={e => setNewItem({ ...newItem, start_date: e.target.value })}/></label>
              <label><span className={labelClass}>Deadline</span><Input type="date" value={newItem.due_date} onChange={e => setNewItem({ ...newItem, due_date: e.target.value })}/></label>
            </div>
            <label className="block"><span className={labelClass}>Tim PIC</span><select className={selectClass} value={newItem.owner_team} onChange={e => setNewItem({ ...newItem, owner_team: e.target.value as Team })}>
              <option value="DA">Digital &amp; Affinity</option><option value="MARCOMM">Marketing Communication</option></select></label>
            <div className="flex gap-2"><Button size="sm" disabled={busy} onClick={() => void addChecklist()}>Tambah Checklist</Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => setAdding(false)}>Batal</Button></div>
          </div>}
        </div>
        <DialogFooter><Button variant="outline" onClick={closeGroup}>Tutup</Button></DialogFooter>
        </>}
      </DialogContent>
    </Dialog>
  </div></AppLayout>;
}