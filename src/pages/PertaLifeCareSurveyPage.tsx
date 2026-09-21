import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  Link2,
  ListChecks,
  MessageCircle,
  RefreshCw,
  Search,
  Star,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  createPertaLifeCareSurveyActivity,
  getPertaLifeCareSurveyDashboard,
  linkPertaLifeCareIssueToActivity,
  type PertaLifeCareSurveyDashboard,
  type PertaLifeCareSurveyIssue,
  type PertaLifeCareSurveyTask,
} from "@/services/pertalifeCareSurveyService";

const FEATURES = [
  { key: "initial_access", label: "Awal membuka aplikasi" },
  { key: "registration", label: "Registrasi akun" },
  { key: "login", label: "Login" },
  { key: "otp_verification", label: "OTP/Verifikasi" },
  { key: "home_dashboard", label: "Halaman utama/Dashboard" },
  { key: "profile", label: "Profil" },
  { key: "policy_benefit", label: "Informasi polis & manfaat/benefit" },
  { key: "e_claim", label: "E-Claim" },
  { key: "provider", label: "Provider/Fasilitas Kesehatan" },
] as const;

type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
type FollowState = "NONE" | "TODO" | "PROCESS" | "DONE";

const EMPTY: PertaLifeCareSurveyDashboard = {
  responses: [],
  issues: [],
  tasks: [],
};

const statusLabel = (status?: string | null) => {
  const labels: Record<string, string> = {
    TO_DO: "To Do",
    ON_PROGRESS: "On Progress",
    WAITING_FOLLOW_UP: "Waiting / Follow Up",
    NEED_SUPPORT: "Need Support",
    PENDING_VALIDATION: "Pending Validation",
    DONE: "Done",
    CANCELLED: "Cancelled",
  };
  return status ? labels[status] || status : "-";
};

const statusClass = (status?: string | null) => {
  if (status === "DONE") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "ON_PROGRESS" || status === "WAITING_FOLLOW_UP") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (status === "NEED_SUPPORT" || status === "PENDING_VALIDATION") {
    return "border-violet-200 bg-violet-50 text-violet-700";
  }
  return "border-slate-200 bg-slate-50 text-slate-700";
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(date);
};

const monthKey = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { key: value.slice(0, 7), label: value.slice(0, 7) };
  const key = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(date);
  return {
    key,
    label: new Intl.DateTimeFormat("id-ID", {
      month: "short",
      year: "2-digit",
      timeZone: "Asia/Jakarta",
    }).format(date),
  };
};

const defaultDueDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 3);
  return date.toISOString().slice(0, 10);
};

const FollowBadge: React.FC<{ state: FollowState }> = ({ state }) => {
  if (state === "DONE") {
    return (
      <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        Sudah Ditindaklanjuti
      </Badge>
    );
  }
  if (state === "PROCESS") {
    return (
      <Badge className="border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50">
        <Activity className="mr-1 h-3 w-3" />
        Dalam Proses
      </Badge>
    );
  }
  if (state === "TODO") {
    return (
      <Badge className="border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-50">
        <AlertTriangle className="mr-1 h-3 w-3" />
        Belum Ditindaklanjuti
      </Badge>
    );
  }
  return <Badge variant="secondary">Tidak Ada Problem</Badge>;
};

const Metric: React.FC<{
  label: string;
  value: string | number;
  helper: string;
  icon: React.ComponentType<{ className?: string }>;
}> = ({ label, value, helper, icon: Icon }) => (
  <Card className="border-slate-200 shadow-sm">
    <CardContent className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-black tracking-tight text-slate-900">{value}</p>
          <p className="mt-1 text-xs text-slate-500">{helper}</p>
        </div>
        <div className="rounded-xl bg-blue-50 p-2.5 text-blue-700">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </CardContent>
  </Card>
);

