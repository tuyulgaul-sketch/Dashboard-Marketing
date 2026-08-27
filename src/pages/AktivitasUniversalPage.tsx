import React, { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import {
  ActivityCategory,
  ActivityPriority,
  DirectoryProfile,
  UniversalActivity,
  UniversalActivityStatus,
  createUniversalActivity,
  getActivityDirectory,
  getUniversalActivities,
  reviewUniversalActivityValidation,
  submitUniversalActivityForValidation,
  updateUniversalActivityStatus,
} from "@/services/activityService";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ListTodo,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";

const CATEGORY_LABELS: Record<ActivityCategory, string> = {
  CUSTOMER_EXTERNAL: "Customer / External",
  INTERNAL_COORDINATION: "Internal Coordination",
  FOLLOW_UP: "Follow Up",
  MEETING: "Meeting",
  PROJECT_DEVELOPMENT: "Project / Development",
  ADMINISTRATION: "Administration",
  DOCUMENT_REPORTING: "Document / Reporting",
  MARKETING_COMMUNICATION: "Marketing Communication",
  TENDER_PROPOSAL: "Tender / Proposal",
  MONITORING_REVIEW: "Monitoring / Review",
  OTHER: "Other",
};

const STATUS_LABELS: Record<UniversalActivityStatus, string> = {
  DRAFT: "Draft",
  TO_DO: "To Do",
  ON_PROGRESS: "On Progress",
  WAITING_FOLLOW_UP: "Waiting / Follow Up",
  NEED_SUPPORT: "Need Support",
  PENDING_VALIDATION: "Pending Validation",
  DONE: "Done",
  CANCELLED: "Cancelled",
};

const PRIORITY_LABELS: Record<ActivityPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

const MOVABLE_STATUSES: Array<
  Exclude<UniversalActivityStatus, "PENDING_VALIDATION" | "DONE">
> = [
  "DRAFT",
  "TO_DO",
  "ON_PROGRESS",
  "WAITING_FOLLOW_UP",
  "NEED_SUPPORT",
  "CANCELLED",
];

type ScopeFilter =
  | "MY"
  | "TEAM"
  | "ACTION"
  | "OVERDUE"
  | "ALL";

const todayKey = () =>
  new Date().toISOString().slice(0, 10);

const isSalesConditionalCategory = (
  category: ActivityCategory
) =>
  category === "CUSTOMER_EXTERNAL" ||
  category === "TENDER_PROPOSAL";

const AktivitasUniversalPage: React.FC = () => {
  const { profile } = useAuth();

  const [activities, setActivities] = useState<UniversalActivity[]>([]);
  const [directory, setDirectory] = useState<DirectoryProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState("");

  const [scope, setScope] = useState<ScopeFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [query, setQuery] = useState("");

  const [title, setTitle] = useState("");
  const [category, setCategory] =
    useState<ActivityCategory>("INTERNAL_COORDINATION");
  const [priority, setPriority] =
    useState<ActivityPriority>("MEDIUM");
  const [ownerProfileId, setOwnerProfileId] = useState("");
  const [activityDate, setActivityDate] = useState(todayKey());
  const [startTime, setStartTime] = useState("");
  const [dueDate, setDueDate] = useState(todayKey());
  const [dueTime, setDueTime] = useState("");
  const [description, setDescription] = useState("");
  const [nextAction, setNextAction] = useState("");

  const [companyName, setCompanyName] = useState("");
  const [personMet, setPersonMet] = useState("");
  const [positionMet, setPositionMet] = useState("");
  const [productName, setProductName] = useState("");
  const [interactionMethod, setInteractionMethod] = useState("");
  const [potentialPremium, setPotentialPremium] = useState("");

  const profileMap = useMemo(
    () =>
      new Map(
        directory.map((item) => [item.id, item])
      ),
    [directory]
  );

  const refresh = async () => {
    setLoading(true);
    setError("");

    try {
      const [activityRows, directoryRows] =
        await Promise.all([
          getUniversalActivities(),
          getActivityDirectory(),
        ]);

      setActivities(activityRows);
      setDirectory(directoryRows);

      if (profile && !ownerProfileId) {
        setOwnerProfileId(profile.id);
      }
    } catch (err) {
      console.error(err);
      setError(
        "Gagal membaca data aktivitas. Pastikan SQL Activity v2 sudah dijalankan di Supabase."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!profile) return;
    setOwnerProfileId(profile.id);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const isOverdue = (activity: UniversalActivity) =>
    Boolean(
      activity.due_date &&
        activity.due_date < todayKey() &&
        !["DONE", "CANCELLED"].includes(activity.status)
    );

  const filteredActivities = useMemo(() => {
    const q = query.trim().toLowerCase();

    return activities.filter((activity) => {
      const owner = profileMap.get(activity.owner_profile_id);

      if (
        scope === "MY" &&
        activity.owner_profile_id !== profile?.id
      ) {
        return false;
      }

      if (
        scope === "TEAM" &&
        activity.owner_profile_id === profile?.id
      ) {
        return false;
      }

      if (
        scope === "ACTION" &&
        !(
          activity.status === "PENDING_VALIDATION" &&
          activity.validation_approver_profile_id === profile?.id
        )
      ) {
        return false;
      }

      if (scope === "OVERDUE" && !isOverdue(activity)) {
        return false;
      }

      if (
        statusFilter !== "ALL" &&
        activity.status !== statusFilter
      ) {
        return false;
      }

      if (
        categoryFilter !== "ALL" &&
        activity.category !== categoryFilter
      ) {
        return false;
      }

      if (q) {
        const haystack = [
          activity.title,
          activity.description,
          activity.company_name,
          owner?.full_name,
          owner?.unit,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [
    activities,
    categoryFilter,
    profile?.id,
    profileMap,
    query,
    scope,
    statusFilter,
  ]);

  const myCount = activities.filter(
    (activity) => activity.owner_profile_id === profile?.id
  ).length;

  const onProgressCount = activities.filter(
    (activity) => activity.status === "ON_PROGRESS"
  ).length;

  const overdueCount = activities.filter(isOverdue).length;

  const actionCount = activities.filter(
    (activity) =>
      activity.status === "PENDING_VALIDATION" &&
      activity.validation_approver_profile_id === profile?.id
  ).length;

  const resetForm = () => {
    setTitle("");
    setCategory("INTERNAL_COORDINATION");
    setPriority("MEDIUM");
    setOwnerProfileId(profile?.id || "");
    setActivityDate(todayKey());
    setStartTime("");
    setDueDate(todayKey());
    setDueTime("");
    setDescription("");
    setNextAction("");
    setCompanyName("");
    setPersonMet("");
    setPositionMet("");
    setProductName("");
    setInteractionMethod("");
    setPotentialPremium("");
  };

  const handleCreate = async () => {
    if (!profile) return;

    if (!title.trim()) {
      window.alert("Judul aktivitas wajib diisi.");
      return;
    }

    if (!ownerProfileId) {
      window.alert("PIC / Owner wajib dipilih.");
      return;
    }

    try {
      setBusyId("CREATE");

      await createUniversalActivity(
        {
          title,
          category,
          priority,
          owner_profile_id: ownerProfileId,
          activity_date: activityDate,
          start_time: startTime || undefined,
          due_date: dueDate || undefined,
          due_time: dueTime || undefined,
          description,
          next_action: nextAction,
          company_name: companyName,
          person_met: personMet,
          position_met: positionMet,
          product_name: productName,
          interaction_method: interactionMethod,
          potential_premium: potentialPremium
            ? Number(potentialPremium)
            : null,
        },
        profile.id
      );

      setFormOpen(false);
      resetForm();
      await refresh();
    } catch (err: any) {
      console.error(err);
      window.alert(
        err?.message || "Gagal membuat aktivitas."
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleMoveStatus = async (
    activityId: string,
    status: Exclude<
      UniversalActivityStatus,
      "PENDING_VALIDATION" | "DONE"
    >
  ) => {
    try {
      setBusyId(activityId);
      await updateUniversalActivityStatus(activityId, status);
      await refresh();
    } catch (err: any) {
      console.error(err);
      window.alert(
        err?.message || "Gagal mengubah status."
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleSubmitValidation = async (activityId: string) => {
    try {
      setBusyId(activityId);
      await submitUniversalActivityForValidation(activityId);
      await refresh();
    } catch (err: any) {
      console.error(err);
      window.alert(
        err?.message || "Gagal submit validasi."
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleReview = async (
    activityId: string,
    approve: boolean
  ) => {
    const notes =
      window.prompt(
        approve
          ? "Catatan approval (opsional):"
          : "Alasan dikembalikan:"
      ) || "";

    if (!approve && !notes.trim()) {
      window.alert(
        "Alasan wajib diisi jika aktivitas dikembalikan."
      );
      return;
    }

    try {
      setBusyId(activityId);

      await reviewUniversalActivityValidation(
        activityId,
        approve,
        notes
      );

      await refresh();
    } catch (err: any) {
      console.error(err);
      window.alert(
        err?.message || "Gagal memproses validasi."
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Aktivitas
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Activity Management untuk seluruh Direktorat Marketing,
              termasuk Marketing Support.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={loading}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>

            <Button
              size="sm"
              onClick={() => {
                resetForm();
                setFormOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Aktivitas Baru
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-3 p-5">
              <div className="rounded-lg bg-blue-50 p-2 text-blue-700">
                <ListTodo className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900">
                  {myCount}
                </div>
                <div className="text-xs text-slate-500">
                  Aktivitas Saya
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-3 p-5">
              <div className="rounded-lg bg-amber-50 p-2 text-amber-700">
                <Clock3 className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900">
                  {onProgressCount}
                </div>
                <div className="text-xs text-slate-500">
                  On Progress
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-3 p-5">
              <div className="rounded-lg bg-red-50 p-2 text-red-700">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900">
                  {overdueCount}
                </div>
                <div className="text-xs text-slate-500">
                  Due / Overdue
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-3 p-5">
              <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900">
                  {actionCount}
                </div>
                <div className="text-xs text-slate-500">
                  Menunggu Approval Saya
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">
              Daftar Aktivitas
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="mb-4 grid gap-3 lg:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr]">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  className="pl-9"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Cari aktivitas, PIC, unit..."
                />
              </div>

              <Select
                value={scope}
                onValueChange={(value) =>
                  setScope(value as ScopeFilter)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Visible</SelectItem>
                  <SelectItem value="MY">My Activities</SelectItem>
                  <SelectItem value="TEAM">Team</SelectItem>
                  <SelectItem value="ACTION">Need My Action</SelectItem>
                  <SelectItem value="OVERDUE">Overdue</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={statusFilter}
                onValueChange={setStatusFilter}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Status</SelectItem>
                  {Object.entries(STATUS_LABELS).map(
                    ([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>

              <Select
                value={categoryFilter}
                onValueChange={setCategoryFilter}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Kategori" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Kategori</SelectItem>
                  {Object.entries(CATEGORY_LABELS).map(
                    ([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[1180px] text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
                  <tr>
                    <th className="p-3">Aktivitas</th>
                    <th className="p-3">Owner</th>
                    <th className="p-3">Unit</th>
                    <th className="p-3">Due</th>
                    <th className="p-3">Priority</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Progress</th>
                    <th className="p-3">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500">
                        Memuat aktivitas...
                      </td>
                    </tr>
                  ) : filteredActivities.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500">
                        Belum ada aktivitas pada filter ini.
                      </td>
                    </tr>
                  ) : (
                    filteredActivities.map((activity) => {
                      const owner =
                        profileMap.get(activity.owner_profile_id);

                      const awaitingMyApproval =
                        activity.status === "PENDING_VALIDATION" &&
                        activity.validation_approver_profile_id === profile?.id;

                      return (
                        <tr key={activity.id} className="align-top">
                          <td className="p-3">
                            <div className="font-bold text-slate-900">
                              {activity.title}
                            </div>
                            <div className="mt-1 text-[11px] text-slate-500">
                              {CATEGORY_LABELS[activity.category]}
                            </div>
                            {activity.description && (
                              <div className="mt-1 max-w-sm text-[11px] text-slate-500">
                                {activity.description}
                              </div>
                            )}
                          </td>

                          <td className="p-3">
                            <div className="font-semibold text-slate-800">
                              {owner?.full_name || "-"}
                            </div>
                            <div className="mt-0.5 text-[10px] text-slate-500">
                              {owner?.role_level || ""}
                            </div>
                          </td>

                          <td className="p-3 text-slate-600">
                            {owner?.unit || "-"}
                          </td>

                          <td className="p-3">
                            <div
                              className={
                                isOverdue(activity)
                                  ? "font-bold text-red-700"
                                  : "text-slate-700"
                              }
                            >
                              {activity.due_date || "-"}
                            </div>
                            {activity.due_time && (
                              <div className="mt-0.5 text-[10px] text-slate-500">
                                {activity.due_time.slice(0, 5)}
                              </div>
                            )}
                          </td>

                          <td className="p-3">
                            <Badge variant="outline">
                              {PRIORITY_LABELS[activity.priority]}
                            </Badge>
                          </td>

                          <td className="p-3">
                            {activity.status === "PENDING_VALIDATION" ||
                            activity.status === "DONE" ? (
                              <Badge
                                variant={
                                  activity.status === "DONE"
                                    ? "default"
                                    : "secondary"
                                }
                              >
                                {STATUS_LABELS[activity.status]}
                              </Badge>
                            ) : (
                              <Select
                                value={activity.status}
                                onValueChange={(value) =>
                                  handleMoveStatus(
                                    activity.id,
                                    value as Exclude<
                                      UniversalActivityStatus,
                                      "PENDING_VALIDATION" | "DONE"
                                    >
                                  )
                                }
                                disabled={busyId === activity.id}
                              >
                                <SelectTrigger className="h-8 w-44 text-[11px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {MOVABLE_STATUSES.map((status) => (
                                    <SelectItem key={status} value={status}>
                                      {STATUS_LABELS[status]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </td>

                          <td className="p-3">
                            <div className="w-28">
                              <div className="mb-1 flex justify-between text-[10px] text-slate-500">
                                <span>{activity.progress}%</span>
                              </div>
                              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className="h-full rounded-full bg-blue-600"
                                  style={{
                                    width: `${Math.max(
                                      0,
                                      Math.min(100, activity.progress)
                                    )}%`,
                                  }}
                                />
                              </div>
                            </div>
                          </td>

                          <td className="p-3">
                            <div className="flex flex-wrap gap-2">
                              {awaitingMyApproval ? (
                                <>
                                  <Button
                                    size="sm"
                                    className="h-8 text-[11px]"
                                    disabled={busyId === activity.id}
                                    onClick={() =>
                                      handleReview(activity.id, true)
                                    }
                                  >
                                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                                    Approve
                                  </Button>

                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 text-[11px]"
                                    disabled={busyId === activity.id}
                                    onClick={() =>
                                      handleReview(activity.id, false)
                                    }
                                  >
                                    Return
                                  </Button>
                                </>
                              ) : !["DONE", "CANCELLED", "PENDING_VALIDATION"].includes(
                                  activity.status
                                ) ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-[11px]"
                                  disabled={busyId === activity.id}
                                  onClick={() =>
                                    handleSubmitValidation(activity.id)
                                  }
                                >
                                  <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                                  Submit Validation
                                </Button>
                              ) : (
                                <span className="text-[10px] text-slate-400">
                                  -
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Aktivitas Baru</DialogTitle>
            <DialogDescription>
              Form universal untuk Marketing dan seluruh Marketing Support.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs font-bold">
                Judul Aktivitas *
              </label>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Contoh: UAT Integrasi Privy"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold">
                Kategori *
              </label>
              <Select
                value={category}
                onValueChange={(value) =>
                  setCategory(value as ActivityCategory)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(
                    ([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold">
                Priority *
              </label>
              <Select
                value={priority}
                onValueChange={(value) =>
                  setPriority(value as ActivityPriority)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_LABELS).map(
                    ([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold">
                PIC / Owner *
              </label>
              <Select
                value={ownerProfileId}
                onValueChange={setOwnerProfileId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih owner" />
                </SelectTrigger>
                <SelectContent>
                  {directory.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.full_name} — {item.unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-[10px] text-slate-500">
                RLS akan menolak assignment ke user di luar hierarchy scope Anda.
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold">
                Tanggal Aktivitas *
              </label>
              <Input
                type="date"
                value={activityDate}
                onChange={(event) => setActivityDate(event.target.value)}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold">
                Start Time
              </label>
              <Input
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold">
                Due Date
              </label>
              <Input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold">
                Due Time
              </label>
              <Input
                type="time"
                value={dueTime}
                onChange={(event) => setDueTime(event.target.value)}
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs font-bold">
                Description / Agenda
              </label>
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Apa yang harus dikerjakan?"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs font-bold">
                Next Action
              </label>
              <Textarea
                value={nextAction}
                onChange={(event) => setNextAction(event.target.value)}
                placeholder="Tindak lanjut berikutnya"
              />
            </div>

            {isSalesConditionalCategory(category) && (
              <>
                <div>
                  <label className="mb-1.5 block text-xs font-bold">
                    Company / Customer
                  </label>
                  <Input
                    value={companyName}
                    onChange={(event) => setCompanyName(event.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold">
                    Person Met
                  </label>
                  <Input
                    value={personMet}
                    onChange={(event) => setPersonMet(event.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold">
                    Position
                  </label>
                  <Input
                    value={positionMet}
                    onChange={(event) => setPositionMet(event.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold">
                    Product
                  </label>
                  <Input
                    value={productName}
                    onChange={(event) => setProductName(event.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold">
                    Interaction Method
                  </label>
                  <Input
                    value={interactionMethod}
                    onChange={(event) => setInteractionMethod(event.target.value)}
                    placeholder="Offline / Online / Phone / Email"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold">
                    Potential Premium
                  </label>
                  <Input
                    type="number"
                    value={potentialPremium}
                    onChange={(event) => setPotentialPremium(event.target.value)}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFormOpen(false)}
              disabled={busyId === "CREATE"}
            >
              Batal
            </Button>

            <Button
              onClick={handleCreate}
              disabled={busyId === "CREATE"}
            >
              {busyId === "CREATE" ? "Menyimpan..." : "Simpan Aktivitas"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default AktivitasUniversalPage;