const PertaLifeCareSurveyPage: React.FC = () => {
  const [data, setData] = useState<PertaLifeCareSurveyDashboard>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [selectedIssue, setSelectedIssue] = useState<PertaLifeCareSurveyIssue | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [taskSearch, setTaskSearch] = useState("");
  const [newTaskMode, setNewTaskMode] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState(defaultDueDate());
  const [newTaskPriority, setNewTaskPriority] = useState<Priority>("MEDIUM");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      setData(await getPertaLifeCareSurveyDashboard());
      setLastUpdated(new Date());
    } catch (error) {
      console.error(error);
      if (!silent) {
        toast.error(error instanceof Error ? error.message : "Dashboard survey belum dapat dimuat.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 30000);
    const onFocus = () => void load(true);
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  const responseById = useMemo(
    () => new Map(data.responses.map((row) => [row.id, row])),
    [data.responses],
  );

  const issuesByResponse = useMemo(() => {
    const map = new Map<string, PertaLifeCareSurveyIssue[]>();
    data.issues.forEach((issue) => {
      const list = map.get(issue.responseId) || [];
      list.push(issue);
      map.set(issue.responseId, list);
    });
    return map;
  }, [data.issues]);

  const affectedIds = useMemo(
    () => new Set(data.issues.map((issue) => issue.responseId)),
    [data.issues],
  );

  const scores = useMemo(
    () =>
      data.responses
        .map((row) => row.satisfactionScore)
        .filter((value): value is number => typeof value === "number"),
    [data.responses],
  );

  const avgSatisfaction = scores.length
    ? scores.reduce((sum, value) => sum + value, 0) / scores.length
    : 0;
  const lowScores = scores.filter((value) => value <= 2).length;
  const linkedIssues = data.issues.filter((issue) => issue.linkedActivityId).length;
  const completedIssues = data.issues.filter((issue) => issue.activityStatus === "DONE").length;
  const evidenceCount = data.issues.filter((issue) => issue.evidenceUrl).length;
  const contactableCount = data.responses.filter((row) => row.contactable).length;
  const openTasks = data.tasks.filter((task) => task.status !== "DONE").length;

  const rate = (part: number, total: number) => (total ? (part / total) * 100 : 0);

  const featureSummary = useMemo(
    () =>
      FEATURES.map((feature) => {
        const rows = data.issues.filter((issue) => issue.featureKey === feature.key);
        return {
          key: feature.key,
          feature: feature.label,
          cases: rows.length,
          share: rate(rows.length, data.issues.length),
          evidence: rows.filter((row) => row.evidenceUrl).length,
          linked: rows.filter((row) => row.linkedActivityId).length,
          done: rows.filter((row) => row.activityStatus === "DONE").length,
        };
      }),
    [data.issues],
  );

  const monthlyData = useMemo(() => {
    const map = new Map<string, { key: string; month: string; responses: number }>();
    data.responses.forEach((row) => {
      const identity = monthKey(row.submittedAt);
      const current = map.get(identity.key) || {
        key: identity.key,
        month: identity.label,
        responses: 0,
      };
      current.responses += 1;
      map.set(identity.key, current);
    });
    return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [data.responses]);

  const satisfactionData = useMemo(
    () =>
      [1, 2, 3, 4, 5].map((score) => ({
        score: String(score),
        responses: scores.filter((value) => value === score).length,
      })),
    [scores],
  );

  const topFeatures = featureSummary
    .filter((row) => row.cases > 0)
    .sort((a, b) => b.cases - a.cases)
    .slice(0, 3);

  const followStateForResponse = useCallback(
    (responseId: string): FollowState => {
      const issues = issuesByResponse.get(responseId) || [];
      if (!issues.length) return "NONE";
      if (issues.every((issue) => issue.activityStatus === "DONE")) return "DONE";
      if (issues.some((issue) => issue.linkedActivityId)) return "PROCESS";
      return "TODO";
    },
    [issuesByResponse],
  );

  const sortedIssues = useMemo(
    () =>
      [...data.issues].sort((a, b) => {
        const rank = (issue: PertaLifeCareSurveyIssue) =>
          !issue.linkedActivityId ? 0 : issue.activityStatus === "DONE" ? 2 : 1;
        const delta = rank(a) - rank(b);
        if (delta) return delta;
        const ad = responseById.get(a.responseId)?.submittedAt || "";
        const bd = responseById.get(b.responseId)?.submittedAt || "";
        return bd.localeCompare(ad);
      }),
    [data.issues, responseById],
  );

  const openIssue = (issue: PertaLifeCareSurveyIssue) => {
    const response = responseById.get(issue.responseId);
    const detail = (issue.issueDetail || "").replace(/\s+/g, " ").trim();
    setSelectedIssue(issue);
    setTaskSearch("");
    setNewTaskMode(false);
    setNewTaskTitle(
      detail
        ? issue.featureLabel + " — " + detail.slice(0, 90)
        : "Follow-up " + issue.featureLabel,
    );
    setNewTaskDueDate(defaultDueDate());
    setNewTaskPriority(
      typeof response?.satisfactionScore === "number" && response.satisfactionScore <= 2
        ? "HIGH"
        : "MEDIUM",
    );
    setDialogOpen(true);
  };

  const candidateTasks = useMemo(() => {
    if (!selectedIssue) return [];
    const q = taskSearch.trim().toLowerCase();
    return data.tasks
      .filter((task) => {
        if (!q) return true;
        return [
          task.referenceNo || "",
          task.title,
          task.ownerName,
          ...(task.featureLabels || []),
        ]
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => {
        const aSame = a.featureKeys?.includes(selectedIssue.featureKey) ? 1 : 0;
        const bSame = b.featureKeys?.includes(selectedIssue.featureKey) ? 1 : 0;
        if (aSame !== bSame) return bSame - aSame;
        const aDone = a.status === "DONE" ? 1 : 0;
        const bDone = b.status === "DONE" ? 1 : 0;
        if (aDone !== bDone) return aDone - bDone;
        return b.updatedAt.localeCompare(a.updatedAt);
      });
  }, [data.tasks, selectedIssue, taskSearch]);

  const linkExisting = async (task: PertaLifeCareSurveyTask) => {
    if (!selectedIssue) return;
    setSubmitting(true);
    try {
      const result = await linkPertaLifeCareIssueToActivity(selectedIssue.id, task.id);
      toast.success(
        task.status === "DONE"
          ? (result.referenceNo || "Task") + " ditautkan dan dibuka kembali sebagai recurrence."
          : (result.referenceNo || "Task") + " berhasil ditautkan ke hasil survey.",
      );
      setDialogOpen(false);
      await load(true);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Gagal menautkan task.");
    } finally {
      setSubmitting(false);
    }
  };

  const createTask = async () => {
    if (!selectedIssue) return;
    const title = newTaskTitle.trim();
    if (title.length < 5) {
      toast.error("Judul task minimal 5 karakter.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await createPertaLifeCareSurveyActivity({
        issueId: selectedIssue.id,
        title,
        dueDate: newTaskDueDate || null,
        priority: newTaskPriority,
      });
      toast.success(result.referenceNo + " berhasil dibuat di To Do List.");
      setDialogOpen(false);
      await load(true);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Task belum berhasil dibuat.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-50">Digital & Affinity</Badge>
              <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100">
                Owner: Doan Banjar & Nadi Akbar
              </Badge>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              Survey PertaLife Care
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              Monitoring kepuasan, issue aplikasi, evidence, dan tindak lanjut yang terhubung ke To Do List.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-[11px] text-slate-400">
              <div>Auto refresh 30 detik</div>
              <div>
                Update: {lastUpdated ? lastUpdated.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "-"}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => void load(true)} disabled={refreshing}>
              <RefreshCw className={"mr-2 h-4 w-4 " + (refreshing ? "animate-spin" : "")} />
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Metric label="Total Responses" value={loading ? "…" : data.responses.length} helper="Respons yang sudah tersinkron" icon={Users} />
          <Metric label="Avg Satisfaction" value={loading ? "…" : avgSatisfaction.toFixed(2) + " / 5"} helper={lowScores + " responden memberi skor 1–2"} icon={Star} />
          <Metric label="Users with Problems" value={loading ? "…" : affectedIds.size} helper={rate(affectedIds.size, data.responses.length).toFixed(1) + "% dari responden"} icon={AlertTriangle} />
          <Metric label="Total Issue Cases" value={loading ? "…" : data.issues.length} helper={linkedIssues + " sudah terhubung ke Activity"} icon={ClipboardCheck} />
          <Metric label="Follow-up Complete" value={loading ? "…" : rate(completedIssues, data.issues.length).toFixed(1) + "%"} helper={completedIssues + " issue selesai via Activity Done"} icon={CheckCircle2} />
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Card className="border-slate-200 bg-slate-50/70">
            <CardContent className="p-4">
              <p className="text-xs font-bold text-slate-500">Evidence Coverage</p>
              <p className="mt-1 text-lg font-black">{rate(evidenceCount, data.issues.length).toFixed(1)}%</p>
              <p className="text-xs text-slate-500">{evidenceCount} dari {data.issues.length} issue punya evidence</p>
            </CardContent>
          </Card>
          <Card className="border-slate-200 bg-slate-50/70">
            <CardContent className="p-4">
              <p className="text-xs font-bold text-slate-500">Contactable Rate</p>
              <p className="mt-1 text-lg font-black">{rate(contactableCount, data.responses.length).toFixed(1)}%</p>
              <p className="text-xs text-slate-500">{contactableCount} responden bersedia dihubungi</p>
            </CardContent>
          </Card>
          <Card className="border-slate-200 bg-slate-50/70">
            <CardContent className="p-4">
              <p className="text-xs font-bold text-slate-500">Open Survey Tasks</p>
              <p className="mt-1 text-lg font-black">{openTasks}</p>
              <p className="text-xs text-slate-500">Hanya task source Survey PertaLife Care</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-5">
          <TabsList className="grid w-full max-w-2xl grid-cols-3">
            <TabsTrigger value="overview">Overview & Follow-up</TabsTrigger>
            <TabsTrigger value="issues">Issue Analysis</TabsTrigger>
            <TabsTrigger value="respondents">Respondent Detail</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-5">
            <div className="grid gap-4 xl:grid-cols-3">
              <Card className="xl:col-span-2">
                <CardHeader className="pb-2"><CardTitle className="text-sm">Monthly Responses</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={monthlyData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="month" fontSize={11} />
                        <YAxis allowDecimals={false} fontSize={11} />
                        <RechartsTooltip />
                        <Line type="monotone" dataKey="responses" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Satisfaction Distribution</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={satisfactionData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="score" fontSize={11} />
                        <YAxis allowDecimals={false} fontSize={11} />
                        <RechartsTooltip />
                        <Bar dataKey="responses" fill="#2563eb" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <Card><CardContent className="p-5"><div className="flex items-center gap-2 text-sm font-bold"><AlertTriangle className="h-4 w-4 text-amber-500" />Top Attention</div><p className="mt-3 text-sm leading-6 text-slate-600">{topFeatures.length ? topFeatures.map((row) => row.feature).join(", ") + " menjadi fitur dengan laporan issue saat ini." : "Belum ada issue aplikasi."}</p></CardContent></Card>
              <Card><CardContent className="p-5"><div className="flex items-center gap-2 text-sm font-bold"><Star className="h-4 w-4 text-amber-500" />Customer Experience</div><p className="mt-3 text-sm leading-6 text-slate-600">Rata-rata kepuasan {avgSatisfaction.toFixed(2)}/5. {lowScores} responden memberi skor rendah 1–2.</p></CardContent></Card>
              <Card><CardContent className="p-5"><div className="flex items-center gap-2 text-sm font-bold"><ListChecks className="h-4 w-4 text-blue-600" />Follow-up Queue</div><p className="mt-3 text-sm leading-6 text-slate-600">{data.issues.length - linkedIssues} issue belum punya task; {openTasks} task survey masih berjalan.</p></CardContent></Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Issue Follow-up Queue</CardTitle>
                <p className="text-xs text-slate-500">
                  Cek task survey existing lebih dulu. Task baru hanya dibuat setelah issue dinyatakan benar-benar berbeda.
                </p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>Respondent</TableHead><TableHead>Feature & Issue</TableHead><TableHead>Satisfaction</TableHead><TableHead>Follow-up</TableHead><TableHead>Activity</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {!sortedIssues.length ? (
                        <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-slate-400">Belum ada issue yang membutuhkan tindak lanjut.</TableCell></TableRow>
                      ) : sortedIssues.map((issue) => {
                        const response = responseById.get(issue.responseId);
                        const state: FollowState = !issue.linkedActivityId ? "TODO" : issue.activityStatus === "DONE" ? "DONE" : "PROCESS";
                        return (
                          <TableRow key={issue.id}>
                            <TableCell className="min-w-[190px] align-top">
                              <div className="font-semibold">{response?.respondentName || "-"}</div>
                              <div className="mt-1 text-[11px] text-slate-500">{formatDateTime(response?.submittedAt)}</div>
                              <div className="text-[11px] text-slate-400">Member ID: {response?.memberId || "-"}</div>
                            </TableCell>
                            <TableCell className="min-w-[300px] align-top">
                              <div className="font-semibold">{issue.featureLabel}</div>
                              <div className="mt-1 max-w-xl whitespace-pre-wrap text-xs leading-5 text-slate-600">{issue.issueDetail || "Tidak ada uraian tambahan."}</div>
                              {issue.evidenceUrl && <a href={issue.evidenceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline">Evidence <ExternalLink className="h-3 w-3" /></a>}
                            </TableCell>
                            <TableCell className="align-top"><span className="font-bold">{response?.satisfactionScore ?? "-"}</span><span className="text-xs text-slate-400"> / 5</span></TableCell>
                            <TableCell className="align-top"><FollowBadge state={state} /></TableCell>
                            <TableCell className="min-w-[180px] align-top">
                              {issue.linkedActivityId ? <Link to={"/aktivitas?task=" + issue.linkedActivityId} className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline">{issue.activityReferenceNo || "Buka Activity"} <ExternalLink className="h-3 w-3" /></Link> : <span className="text-xs text-slate-400">Belum ada</span>}
                              {issue.activityOwnerName && <div className="mt-1 text-[11px] text-slate-500">PIC: {issue.activityOwnerName}</div>}
                              {issue.activityStatus && <Badge className={"mt-2 border text-[10px] " + statusClass(issue.activityStatus)}>{statusLabel(issue.activityStatus)}</Badge>}
                            </TableCell>
                            <TableCell className="text-right align-top">
                              {!issue.linkedActivityId ? <Button size="sm" onClick={() => openIssue(issue)}><Link2 className="mr-2 h-3.5 w-3.5" />Tindak Lanjuti</Button> : <Button variant="outline" size="sm" asChild><Link to={"/aktivitas?task=" + issue.linkedActivityId}>Buka Task</Link></Button>}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="issues" className="space-y-5">
            <div className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Issue Cases by Feature</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={featureSummary} layout="vertical" margin={{ left: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" allowDecimals={false} fontSize={11} />
                        <YAxis type="category" dataKey="feature" width={170} fontSize={10} />
                        <RechartsTooltip />
                        <Bar dataKey="cases" fill="#2563eb" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm">Reading Guide</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-xs leading-5 text-slate-600">
                  <p><strong>Affected Users</strong> = responden dengan minimal satu issue “Ya”.</p>
                  <p><strong>Total Issue Cases</strong> = total kejadian issue; satu responden bisa punya lebih dari satu case.</p>
                  <p><strong>Evidence Coverage</strong> = issue dengan screenshot/video dibanding total issue.</p>
                  <p><strong>Follow-up Complete</strong> hanya selesai ketika Activity terkait berstatus Done.</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle className="text-base">Feature Summary</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>Feature</TableHead><TableHead className="text-right">Issue Cases</TableHead><TableHead className="text-right">Share</TableHead><TableHead className="text-right">Evidence</TableHead><TableHead className="text-right">Linked</TableHead><TableHead className="text-right">Done</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {featureSummary.map((row) => (
                        <TableRow key={row.key}>
                          <TableCell className="font-medium">{row.feature}</TableCell>
                          <TableCell className="text-right">{row.cases}</TableCell>
                          <TableCell className="text-right">{row.share.toFixed(1)}%</TableCell>
                          <TableCell className="text-right">{row.evidence}/{row.cases}</TableCell>
                          <TableCell className="text-right">{row.linked}</TableCell>
                          <TableCell className="text-right">{row.done}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Existing Survey Activities</CardTitle>
                <p className="text-xs text-slate-500">Hanya task source Survey PertaLife Care. Task pribadi lain tetap mengikuti privacy Activities.</p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>Activity</TableHead><TableHead>PIC</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Affected</TableHead><TableHead>Feature</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {!data.tasks.length ? <TableRow><TableCell colSpan={5} className="py-10 text-center text-sm text-slate-400">Belum ada Activity yang dibuat dari survey.</TableCell></TableRow> : data.tasks.map((task) => (
                        <TableRow key={task.id}>
                          <TableCell className="min-w-[280px]">
                            <Link to={"/aktivitas?task=" + task.id} className="font-bold text-blue-600 hover:underline">{task.referenceNo || "Activity"}</Link>
                            <div className="mt-1 text-xs text-slate-600">{task.title}</div>
                          </TableCell>
                          <TableCell>{task.ownerName}</TableCell>
                          <TableCell><Badge className={"border " + statusClass(task.status)}>{statusLabel(task.status)}</Badge></TableCell>
                          <TableCell className="text-right">{task.linkedResponseCount}</TableCell>
                          <TableCell className="max-w-[260px] text-xs">{(task.featureLabels || []).join(", ") || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="respondents">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Respondent Detail</CardTitle>
                <p className="text-xs text-slate-500">Kontak hanya ditampilkan sebagai action untuk responden yang bersedia dihubungi.</p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Respondent</TableHead><TableHead>Device / OS</TableHead><TableHead>Satisfaction</TableHead><TableHead>Problem</TableHead><TableHead>Follow-up</TableHead><TableHead>Contact</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {data.responses.map((response) => {
                        const responseIssues = issuesByResponse.get(response.id) || [];
                        const state = followStateForResponse(response.id);
                        return (
                          <TableRow key={response.id}>
                            <TableCell className="min-w-[150px] text-xs">{formatDateTime(response.submittedAt)}</TableCell>
                            <TableCell className="min-w-[190px]"><div className="font-semibold">{response.respondentName}</div><div className="text-[11px] text-slate-400">{response.memberId || "-"}</div></TableCell>
                            <TableCell className="min-w-[160px] text-xs"><div>{response.deviceType || "-"}</div><div className="text-slate-400">{response.osName || "-"}</div></TableCell>
                            <TableCell><span className="font-bold">{response.satisfactionScore ?? "-"}</span><span className="text-xs text-slate-400"> / 5</span></TableCell>
                            <TableCell className="min-w-[240px]">{!responseIssues.length ? <span className="text-xs text-slate-400">Tidak ada problem</span> : responseIssues.map((issue) => <div key={issue.id} className="text-xs text-slate-700">• {issue.featureLabel}</div>)}</TableCell>
                            <TableCell><FollowBadge state={state} /></TableCell>
                            <TableCell>
                              {response.contactable && response.phone ? (
                                <a href={"https://wa.me/" + response.phone.replace(/\D/g, "").replace(/^0/, "62")} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline"><MessageCircle className="h-3.5 w-3.5" />WhatsApp</a>
                              ) : <span className="text-xs text-slate-400">Tidak bersedia</span>}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!submitting) setDialogOpen(open); }}>
        <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tindak Lanjut Issue Survey</DialogTitle>
            <DialogDescription>
              Cari task Survey PertaLife Care existing dulu. Task baru hanya dibuat jika Doan/Nadi menyatakan issue benar-benar berbeda.
            </DialogDescription>
          </DialogHeader>

          {selectedIssue && (
            <div className="space-y-5">
              <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
                <div className="text-xs font-bold uppercase tracking-wide text-blue-700">{selectedIssue.featureLabel}</div>
                <div className="mt-2 text-sm leading-6 text-slate-700">{selectedIssue.issueDetail || "Tidak ada uraian tambahan."}</div>
                {selectedIssue.evidenceUrl && <a href={selectedIssue.evidenceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline">Buka evidence <ExternalLink className="h-3 w-3" /></a>}
              </div>

              {!newTaskMode ? (
                <>
                  <div>
                    <Label htmlFor="task-search">Cari Existing Survey Task</Label>
                    <div className="relative mt-2">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <Input id="task-search" value={taskSearch} onChange={(event) => setTaskSearch(event.target.value)} placeholder="Cari nomor activity, judul, feature, atau PIC…" className="pl-9" />
                    </div>
                  </div>

                  <div className="max-h-[300px] space-y-2 overflow-y-auto pr-1">
                    {!candidateTasks.length ? <div className="rounded-xl border border-dashed p-5 text-center text-sm text-slate-400">Belum ada task survey existing.</div> : candidateTasks.slice(0, 12).map((task) => {
                      const sameFeature = task.featureKeys?.includes(selectedIssue.featureKey);
                      return (
                        <div key={task.id} className={"rounded-xl border p-4 " + (sameFeature ? "border-blue-200 bg-blue-50/40" : "border-slate-200")}>
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-black">{task.referenceNo || "Activity"}</span>
                                <Badge className={"border text-[10px] " + statusClass(task.status)}>{statusLabel(task.status)}</Badge>
                                {sameFeature && <Badge className="bg-blue-600 text-white hover:bg-blue-600">Feature sama</Badge>}
                              </div>
                              <div className="mt-1 text-sm text-slate-700">{task.title}</div>
                              <div className="mt-2 text-[11px] text-slate-500">PIC {task.ownerName} · {task.linkedResponseCount} affected respondent</div>
                              {task.status === "DONE" && <div className="mt-2 text-[11px] font-semibold text-amber-700">Jika ditautkan, task akan dibuka kembali sebagai recurrence.</div>}
                            </div>
                            <div className="flex shrink-0 gap-2">
                              <Button type="button" variant="outline" size="sm" asChild><Link to={"/aktivitas?task=" + task.id} target="_blank">Lihat</Link></Button>
                              <Button type="button" size="sm" disabled={submitting} onClick={() => void linkExisting(task)}><Link2 className="mr-1.5 h-3.5 w-3.5" />Link ke Task Ini</Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <Separator />
                  <div className="rounded-xl border border-dashed border-slate-300 p-4">
                    <div className="font-bold">Tidak ada task yang benar-benar sama?</div>
                    <p className="mt-1 text-xs leading-5 text-slate-500">Pilih opsi ini hanya setelah mengecek task survey existing.</p>
                    <Button type="button" variant="outline" className="mt-3" onClick={() => setNewTaskMode(true)}>
                      Issue Benar-Benar Berbeda — Buat Task Baru
                    </Button>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-800">
                    Konfirmasi: issue ini berbeda dari task survey existing. Task baru akan masuk To Do List dan shared hanya untuk Doan/Nadi.
                  </div>
                  <div>
                    <Label htmlFor="new-task-title">Judul Task</Label>
                    <Textarea id="new-task-title" value={newTaskTitle} onChange={(event) => setNewTaskTitle(event.target.value)} rows={3} className="mt-2" />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div><Label htmlFor="new-task-due">Due Date</Label><Input id="new-task-due" type="date" value={newTaskDueDate} onChange={(event) => setNewTaskDueDate(event.target.value)} className="mt-2" /></div>
                    <div>
                      <Label>Priority</Label>
                      <Select value={newTaskPriority} onValueChange={(value) => setNewTaskPriority(value as Priority)}>
                        <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="LOW">Low</SelectItem><SelectItem value="MEDIUM">Medium</SelectItem><SelectItem value="HIGH">High</SelectItem><SelectItem value="URGENT">Urgent</SelectItem></SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-between gap-2">
                    <Button type="button" variant="ghost" disabled={submitting} onClick={() => setNewTaskMode(false)}>Kembali Cari Existing</Button>
                    <Button type="button" disabled={submitting} onClick={() => void createTask()}><ListChecks className="mr-2 h-4 w-4" />{submitting ? "Membuat Task…" : "Buat di To Do List"}</Button>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="sm:justify-between">
            <p className="text-[11px] text-slate-400">Existing-task search dibatasi hanya ke source Survey PertaLife Care.</p>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default PertaLifeCareSurveyPage;
