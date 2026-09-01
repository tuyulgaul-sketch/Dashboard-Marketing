import React, { useEffect, useMemo, useRef, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/lib/supabase";
import ActivityMonitoringPanel from "@/components/activity/ActivityMonitoringPanel";
import ActivityPeoplePicker from "@/components/activity/ActivityPeoplePicker";
import ActivityDiscussionV2 from "@/components/activity/ActivityDiscussionV2";
import { useAuth } from "@/contexts/AuthContext";
import {
  ActivityActionRole,
  ActivityAttachmentDetail,
  ActivityCategory,
  ActivityDetailPayload,
  ActivityMode,
  ActivityPriority,
  ActivityTransitionPayload,
  ActivityValidationDecision,
  DirectoryProfile,
  UniversalActivity,
  UniversalActivityStatus,
  createUniversalActivity,
  deleteUniversalActivityAttachment,
  getActivityDirectory,
  getMyActivityActionRoles,
  getUniversalActivities,
  getUniversalActivityAttachmentUrl,
  getUniversalActivityDetail,
  reviewUniversalActivityValidationV2,
  transitionUniversalActivity,
  updateUniversalActivityProgress,
  uploadUniversalActivityAttachment,
} from "@/services/activityService";
import {
  getMyActivityAttention,
  getMyActivityDiscussionAttention,
  markActivityDiscussionSeen,
  markActivitySeen,
} from "@/services/activityAttentionService";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Eye,
  History,
  ListTodo,
  MessageSquare,
  Paperclip,
  Plus,
  RefreshCw,
  Rows3,
  Search,
  ShieldCheck,
  Trash2,
  UploadCloud,
  UserRound,
  UserRoundPlus,
  UsersRound,
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

const PRIORITY_BADGE_CLASSES: Record<ActivityPriority, string> = {
  LOW: "border-slate-200 bg-slate-50 text-slate-600",
  MEDIUM: "border-emerald-200 bg-emerald-50 text-emerald-700",
  HIGH: "border-amber-300 bg-amber-50 text-amber-800",
  URGENT: "border-red-300 bg-red-50 text-red-700",
};

const PRIORITY_CARD_CLASSES: Record<ActivityPriority, string> = {
  LOW: "border-l-4 border-l-slate-300",
  MEDIUM: "border-l-4 border-l-emerald-500",
  HIGH: "border-l-4 border-l-amber-500",
  URGENT: "border-l-4 border-l-red-600",
};

const MODE_LABELS: Record<ActivityMode, string> = {
  PERSONAL: "Task Pribadi",
  ASSIGNMENT: "Assignment ke Bawahan",
  COLLABORATION: "Kolaborasi",
};

const HISTORY_ACTION_LABELS: Record<string, string> = {
  CREATED_PERSONAL: "Task pribadi dibuat",
  CREATED_ASSIGNMENT: "Assignment dibuat",
  CREATED_COLLABORATION: "Aktivitas kolaborasi dibuat",
  STATUS_CHANGED: "Status berubah",
  SUBMIT_VALIDATION: "Diajukan untuk validasi",
  VALIDATION_APPROVED: "Validasi disetujui",
  VALIDATION_RETURNED: "Dikembalikan untuk perbaikan",
  VALIDATION_REJECTED: "Validasi ditolak / aktivitas dibatalkan",
  COMMENT_ADDED: "Komentar ditambahkan",
  PROGRESS_UPDATED: "Progress diperbarui",
  ATTACHMENT_ADDED: "Lampiran ditambahkan",
  ATTACHMENT_DELETED: "Lampiran dihapus",
  PUBLISHED: "Draft dipublish",
  WORK_STARTED: "Pekerjaan dimulai",
  WORK_RESUMED: "Pekerjaan dilanjutkan",
  WAITING_FOLLOW_UP: "Menunggu follow up",
  NEED_SUPPORT_REQUESTED: "Meminta dukungan",
  ACTIVITY_CANCELLED: "Aktivitas dibatalkan",
};

const KANBAN_STATUSES: UniversalActivityStatus[] = [
  "DRAFT",
  "TO_DO",
  "ON_PROGRESS",
  "WAITING_FOLLOW_UP",
  "NEED_SUPPORT",
  "PENDING_VALIDATION",
  "DONE",
  "CANCELLED",
];

const TRANSITION_ACTION_LABELS: Record<
  UniversalActivityStatus,
  string
> = {
  DRAFT: "Kembalikan ke Draft",
  TO_DO: "Publish / To Do",
  ON_PROGRESS: "Mulai / Lanjutkan",
  WAITING_FOLLOW_UP: "Waiting / Follow Up",
  NEED_SUPPORT: "Need Support",
  PENDING_VALIDATION: "Ajukan Validasi",
  DONE: "Approve & Done",
  CANCELLED: "Batalkan Aktivitas",
};

const ACTION_ROLE_LABELS: Record<ActivityActionRole, string> = {
  OWNER: "Assigned to You",
  COLLABORATOR: "Collaboration",
  FOLLOW_UP: "Follow Up Requested",
  SUPPORT: "Support Requested",
  APPROVER: "Awaiting Your Approval",
  CREATOR: "Draft Owner",
};

const getAllowedTransitionTargets = (
  activity: UniversalActivity,
  actionRole?: ActivityActionRole
): UniversalActivityStatus[] => {
  if (!actionRole) return [];

  if (
    activity.status === "PENDING_VALIDATION"
  ) {
    return actionRole === "APPROVER"
      ? ["DONE", "ON_PROGRESS", "CANCELLED"]
      : [];
  }

  if (
    ["COLLABORATOR", "FOLLOW_UP", "SUPPORT"].includes(
      actionRole
    )
  ) {
    return [];
  }

  if (
    activity.status === "DRAFT" &&
    actionRole !== "CREATOR"
  ) {
    return [];
  }

  if (
    activity.status !== "DRAFT" &&
    actionRole !== "OWNER"
  ) {
    return [];
  }

  if (
    ["DONE", "CANCELLED"].includes(
      activity.status
    )
  ) {
    return [];
  }

  switch (activity.status) {
    case "DRAFT":
      return ["TO_DO", "CANCELLED"];
    case "TO_DO":
      return [
        "ON_PROGRESS",
        "WAITING_FOLLOW_UP",
        "NEED_SUPPORT",
        "CANCELLED",
      ];
    case "ON_PROGRESS":
      return [
        "WAITING_FOLLOW_UP",
        "NEED_SUPPORT",
        "PENDING_VALIDATION",
        "CANCELLED",
      ];
    case "WAITING_FOLLOW_UP":
      return [
        "ON_PROGRESS",
        "NEED_SUPPORT",
        "CANCELLED",
      ];
    case "NEED_SUPPORT":
      return [
        "ON_PROGRESS",
        "WAITING_FOLLOW_UP",
        "CANCELLED",
      ];
    default:
      return [];
  }
};

type ActivityViewMode =
  | "KANBAN"
  | "LIST"
  | "CALENDAR";

type ScopeFilter =
  | "MY"
  | "TEAM"
  | "ACTION"
  | "OVERDUE"
  | "ALL";

const todayKey = () =>
  new Date().toISOString().slice(0, 10);

const MONTH_OPTIONS = [
  { value: "01", label: "Januari" },
  { value: "02", label: "Februari" },
  { value: "03", label: "Maret" },
  { value: "04", label: "April" },
  { value: "05", label: "Mei" },
  { value: "06", label: "Juni" },
  { value: "07", label: "Juli" },
  { value: "08", label: "Agustus" },
  { value: "09", label: "September" },
  { value: "10", label: "Oktober" },
  { value: "11", label: "November" },
  { value: "12", label: "Desember" },
];

const getTransitionActionLabel = (
  activity: UniversalActivity,
  targetStatus: UniversalActivityStatus
) => {
  if (activity.status === "PENDING_VALIDATION") {
    if (targetStatus === "DONE") return "Done";
    if (targetStatus === "ON_PROGRESS") return "Revisi";
    if (targetStatus === "CANCELLED") return "Reject";
  }

  return TRANSITION_ACTION_LABELS[targetStatus];
};

const isSalesConditionalCategory = (
  category: ActivityCategory
) =>
  category === "CUSTOMER_EXTERNAL" ||
  category === "TENDER_PROPOSAL";

const getOrgLabel = (profile?: DirectoryProfile | null) =>
  profile?.department || profile?.unit || "-";

const getWorkspaceDivisionLabel = (
  profile: DirectoryProfile
) => {
  const role = profile.role_level.trim().toUpperCase();
  const unit = profile.unit?.trim();

  if (role === "ADVISOR") {
    return "Direktorat Marketing / Advisor";
  }

  if (
    unit &&
    !["DIRECTORATE MARKETING", "DIREKTORAT MARKETING"].includes(
      unit.toUpperCase()
    )
  ) {
    return unit;
  }

  return profile.department?.trim() || profile.full_name;
};

const getWorkspaceBranchLabel = (
  profile: DirectoryProfile
) =>
  profile.department?.trim() ||
  profile.unit?.trim() ||
  `${profile.full_name} — ${profile.role_level}`;

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";

  const date = new Date(value);

  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDateOnly = (value?: string | null) => {
  if (!value) return "-";

  return new Date(`${value}T00:00:00`).toLocaleDateString(
    "id-ID",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
};

const formatRupiah = (value?: number | null) => {
  if (value === null || value === undefined) return "-";

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
};

const AktivitasUniversalPage: React.FC = () => {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkHandledRef = useRef<string | null>(null);
  const [unseenCountByActivityId, setUnseenCountByActivityId] =
    useState<Record<string, number>>({});
  const [
    discussionUnreadCountByActivityId,
    setDiscussionUnreadCountByActivityId,
  ] = useState<Record<string, number>>({});

  const [activities, setActivities] = useState<UniversalActivity[]>([]);
  const [directory, setDirectory] = useState<DirectoryProfile[]>([]);
  const [actionRoleByActivityId, setActionRoleByActivityId] =
    useState<Record<string, ActivityActionRole>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState("");

  const [scope, setScope] = useState<ScopeFilter>("TEAM");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [query, setQuery] = useState("");
  const [periodYear, setPeriodYear] = useState<string>("ALL");
  const [periodMonth, setPeriodMonth] = useState<string>("ALL");
  const [workspaceDivisionId, setWorkspaceDivisionId] =
    useState<string>("ALL");
  const [workspaceBranchId, setWorkspaceBranchId] =
    useState<string>("ALL");
  const [workspacePicId, setWorkspacePicId] =
    useState<string>("ALL");

  const [activityMode, setActivityMode] =
    useState<ActivityMode>("PERSONAL");
  const [title, setTitle] = useState("");
  const [category, setCategory] =
    useState<ActivityCategory>("INTERNAL_COORDINATION");
  const [priority, setPriority] =
    useState<ActivityPriority>("MEDIUM");
  const [ownerProfileId, setOwnerProfileId] = useState("");
  const [activityDate, setActivityDate] = useState(todayKey());
  const [dueDate, setDueDate] = useState(todayKey());
  const [description, setDescription] = useState("");
  const [nextAction, setNextAction] = useState("");

  const [collaboratorIds, setCollaboratorIds] =
    useState<string[]>([]);

  const [companyName, setCompanyName] = useState("");
  const [personMet, setPersonMet] = useState("");
  const [positionMet, setPositionMet] = useState("");
  const [productName, setProductName] = useState("");
  const [interactionMethod, setInteractionMethod] = useState("");
  const [potentialPremium, setPotentialPremium] = useState("");

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] =
    useState<ActivityDetailPayload | null>(null);
  const [detailTab, setDetailTab] =
    useState<
      "overview" |
      "discussion" |
      "attachments" |
      "history"
    >("overview");

  const [viewMode, setViewMode] =
    useState<ActivityViewMode>("KANBAN");
  const [calendarMonth, setCalendarMonth] =
    useState(new Date());

  const [transitionOpen, setTransitionOpen] =
    useState(false);
  const [transitionActivity, setTransitionActivity] =
    useState<UniversalActivity | null>(null);
  const [transitionTarget, setTransitionTarget] =
    useState<UniversalActivityStatus | "">("");
  const [transitionNote, setTransitionNote] =
    useState("");
  const [transitionNextAction, setTransitionNextAction] =
    useState("");
  const [transitionFollowUpDate, setTransitionFollowUpDate] =
    useState(todayKey());
  const [transitionResult, setTransitionResult] =
    useState("");
  const [transitionCollaboratorIds, setTransitionCollaboratorIds] =
    useState<string[]>([]);

  const [progressValue, setProgressValue] = useState(0);
  const [progressBusy, setProgressBusy] = useState(false);

  const [attachmentFile, setAttachmentFile] =
    useState<File | null>(null);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [attachmentInputKey, setAttachmentInputKey] = useState(0);

  const [workspaceSection, setWorkspaceSection] =
    useState<"WORKSPACE" | "MONITORING">("WORKSPACE");

  const profileMap = useMemo(
    () =>
      new Map(
        directory.map((item) => [item.id, item])
      ),
    [directory]
  );

  const childrenMap = useMemo(() => {
    const result = new Map<string, string[]>();

    directory.forEach((item) => {
      if (!item.manager_id) return;

      const list = result.get(item.manager_id) || [];
      list.push(item.id);
      result.set(item.manager_id, list);
    });

    return result;
  }, [directory]);

  const directReports = useMemo(
    () =>
      profile
        ? directory
            .filter((item) => item.manager_id === profile.id)
            .sort((a, b) =>
              getWorkspaceBranchLabel(a).localeCompare(
                getWorkspaceBranchLabel(b),
                "id"
              )
            )
        : [],
    [directory, profile]
  );

  const hasSubordinates = directReports.length > 0;

  const profileRoleKey =
    profile?.role_level?.trim().toUpperCase() || "";

  const isDirectorWorkspace =
    profileRoleKey === "DIRECTOR" ||
    profileRoleKey === "DIREKTUR";

  const getSubtreeIds = (rootId: string) => {
    const result = new Set<string>();
    const stack = [rootId];

    while (stack.length > 0) {
      const id = stack.pop()!;

      if (result.has(id)) continue;

      result.add(id);

      const nextChildren = childrenMap.get(id) || [];
      nextChildren.forEach((childId) => stack.push(childId));
    }

    return result;
  };

  const subordinateIds = useMemo(() => {
    const result = new Set<string>();

    directReports.forEach((report) => {
      getSubtreeIds(report.id).forEach((id) => result.add(id));
    });

    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childrenMap, directReports]);

  const subordinateProfiles = useMemo(
    () =>
      directory.filter((item) =>
        subordinateIds.has(item.id)
      ),
    [directory, subordinateIds]
  );

  const workspaceDivisionOptions = useMemo(
    () =>
      isDirectorWorkspace
        ? [...directReports].sort((a, b) =>
            getWorkspaceDivisionLabel(a).localeCompare(
              getWorkspaceDivisionLabel(b),
              "id"
            )
          )
        : [],
    [directReports, isDirectorWorkspace]
  );

  const workspaceBranchOptions = useMemo(() => {
    if (!hasSubordinates) return [];

    if (!isDirectorWorkspace) {
      return directReports;
    }

    if (workspaceDivisionId === "ALL") {
      return [];
    }

    return (childrenMap.get(workspaceDivisionId) || [])
      .map((id) => profileMap.get(id))
      .filter((item): item is DirectoryProfile => Boolean(item))
      .sort((a, b) =>
        getWorkspaceBranchLabel(a).localeCompare(
          getWorkspaceBranchLabel(b),
          "id"
        )
      );
  }, [
    childrenMap,
    directReports,
    hasSubordinates,
    isDirectorWorkspace,
    profileMap,
    workspaceDivisionId,
  ]);

  const workspaceBaseOwnerIds = useMemo(() => {
    if (!hasSubordinates) {
      return null as Set<string> | null;
    }

    if (workspaceBranchId !== "ALL") {
      return getSubtreeIds(workspaceBranchId);
    }

    if (
      isDirectorWorkspace &&
      workspaceDivisionId !== "ALL"
    ) {
      return getSubtreeIds(workspaceDivisionId);
    }

    return new Set(subordinateIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    childrenMap,
    hasSubordinates,
    isDirectorWorkspace,
    subordinateIds,
    workspaceBranchId,
    workspaceDivisionId,
  ]);

  const workspacePicProfiles = useMemo(
    () =>
      workspaceBaseOwnerIds
        ? directory
            .filter((item) => workspaceBaseOwnerIds.has(item.id))
            .sort((a, b) =>
              a.full_name.localeCompare(b.full_name, "id")
            )
        : [],
    [directory, workspaceBaseOwnerIds]
  );

  const workspaceOwnerFilterIds = useMemo(() => {
    if (!hasSubordinates) {
      return null as Set<string> | null;
    }

    if (
      workspacePicId !== "ALL" &&
      subordinateIds.has(workspacePicId)
    ) {
      return new Set([workspacePicId]);
    }

    if (
      workspaceBranchId !== "ALL" ||
      (isDirectorWorkspace && workspaceDivisionId !== "ALL")
    ) {
      return workspaceBaseOwnerIds;
    }

    return null;
  }, [
    hasSubordinates,
    isDirectorWorkspace,
    subordinateIds,
    workspaceBaseOwnerIds,
    workspaceBranchId,
    workspaceDivisionId,
    workspacePicId,
  ]);

  const workspaceManagerFilterLabel =
    profileRoleKey === "VP"
      ? "Sub Unit"
      : profileRoleKey === "DH"
      ? "Tim / Bawahan"
      : profileRoleKey === "SPV"
      ? "Bawahan"
      : "Unit / Tim";

  const refresh = async (options?: { silent?: boolean }) => {
    const silent = Boolean(options?.silent);

    if (!silent) {
      setLoading(true);
      setError("");
    }

    try {
      const [
        activityRows,
        directoryRows,
        actionRoleRows,
        attentionRows,
        discussionAttentionRows,
      ] = await Promise.all([
        getUniversalActivities(),
        getActivityDirectory(),
        getMyActivityActionRoles(),
        getMyActivityAttention(profile?.id || ""),
        getMyActivityDiscussionAttention(profile?.id || ""),
      ]);

      setActivities(activityRows);
      setDirectory(directoryRows);
      setUnseenCountByActivityId(
        attentionRows.reduce<Record<string, number>>(
          (result, row) => {
            result[row.activity_id] = row.unseen_count;
            return result;
          },
          {}
        )
      );
      setDiscussionUnreadCountByActivityId(
        discussionAttentionRows.reduce<Record<string, number>>(
          (result, row) => {
            result[row.activity_id] = row.unread_count;
            return result;
          },
          {}
        )
      );

      setActionRoleByActivityId(
        actionRoleRows.reduce<
          Record<string, ActivityActionRole>
        >((result, row) => {
          result[row.activity_id] =
            row.action_role;
          return result;
        }, {})
      );

      setError("");
    } catch (err) {
      console.error(err);

      if (!silent) {
        setError(
          "Gagal membaca data aktivitas. Silakan coba Refresh kembali."
        );
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!profile) return;

    setOwnerProfileId(profile.id);

    const storedView =
      window.localStorage.getItem(
        `pertalife_activity_view_${profile.id}`
      ) as ActivityViewMode | null;

    if (
      storedView &&
      ["KANBAN", "LIST", "CALENDAR"].includes(
        storedView
      )
    ) {
      setViewMode(storedView);
    } else {
      const role =
        profile.role_level
          ?.trim()
          .toUpperCase();

      setViewMode(
        role === "VP" ||
          role === "DIRECTOR" ||
          role === "DIREKTUR"
          ? "LIST"
          : "KANBAN"
      );
    }

    void refresh();

    // Primary live path: refresh Activity + action roles immediately when
    // another user changes a task (e.g. submit validation / approve / revise).
    let realtimeRefreshTimer: number | null = null;

    const activityRealtimeChannel = supabase
      .channel(`activities-live-${profile.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "activities",
        },
        () => {
          if (realtimeRefreshTimer !== null) {
            window.clearTimeout(realtimeRefreshTimer);
          }

          realtimeRefreshTimer = window.setTimeout(() => {
            void refresh({ silent: true });
          }, 150);
        }
      )
      .subscribe();

    // Fallback: keep polling in case a Realtime connection is interrupted.
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refresh({ silent: true });
      }
    }, 10_000);

    const handleFocus = () => {
      void refresh({ silent: true });
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void refresh({ silent: true });
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(intervalId);

      if (realtimeRefreshTimer !== null) {
        window.clearTimeout(realtimeRefreshTimer);
      }

      void supabase.removeChannel(activityRealtimeChannel);

      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const changeViewMode = (
    nextView: ActivityViewMode
  ) => {
    setViewMode(nextView);

    if (profile?.id) {
      window.localStorage.setItem(
        `pertalife_activity_view_${profile.id}`,
        nextView
      );
    }
  };

  const isOverdue = (activity: UniversalActivity) =>
    Boolean(
      activity.due_date &&
        activity.due_date < todayKey() &&
        !["DONE", "CANCELLED"].includes(activity.status)
    );

  const periodYearOptions = useMemo(() => {
    const years = new Set<string>([
      String(new Date().getFullYear()),
    ]);

    activities.forEach((activity) => {
      const year = activity.activity_date?.slice(0, 4);
      if (year) years.add(year);
    });

    return Array.from(years).sort(
      (a, b) => Number(b) - Number(a)
    );
  }, [activities]);

  const periodFilteredActivities = useMemo(
    () =>
      activities.filter((activity) => {
        const activityYear =
          activity.activity_date?.slice(0, 4) || "";
        const activityMonth =
          activity.activity_date?.slice(5, 7) || "";

        if (
          periodYear !== "ALL" &&
          activityYear !== periodYear
        ) {
          return false;
        }

        if (
          periodMonth !== "ALL" &&
          activityMonth !== periodMonth
        ) {
          return false;
        }

        return true;
      }),
    [activities, periodMonth, periodYear]
  );

  const orgScopedActivities = useMemo(
    () =>
      workspaceOwnerFilterIds
        ? periodFilteredActivities.filter((activity) =>
            workspaceOwnerFilterIds.has(activity.owner_profile_id)
          )
        : periodFilteredActivities,
    [periodFilteredActivities, workspaceOwnerFilterIds]
  );

  const filteredActivities = useMemo(() => {
    const q = query.trim().toLowerCase();

    return orgScopedActivities.filter((activity) => {
      const owner = profileMap.get(activity.owner_profile_id);

      if (
        scope === "MY" &&
        activity.owner_profile_id !== profile?.id
      ) {
        return false;
      }

      if (scope === "TEAM") {
        const isHierarchyTeamMember =
          activity.owner_profile_id === profile?.id ||
          subordinateIds.has(
            activity.owner_profile_id
          );

        if (hasSubordinates) {
          if (!isHierarchyTeamMember) {
            return false;
          }
        } else {
          const viewerDepartment =
            profile?.department
              ?.trim()
              .toLowerCase() || "";

          const ownerDepartment =
            owner?.department
              ?.trim()
              .toLowerCase() || "";

          const viewerUnit =
            profile?.unit
              ?.trim()
              .toLowerCase() || "";

          const ownerUnit =
            owner?.unit
              ?.trim()
              .toLowerCase() || "";

          const sameTeam =
            viewerDepartment &&
            !["none", "null"].includes(
              viewerDepartment
            )
              ? ownerDepartment ===
                viewerDepartment
              : Boolean(
                  viewerUnit &&
                    ownerUnit ===
                      viewerUnit
                );

          if (!sameTeam) {
            return false;
          }
        }
      }

      if (
        scope === "ACTION" &&
        !actionRoleByActivityId[
          activity.id
        ]
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
          owner?.department,
          MODE_LABELS[activity.activity_mode || "PERSONAL"],
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
    actionRoleByActivityId,
    categoryFilter,
    orgScopedActivities,
    profile?.department,
    profile?.id,
    profile?.unit,
    profileMap,
    query,
    scope,
    statusFilter,
    hasSubordinates,
    subordinateIds,
  ]);


  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth);
    const monthEnd = endOfMonth(calendarMonth);

    return eachDayOfInterval({
      start: startOfWeek(monthStart, { weekStartsOn: 1 }),
      end: endOfWeek(monthEnd, { weekStartsOn: 1 }),
    });
  }, [calendarMonth]);

  const calendarActivityMap = useMemo(() => {
    const result = new Map<string, UniversalActivity[]>();

    filteredActivities.forEach((activity) => {
      const key = activity.activity_date;
      const list = result.get(key) || [];
      list.push(activity);
      result.set(key, list);
    });

    return result;
  }, [filteredActivities]);

  const myCount = periodFilteredActivities.filter(
    (activity) => activity.owner_profile_id === profile?.id
  ).length;

  const onProgressCount = orgScopedActivities.filter(
    (activity) => activity.status === "ON_PROGRESS"
  ).length;

  const overdueCount = orgScopedActivities.filter(isOverdue).length;

  const actionCount = orgScopedActivities.filter(
    (activity) =>
      Boolean(
        actionRoleByActivityId[
          activity.id
        ]
      )
  ).length;

  const unseenActivityCount = periodFilteredActivities.reduce(
    (total, activity) =>
      total +
      (unseenCountByActivityId[activity.id] > 0 ? 1 : 0),
    0
  );

  const focusActivitySummary = (
    nextScope: ScopeFilter,
    nextStatus: string = "ALL"
  ) => {
    setWorkspaceSection("WORKSPACE");
    setScope(nextScope);
    setStatusFilter(nextStatus);
    setCategoryFilter("ALL");
    setQuery("");

    if (nextScope === "OVERDUE" || nextScope === "ACTION") {
      changeViewMode("LIST");
    }

    window.setTimeout(() => {
      document
        .getElementById("activity-results")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    }, 80);
  };

  const resetForm = () => {
    setActivityMode("PERSONAL");
    setTitle("");
    setCategory("INTERNAL_COORDINATION");
    setPriority("MEDIUM");
    setOwnerProfileId(profile?.id || "");
    setActivityDate(todayKey());
    setDueDate(todayKey());
    setDescription("");
    setNextAction("");
    setCollaboratorIds([]);
    setCompanyName("");
    setPersonMet("");
    setPositionMet("");
    setProductName("");
    setInteractionMethod("");
    setPotentialPremium("");
  };

  const changeMode = (mode: ActivityMode) => {
    setActivityMode(mode);
    setCollaboratorIds([]);

    if (mode === "ASSIGNMENT") {
      setOwnerProfileId("");
    } else {
      setOwnerProfileId(profile?.id || "");
    }
  };

  const handleCreate = async (
    initialStatus: "DRAFT" | "TO_DO" = "TO_DO"
  ) => {
    if (!profile) return;

    if (!title.trim()) {
      window.alert("Judul aktivitas wajib diisi.");
      return;
    }

    if (!description.trim()) {
      window.alert("Description / Agenda wajib diisi.");
      return;
    }

    if (!nextAction.trim()) {
      window.alert("Next Action wajib diisi.");
      return;
    }

    if (
      activityMode === "ASSIGNMENT" &&
      !ownerProfileId
    ) {
      window.alert("Pilih bawahan yang menjadi PIC.");
      return;
    }

    if (
      activityMode === "COLLABORATION" &&
      collaboratorIds.length === 0
    ) {
      window.alert(
        "Mode Kolaborasi membutuhkan minimal 1 kolaborator."
      );
      return;
    }

    try {
      setBusyId("CREATE");

      await createUniversalActivity({
        activity_mode: activityMode,
        initial_status: initialStatus,
        title,
        category,
        priority,
        owner_profile_id:
          activityMode === "ASSIGNMENT"
            ? ownerProfileId
            : profile.id,
        activity_date: activityDate,
        due_date: dueDate || undefined,
        description: description.trim(),
        next_action: nextAction.trim(),
        collaborator_ids: collaboratorIds,
        company_name: companyName,
        person_met: personMet,
        position_met: positionMet,
        product_name: productName,
        interaction_method: interactionMethod,
        potential_premium: potentialPremium
          ? Number(potentialPremium)
          : null,
      });

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

  const requestTransition = (
    activity: UniversalActivity,
    targetStatus?: UniversalActivityStatus
  ) => {
    const actionRole =
      actionRoleByActivityId[
        activity.id
      ];

    const allowedTargets =
      getAllowedTransitionTargets(
        activity,
        actionRole
      );

    if (allowedTargets.length === 0) {
      window.alert(
        "Anda hanya memiliki akses observer pada aktivitas ini."
      );
      return;
    }

    if (
      targetStatus &&
      !allowedTargets.includes(
        targetStatus
      )
    ) {
      window.alert(
        "Perpindahan status tersebut tidak diizinkan oleh flow aktivitas."
      );
      return;
    }

    setTransitionActivity(
      activity
    );
    setTransitionTarget(
      targetStatus ||
        (
          allowedTargets.length === 1
            ? allowedTargets[0]
            : ""
        )
    );
    setTransitionNote("");
    setTransitionNextAction(
      activity.next_action || ""
    );
    setTransitionFollowUpDate(
      activity.follow_up_date ||
        todayKey()
    );
    setTransitionResult(
      activity.result || ""
    );
    setTransitionCollaboratorIds([]);
    setTransitionOpen(true);
  };

  const handleConfirmTransition =
    async () => {
      if (
        !transitionActivity ||
        !transitionTarget
      ) {
        return;
      }

      const payload:
        ActivityTransitionPayload = {
        note:
          transitionNote.trim(),
        next_action:
          transitionNextAction.trim(),
        follow_up_date:
          transitionFollowUpDate,
        result:
          transitionResult.trim(),
        collaborator_ids:
          transitionCollaboratorIds,
      };

      if (
        transitionTarget ===
          "WAITING_FOLLOW_UP" &&
        (
          !payload.note ||
          !payload.next_action ||
          !payload.follow_up_date
        )
      ) {
        window.alert(
          "Waiting / Follow Up membutuhkan alasan, Next Action, dan tanggal follow up."
        );
        return;
      }

      if (
        transitionTarget ===
          "NEED_SUPPORT" &&
        !payload.note
      ) {
        window.alert(
          "Jelaskan dukungan yang dibutuhkan."
        );
        return;
      }

      if (
        transitionTarget ===
          "NEED_SUPPORT" &&
        transitionCollaboratorIds.length === 0
      ) {
        window.alert(
          "Pilih minimal 1 user yang dibutuhkan untuk membantu menyelesaikan task ini."
        );
        return;
      }

      if (
        transitionTarget ===
          "CANCELLED" &&
        !payload.note
      ) {
        window.alert(
          "Alasan pembatalan wajib diisi."
        );
        return;
      }

      if (
        transitionTarget ===
          "PENDING_VALIDATION" &&
        (
          !payload.result ||
          payload.result.length < 3
        )
      ) {
        window.alert(
          "Ringkasan hasil aktivitas wajib diisi sebelum Ajukan Validasi."
        );
        return;
      }

      if (
        transitionActivity.status ===
          "PENDING_VALIDATION" &&
        ["DONE", "ON_PROGRESS", "CANCELLED"].includes(
          transitionTarget
        ) &&
        !payload.note
      ) {
        window.alert(
          "Remark wajib diisi untuk Done, Revisi, maupun Reject."
        );
        return;
      }

      try {
        setBusyId(
          transitionActivity.id
        );

        if (
          transitionActivity.status ===
          "PENDING_VALIDATION" &&
          ["DONE", "ON_PROGRESS", "CANCELLED"].includes(
            transitionTarget
          )
        ) {
          const decision: ActivityValidationDecision =
            transitionTarget === "DONE"
              ? "DONE"
              : transitionTarget === "ON_PROGRESS"
              ? "REVISE"
              : "REJECT";

          await reviewUniversalActivityValidationV2(
            transitionActivity.id,
            decision,
            payload.note || ""
          );
        } else {
          await transitionUniversalActivity(
            transitionActivity.id,
            transitionTarget,
            payload
          );
        }

        const transitionedId =
          transitionActivity.id;

        setTransitionOpen(false);
        setTransitionActivity(null);
        setTransitionTarget("");
        setTransitionCollaboratorIds([]);
        await refresh();

        if (
          detail?.activity.id ===
          transitionedId
        ) {
          await openActivityDetail(
            transitionedId
          );
        }
      } catch (err: any) {
        console.error(err);
        window.alert(
          err?.message ||
            "Gagal memproses perpindahan status."
        );
      } finally {
        setBusyId(null);
      }
    };

  const findActivity = (
    activityId: string
  ) =>
    activities.find(
      (activity) =>
        activity.id ===
        activityId
    ) ||
    (
      detail?.activity.id ===
      activityId
        ? detail.activity
        : null
    );

  const handleMoveStatus = (
    activityId: string,
    status: UniversalActivityStatus
  ) => {
    const activity =
      findActivity(
        activityId
      );

    if (!activity) return;

    requestTransition(
      activity,
      status
    );
  };

  const handleSubmitValidation = (
    activityId: string
  ) => {
    const activity =
      findActivity(
        activityId
      );

    if (!activity) return;

    requestTransition(
      activity,
      "PENDING_VALIDATION"
    );
  };

  const handleReview = (
    activityId: string,
    approve: boolean
  ) => {
    const activity =
      findActivity(
        activityId
      );

    if (!activity) return;

    requestTransition(
      activity,
      approve
        ? "DONE"
        : "ON_PROGRESS"
    );
  };

  const handleKanbanDrop = (
    activityId: string,
    targetStatus: UniversalActivityStatus
  ) => {
    const activity =
      findActivity(
        activityId
      );

    if (
      !activity ||
      activity.status ===
        targetStatus
    ) {
      return;
    }

    requestTransition(
      activity,
      targetStatus
    );
  };

  const openActivityDetail = async (activityId: string) => {
    setDetailOpen(true);
    setDetailLoading(true);

    try {
      const nextDetail =
        await getUniversalActivityDetail(activityId);

      if (profile?.id) {
        await markActivitySeen(
          activityId,
          profile.id
        );

        setUnseenCountByActivityId((current) => ({
          ...current,
          [activityId]: 0,
        }));
      }

      setDetail(nextDetail);
      setProgressValue(nextDetail.activity.progress);
    } catch (err: any) {
      console.error(err);
      window.alert(
        err?.message || "Gagal membuka detail aktivitas."
      );
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const deepLinkedTaskId =
    searchParams.get("task");

  useEffect(() => {
    if (
      !profile?.id ||
      !deepLinkedTaskId ||
      deepLinkHandledRef.current === deepLinkedTaskId
    ) {
      return;
    }

    deepLinkHandledRef.current = deepLinkedTaskId;

    if (
      requestedDetailTab === "discussion"
    ) {
      setDetailTab("discussion");
    }

    void openActivityDetail(deepLinkedTaskId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkedTaskId, profile?.id]);

  const requestedDetailTab =
    searchParams.get("tab");

  const requestedCommentId =
    searchParams.get("comment");


  useEffect(() => {
    if (
      detailTab !== "discussion" ||
      !detail?.activity.id ||
      !profile?.id
    ) {
      return;
    }

    const detailActivityId = detail.activity.id;
    let cancelled = false;

    void (async () => {
      try {
        const refreshed =
          await getUniversalActivityDetail(
            detailActivityId
          );

        if (!cancelled) {
          setDetail(refreshed);
        }

        await markActivityDiscussionSeen(detailActivityId);

        if (!cancelled) {
          setDiscussionUnreadCountByActivityId(
            (current) => ({
              ...current,
              [detailActivityId]: 0,
            })
          );
        }
      } catch (error) {
        console.warn(
          "Gagal memperbarui status read Discussion:",
          error
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    detailTab,
    detail?.activity.id,
    profile?.id,
  ]);


  const handleUpdateProgress = async () => {
    if (!detail) return;

    try {
      setProgressBusy(true);

      await updateUniversalActivityProgress(
        detail.activity.id,
        progressValue
      );

      await refresh();

      const refreshed =
        await getUniversalActivityDetail(
          detail.activity.id
        );

      setDetail(refreshed);
      setProgressValue(refreshed.activity.progress);
    } catch (err: any) {
      console.error(err);
      window.alert(
        err?.message || "Gagal mengubah progress."
      );
    } finally {
      setProgressBusy(false);
    }
  };

  const handleUploadAttachment = async () => {
    if (!detail || !attachmentFile) return;

    try {
      setAttachmentBusy(true);

      await uploadUniversalActivityAttachment(
        detail.activity.id,
        attachmentFile
      );

      setAttachmentFile(null);
      setAttachmentInputKey((value) => value + 1);

      const refreshed =
        await getUniversalActivityDetail(
          detail.activity.id
        );

      setDetail(refreshed);
    } catch (err: any) {
      console.error(err);
      window.alert(
        err?.message || "Gagal mengunggah lampiran."
      );
    } finally {
      setAttachmentBusy(false);
    }
  };

  const handleDownloadAttachment = async (
    attachment: ActivityAttachmentDetail
  ) => {
    try {
      const signedUrl =
        await getUniversalActivityAttachmentUrl(
          attachment.storage_path
        );

      window.open(
        signedUrl,
        "_blank",
        "noopener,noreferrer"
      );
    } catch (err: any) {
      console.error(err);
      window.alert(
        err?.message || "Gagal membuka lampiran."
      );
    }
  };

  const handleDeleteAttachment = async (
    attachment: ActivityAttachmentDetail
  ) => {
    if (
      !window.confirm(
        `Hapus lampiran "${attachment.file_name}"?`
      )
    ) {
      return;
    }

    try {
      setAttachmentBusy(true);

      await deleteUniversalActivityAttachment(
        attachment.id
      );

      if (!detail) return;

      const refreshed =
        await getUniversalActivityDetail(
          detail.activity.id
        );

      setDetail(refreshed);
    } catch (err: any) {
      console.error(err);
      window.alert(
        err?.message || "Gagal menghapus lampiran."
      );
    } finally {
      setAttachmentBusy(false);
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
              Task pribadi, assignment ke bawahan, dan kolaborasi
              lintas department dalam satu modul.
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

        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2">
          <Button
            type="button"
            size="sm"
            variant={
              workspaceSection === "WORKSPACE"
                ? "default"
                : "ghost"
            }
            onClick={() =>
              setWorkspaceSection("WORKSPACE")
            }
          >
            <Rows3 className="mr-2 h-4 w-4" />
            Activity Workspace
          </Button>

          <Button
            type="button"
            size="sm"
            variant={
              workspaceSection === "MONITORING"
                ? "default"
                : "ghost"
            }
            onClick={() =>
              setWorkspaceSection("MONITORING")
            }
          >
            <AlertTriangle className="mr-2 h-4 w-4" />
            Monitoring & Alerts
          </Button>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <CalendarDays className="h-4 w-4 text-blue-700" />
                  Periode Aktivitas
                </div>

                <div className="mt-1 text-[11px] text-slate-500">
                  Filter memakai Activity Date dan berlaku sekaligus untuk Activity Workspace serta Monitoring & Alerts.
                </div>
              </div>

              <div className="grid w-full gap-2 sm:grid-cols-[170px_190px_auto] lg:w-auto">
                <Select
                  value={periodYear}
                  onValueChange={(value) => {
                    setPeriodYear(value);

                    if (value === "ALL") {
                      setPeriodMonth("ALL");
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih Tahun" />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="ALL">
                      Semua Tahun
                    </SelectItem>

                    {periodYearOptions.map((year) => (
                      <SelectItem
                        key={year}
                        value={year}
                      >
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={periodMonth}
                  onValueChange={setPeriodMonth}
                  disabled={periodYear === "ALL"}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        periodYear === "ALL"
                          ? "Pilih Tahun dulu"
                          : "Pilih Bulan"
                      }
                    />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="ALL">
                      Semua Bulan
                    </SelectItem>

                    {MONTH_OPTIONS.map((month) => (
                      <SelectItem
                        key={month.value}
                        value={month.value}
                      >
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setPeriodYear("ALL");
                    setPeriodMonth("ALL");
                  }}
                  disabled={
                    periodYear === "ALL" &&
                    periodMonth === "ALL"
                  }
                >
                  Reset Periode
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {workspaceSection === "WORKSPACE" ? (
          <>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card
            role="button"
            tabIndex={0}
            title="Klik untuk lihat task"
            className="cursor-pointer transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            onClick={() => focusActivitySummary("MY")}
          >
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

          <Card
            role="button"
            tabIndex={0}
            title="Klik untuk lihat task"
            className="cursor-pointer transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-amber-500/30"
            onClick={() => focusActivitySummary("ALL", "ON_PROGRESS")}
          >
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

          <Card
            role="button"
            tabIndex={0}
            title="Klik untuk lihat task overdue"
            className="cursor-pointer transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-red-500/30"
            onClick={() => focusActivitySummary("OVERDUE")}
          >
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

          <Card
            role="button"
            tabIndex={0}
            title="Klik untuk proses task"
            className="cursor-pointer transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            onClick={() => focusActivitySummary("ACTION")}
          >
            <CardContent className="flex items-center gap-3 p-5">
              <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700">
                <ShieldCheck className="h-5 w-5" />
              </div>

              <div>
                <div className="text-2xl font-black text-slate-900">
                  {actionCount}
                </div>

                <div className="text-xs text-slate-500">
                  Need My Action
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card id="activity-results">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-sm">
                  Aktivitas
                </CardTitle>

                {unseenActivityCount > 0 && (
                  <Badge className="border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50">
                    {unseenActivityCount} belum dilihat
                  </Badge>
                )}
              </div>

              <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1">
                <Button
                  type="button"
                  size="sm"
                  variant={
                    viewMode === "KANBAN"
                      ? "default"
                      : "ghost"
                  }
                  className="h-8"
                  onClick={() =>
                    changeViewMode(
                      "KANBAN"
                    )
                  }
                >
                  <ListTodo className="mr-1.5 h-4 w-4" />
                  Kanban
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant={
                    viewMode === "LIST"
                      ? "default"
                      : "ghost"
                  }
                  className="h-8"
                  onClick={() =>
                    changeViewMode(
                      "LIST"
                    )
                  }
                >
                  <Rows3 className="mr-1.5 h-4 w-4" />
                  List
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant={
                    viewMode === "CALENDAR"
                      ? "default"
                      : "ghost"
                  }
                  className="h-8"
                  onClick={() =>
                    changeViewMode(
                      "CALENDAR"
                    )
                  }
                >
                  <CalendarDays className="mr-1.5 h-4 w-4" />
                  Calendar
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {hasSubordinates && (
              <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  Filter Organisasi
                </div>

                <div
                  className={`grid gap-3 ${
                    isDirectorWorkspace
                      ? "md:grid-cols-3"
                      : "md:grid-cols-2"
                  }`}
                >
                  {isDirectorWorkspace && (
                    <Select
                      value={workspaceDivisionId}
                      onValueChange={(value) => {
                        setWorkspaceDivisionId(value);
                        setWorkspaceBranchId("ALL");
                        setWorkspacePicId("ALL");
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih Divisi" />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItem value="ALL">
                          Semua Divisi
                        </SelectItem>

                        {workspaceDivisionOptions.map((division) => (
                          <SelectItem
                            key={division.id}
                            value={division.id}
                          >
                            {getWorkspaceDivisionLabel(division)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  <Select
                    value={workspaceBranchId}
                    onValueChange={(value) => {
                      setWorkspaceBranchId(value);
                      setWorkspacePicId("ALL");
                    }}
                    disabled={
                      isDirectorWorkspace &&
                      workspaceDivisionId === "ALL"
                    }
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          isDirectorWorkspace
                            ? workspaceDivisionId === "ALL"
                              ? "Pilih Divisi dulu"
                              : "Pilih Sub Unit"
                            : `Pilih ${workspaceManagerFilterLabel}`
                        }
                      />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="ALL">
                        {isDirectorWorkspace
                          ? "Semua Sub Unit"
                          : `Semua ${workspaceManagerFilterLabel}`}
                      </SelectItem>

                      {workspaceBranchOptions.map((branch) => (
                        <SelectItem
                          key={branch.id}
                          value={branch.id}
                        >
                          {getWorkspaceBranchLabel(branch)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={workspacePicId}
                    onValueChange={setWorkspacePicId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih PIC" />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="ALL">
                        Semua PIC
                      </SelectItem>

                      {workspacePicProfiles.map((person) => (
                        <SelectItem
                          key={person.id}
                          value={person.id}
                        >
                          {person.full_name} — {getOrgLabel(person)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="mt-2 text-[10px] text-slate-500">
                  Filter hanya mempersempit aktivitas yang memang sudah boleh dilihat berdasarkan hierarchy akun.
                </div>
              </div>
            )}

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

            {viewMode === "KANBAN" ? (
              <div className="overflow-x-auto pb-2">
                {statusFilter === "CANCELLED" ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                    Aktivitas Cancelled disimpan sebagai archive. Gunakan List View untuk melihatnya.
                  </div>
                ) : (
                  <div className="grid min-w-max auto-cols-[290px] grid-flow-col gap-3">
                    {KANBAN_STATUSES.map((bucketStatus) => {
                      const bucketItems =
                        filteredActivities.filter(
                          (activity) =>
                            activity.status === bucketStatus
                        );

                      return (
                        <div
                          key={bucketStatus}
                          className="flex min-h-[420px] w-[290px] flex-col rounded-xl border border-slate-200 bg-slate-50/80"
                          onDragOver={(event) => {
                            event.preventDefault();
                            event.dataTransfer.dropEffect = "move";
                          }}
                          onDrop={(event) => {
                            event.preventDefault();
                            const activityId =
                              event.dataTransfer.getData(
                                "text/activity-id"
                              );

                            if (activityId) {
                              handleKanbanDrop(
                                activityId,
                                bucketStatus
                              );
                            }
                          }}
                        >
                          <div className="flex items-center justify-between border-b border-slate-200 px-3 py-3">
                            <div className="text-[11px] font-black uppercase tracking-wide text-slate-700">
                              {STATUS_LABELS[bucketStatus]}
                            </div>

                            <div className="flex items-center gap-1.5">
                              {bucketItems.some(
                                (activity) =>
                                  (unseenCountByActivityId[
                                    activity.id
                                  ] || 0) > 0
                              ) && (
                                <Badge className="border border-blue-200 bg-blue-50 text-[9px] text-blue-700 hover:bg-blue-50">
                                  {
                                    bucketItems.filter(
                                      (activity) =>
                                        (unseenCountByActivityId[
                                          activity.id
                                        ] || 0) > 0
                                    ).length
                                  } baru
                                </Badge>
                              )}

                              <Badge variant="secondary">
                                {bucketItems.length}
                              </Badge>
                            </div>
                          </div>

                          <div className="flex-1 space-y-3 p-3">
                            {bucketItems.length === 0 ? (
                              <div className="rounded-lg border border-dashed border-slate-200 bg-white/70 p-4 text-center text-[11px] text-slate-400">
                                Drop task ke sini jika flow mengizinkan.
                              </div>
                            ) : (
                              bucketItems.map((activity) => {
                                const owner =
                                  profileMap.get(
                                    activity.owner_profile_id
                                  );

                                const unseenCount =
                                  unseenCountByActivityId[
                                    activity.id
                                  ] || 0;

                                const discussionUnreadCount =
                                  discussionUnreadCountByActivityId[
                                    activity.id
                                  ] || 0;

                                const actionRole =
                                  actionRoleByActivityId[
                                    activity.id
                                  ];

                                const allowedTargets =
                                  getAllowedTransitionTargets(
                                    activity,
                                    actionRole
                                  );

                                const canDrag =
                                  allowedTargets.length > 0;

                                const actionBadgeLabel =
                                  actionRole === "OWNER" &&
                                  activity.status === "ON_PROGRESS" &&
                                  Boolean(activity.validation_notes)
                                    ? "Returned to You"
                                    : actionRole
                                    ? ACTION_ROLE_LABELS[actionRole]
                                    : "Observer";

                                return (
                                  <div
                                    key={activity.id}
                                    draggable={canDrag}
                                    role="button"
                                    tabIndex={0}
                                    aria-label={`Buka detail aktivitas ${activity.title}`}
                                    onClick={() =>
                                      openActivityDetail(
                                        activity.id
                                      )
                                    }
                                    onKeyDown={(event) => {
                                      if (
                                        event.key === "Enter" ||
                                        event.key === " "
                                      ) {
                                        event.preventDefault();
                                        openActivityDetail(
                                          activity.id
                                        );
                                      }
                                    }}
                                    onDragStart={(event) => {
                                      if (!canDrag) {
                                        event.preventDefault();
                                        return;
                                      }

                                      event.dataTransfer.effectAllowed =
                                        "move";
                                      event.dataTransfer.setData(
                                        "text/activity-id",
                                        activity.id
                                      );
                                    }}
                                    className={`group rounded-xl border p-3 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${PRIORITY_CARD_CLASSES[activity.priority]} ${
                                      unseenCount > 0
                                        ? "bg-slate-100 border-slate-300 shadow-md"
                                        : "bg-white"
                                    } ${
                                      canDrag
                                        ? "cursor-grab border-slate-200 hover:border-blue-300 hover:shadow-md active:cursor-grabbing"
                                        : "cursor-pointer border-slate-200 hover:border-blue-300 hover:shadow-md"
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0 flex-1 text-left">
                                        <div className="line-clamp-2 text-xs font-bold text-slate-900 group-hover:text-blue-700">
                                          {activity.title}
                                        </div>
                                      </div>

                                      <Badge
                                        variant="outline"
                                        className={`shrink-0 gap-1 text-[9px] ${PRIORITY_BADGE_CLASSES[activity.priority]}`}
                                      >
                                        {activity.priority === "URGENT" && (
                                          <AlertTriangle className="h-3 w-3" />
                                        )}
                                        {activity.priority === "HIGH" && (
                                          <span className="font-black">!</span>
                                        )}
                                        {
                                          PRIORITY_LABELS[
                                            activity.priority
                                          ]
                                        }
                                      </Badge>
                                    </div>

                                    {unseenCount > 0 && (
                                      <div className="mt-2">
                                        <Badge className="border border-blue-200 bg-blue-50 text-[9px] text-blue-700 hover:bg-blue-50">
                                          <span className="mr-1 h-1.5 w-1.5 rounded-full bg-blue-600" />
                                          {unseenCount} update baru
                                        </Badge>
                                      </div>
                                    )}

                                    {discussionUnreadCount > 0 && (
                                      <div className="mt-2">
                                        <Badge className="border border-red-200 bg-red-50 text-[9px] font-bold text-red-700 hover:bg-red-50">
                                          <span className="mr-1 h-2 w-2 rounded-full bg-red-600" />
                                          {discussionUnreadCount} komentar unread
                                        </Badge>
                                      </div>
                                    )}

                                    <div className="mt-2 text-[10px] text-slate-500">
                                      {owner?.full_name || "-"}
                                      {" • "}
                                      {getOrgLabel(owner)}
                                    </div>

                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                      <Badge
                                        variant="outline"
                                        className="text-[9px]"
                                      >
                                        {
                                          MODE_LABELS[
                                            activity.activity_mode ||
                                              "PERSONAL"
                                          ]
                                        }
                                      </Badge>

                                      <Badge
                                        variant="outline"
                                        className={
                                          actionRole
                                            ? "border-blue-200 bg-blue-50 text-[9px] text-blue-700"
                                            : "text-[9px] text-slate-500"
                                        }
                                      >
                                        {actionBadgeLabel}
                                      </Badge>
                                    </div>

                                    <div className="mt-3">
                                      <div className="mb-1 flex items-center justify-between text-[10px] text-slate-500">
                                        <span>
                                          Progress
                                        </span>
                                        <span className="font-bold text-slate-700">
                                          {activity.progress}%
                                        </span>
                                      </div>

                                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                                        <div
                                          className="h-full rounded-full bg-blue-600"
                                          style={{
                                            width: `${Math.max(
                                              0,
                                              Math.min(
                                                100,
                                                activity.progress
                                              )
                                            )}%`,
                                          }}
                                        />
                                      </div>
                                    </div>

                                    <div className="mt-3 flex items-center justify-between gap-2">
                                      <div
                                        className={`text-[10px] ${
                                          isOverdue(activity)
                                            ? "font-bold text-red-700"
                                            : "text-slate-500"
                                        }`}
                                      >
                                        Due:{" "}
                                        {formatDateOnly(
                                          activity.due_date
                                        )}
                                      </div>

                                      {allowedTargets.length > 0 && (
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          className="h-7 px-2 text-[10px]"
                                          disabled={
                                            busyId === activity.id
                                          }
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            requestTransition(
                                              activity
                                            );
                                          }}
                                        >
                                          Aksi
                                        </Button>
                                      )}
                                    </div>

                                    {activity.status_note && (
                                      <div className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-[10px] leading-4 text-amber-800">
                                        {activity.status_note}
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : viewMode === "LIST" ? (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[1280px] text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
                    <tr>
                      <th className="p-3">Aktivitas</th>
                      <th className="p-3">Mode</th>
                      <th className="p-3">Owner</th>
                      <th className="p-3">Department</th>
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
                        <td colSpan={9} className="p-8 text-center text-slate-500">
                          Memuat aktivitas...
                        </td>
                      </tr>
                    ) : filteredActivities.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-slate-500">
                          Belum ada aktivitas pada filter ini.
                        </td>
                      </tr>
                    ) : (
                      filteredActivities.map((activity) => {
                        const owner =
                          profileMap.get(activity.owner_profile_id);

                        const unseenCount =
                          unseenCountByActivityId[
                            activity.id
                          ] || 0;

                                const discussionUnreadCount =
                                  discussionUnreadCountByActivityId[
                                    activity.id
                                  ] || 0;

                        const awaitingMyApproval =
                          activity.status === "PENDING_VALIDATION" &&
                          activity.validation_approver_profile_id === profile?.id;

                        const actionRole =
                          actionRoleByActivityId[
                            activity.id
                          ];

                        const allowedTargets =
                          getAllowedTransitionTargets(
                            activity,
                            actionRole
                          );

                        const actionBadgeLabel =
                          actionRole === "OWNER" &&
                          activity.status === "ON_PROGRESS" &&
                          Boolean(activity.validation_notes)
                            ? "Returned to You"
                            : actionRole
                            ? ACTION_ROLE_LABELS[actionRole]
                            : "Observer";

                        return (
                          <tr
                            key={activity.id}
                            className={`align-top transition ${PRIORITY_CARD_CLASSES[activity.priority]} ${
                              unseenCount > 0
                                ? "bg-slate-100/90 hover:bg-slate-100"
                                : "hover:bg-slate-50/60"
                            }`}
                          >
                            <td className="p-3">
                              <button
                                type="button"
                                onClick={() =>
                                  openActivityDetail(activity.id)
                                }
                                className="text-left"
                              >
                                <div className="font-bold text-slate-900 hover:text-blue-700">
                                  {activity.title}
                                </div>
                              </button>

                              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                                <span>
                                  {CATEGORY_LABELS[activity.category]}
                                </span>

                                {unseenCount > 0 && (
                                  <Badge className="border border-blue-200 bg-blue-50 text-[9px] text-blue-700 hover:bg-blue-50">
                                    {unseenCount} baru
                                  </Badge>
                                )}

                                {discussionUnreadCount > 0 && (
                                  <Badge className="border border-red-200 bg-red-50 text-[9px] font-bold text-red-700 hover:bg-red-50">
                                    <span className="mr-1 h-2 w-2 rounded-full bg-red-600" />
                                    {discussionUnreadCount} unread
                                  </Badge>
                                )}
                              </div>

                              {activity.description && (
                                <div className="mt-1 max-w-sm text-[11px] text-slate-500">
                                  {activity.description}
                                </div>
                              )}
                            </td>

                            <td className="p-3">
                              <Badge variant="outline">
                                {MODE_LABELS[activity.activity_mode || "PERSONAL"]}
                              </Badge>
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
                              {getOrgLabel(owner)}
                            </td>

                            <td className="p-3">
                              <div
                                className={
                                  isOverdue(activity)
                                    ? "font-bold text-red-700"
                                    : "text-slate-700"
                                }
                              >
                                {formatDateOnly(activity.due_date)}
                              </div>
                            </td>

                            <td className="p-3">
                              <Badge
                                variant="outline"
                                className={`gap-1 ${PRIORITY_BADGE_CLASSES[activity.priority]}`}
                              >
                                {activity.priority === "URGENT" && (
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                )}
                                {activity.priority === "HIGH" && (
                                  <span className="font-black">!</span>
                                )}
                                {PRIORITY_LABELS[activity.priority]}
                              </Badge>
                            </td>

                            <td className="p-3">
                              <div className="space-y-1.5">
                                <Badge
                                  variant={
                                    activity.status === "DONE"
                                      ? "default"
                                      : activity.status === "PENDING_VALIDATION"
                                      ? "secondary"
                                      : "outline"
                                  }
                                >
                                  {STATUS_LABELS[activity.status]}
                                </Badge>

                                <div>
                                  <Badge
                                    variant="outline"
                                    className={
                                      actionRole
                                        ? "border-blue-200 bg-blue-50 text-[9px] text-blue-700"
                                        : "text-[9px] text-slate-500"
                                    }
                                  >
                                    {actionBadgeLabel}
                                  </Badge>
                                </div>
                              </div>
                            </td>

                            <td className="p-3">
                              <div className="w-28">
                                <div className="mb-1 text-[10px] text-slate-500">
                                  {activity.progress}%
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
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 text-[11px]"
                                  onClick={() =>
                                    openActivityDetail(activity.id)
                                  }
                                >
                                  <Eye className="mr-1 h-3.5 w-3.5" />
                                  Detail
                                </Button>

                                {allowedTargets.length > 0 ? (
                                  <Button
                                    size="sm"
                                    variant={
                                      awaitingMyApproval
                                        ? "default"
                                        : "outline"
                                    }
                                    className="h-8 text-[11px]"
                                    disabled={busyId === activity.id}
                                    onClick={() =>
                                      requestTransition(activity)
                                    }
                                  >
                                    {awaitingMyApproval ? (
                                      <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                                    ) : (
                                      <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                                    )}
                                    {awaitingMyApproval
                                      ? "Review"
                                      : "Aksi Status"}
                                  </Button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setCalendarMonth((month) =>
                        subMonths(month, 1)
                      )
                    }
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  <div className="text-sm font-bold text-slate-900">
                    {format(
                      calendarMonth,
                      "MMMM yyyy",
                      { locale: idLocale }
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setCalendarMonth(new Date())
                      }
                    >
                      Hari ini
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setCalendarMonth((month) =>
                          addMonths(month, 1)
                        )
                      }
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <div className="min-w-[900px]">
                    <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
                      {[
                        "Sen",
                        "Sel",
                        "Rab",
                        "Kam",
                        "Jum",
                        "Sab",
                        "Min",
                      ].map((dayName) => (
                        <div
                          key={dayName}
                          className="px-3 py-2 text-center text-[10px] font-bold uppercase text-slate-500"
                        >
                          {dayName}
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-7">
                      {calendarDays.map((day) => {
                        const key = format(day, "yyyy-MM-dd");
                        const dayActivities =
                          calendarActivityMap.get(key) || [];

                        return (
                          <div
                            key={key}
                            className={`min-h-[132px] border-b border-r border-slate-100 p-2 ${
                              isSameMonth(day, calendarMonth)
                                ? "bg-white"
                                : "bg-slate-50/70"
                            }`}
                          >
                            <div
                              className={`mb-2 text-xs font-bold ${
                                key === todayKey()
                                  ? "inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white"
                                  : isSameMonth(day, calendarMonth)
                                  ? "text-slate-800"
                                  : "text-slate-400"
                              }`}
                            >
                              {format(day, "d")}
                            </div>

                            <div className="space-y-1">
                              {dayActivities.slice(0, 3).map((activity) => {
                                const owner =
                                  profileMap.get(
                                    activity.owner_profile_id
                                  );

                                const unseenCount =
                                  unseenCountByActivityId[
                                    activity.id
                                  ] || 0;

                                const discussionUnreadCount =
                                  discussionUnreadCountByActivityId[
                                    activity.id
                                  ] || 0;

                                return (
                                  <button
                                    key={activity.id}
                                    type="button"
                                    onClick={() =>
                                      openActivityDetail(
                                        activity.id
                                      )
                                    }
                                    className={`block w-full rounded-md border px-2 py-1.5 text-left transition hover:border-blue-300 hover:bg-blue-50 ${PRIORITY_CARD_CLASSES[activity.priority]} ${
                                      unseenCount > 0
                                        ? "border-slate-300 bg-slate-200"
                                        : "border-slate-200 bg-slate-50"
                                    }`}
                                  >
                                    <div className="flex items-center gap-1">
                                      <div className="min-w-0 flex-1 truncate text-[10px] font-bold text-slate-900">
                                        {activity.title}
                                      </div>

                                      <span
                                        className={`shrink-0 rounded border px-1 py-0.5 text-[8px] font-black ${PRIORITY_BADGE_CLASSES[activity.priority]}`}
                                      >
                                        {activity.priority === "URGENT"
                                          ? "⚠ "
                                          : activity.priority === "HIGH"
                                          ? "! "
                                          : ""}
                                        {PRIORITY_LABELS[activity.priority]}
                                      </span>
                                    </div>

                                    <div className="mt-0.5 truncate text-[9px] text-slate-500">
                                      {owner?.full_name || "-"} • {STATUS_LABELS[activity.status]}
                                      {unseenCount > 0
                                        ? ` • ${unseenCount} baru`
                                        : ""}
                                    </div>

                                    {discussionUnreadCount > 0 && (
                                      <div className="mt-1 flex items-center gap-1 text-[9px] font-bold text-red-700">
                                        <span className="h-1.5 w-1.5 rounded-full bg-red-600" />
                                        {discussionUnreadCount} unread
                                      </div>
                                    )}
                                  </button>
                                );
                              })}

                              {dayActivities.length > 3 && (
                                <div className="px-1 text-[9px] font-semibold text-blue-700">
                                  +{dayActivities.length - 3} aktivitas lainnya
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
          </>
        ) : (
          profile && (
            <ActivityMonitoringPanel
              currentProfile={profile}
              activities={periodFilteredActivities}
              directory={directory}
              onOpenActivity={openActivityDetail}
            />
          )
        )}
      </div>

      {/* CREATE ACTIVITY */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Aktivitas Baru</DialogTitle>

            <DialogDescription>
              Tentukan dulu apakah aktivitas ini milik sendiri,
              assignment ke bawahan, atau pekerjaan kolaboratif.
            </DialogDescription>
          </DialogHeader>

          <div>
            <label className="mb-2 block text-xs font-bold">
              Tipe Aktivitas *
            </label>

            <div className="grid gap-2 md:grid-cols-3">
              <Button
                type="button"
                variant={
                  activityMode === "PERSONAL"
                    ? "default"
                    : "outline"
                }
                className="h-auto justify-start py-3 text-left"
                onClick={() => changeMode("PERSONAL")}
              >
                <UserRound className="mr-2 h-4 w-4" />

                <span>
                  <span className="block text-xs font-bold">
                    Task Pribadi
                  </span>

                  <span className="block text-[10px] font-normal opacity-75">
                    PIC otomatis diri sendiri
                  </span>
                </span>
              </Button>

              <Button
                type="button"
                variant={
                  activityMode === "ASSIGNMENT"
                    ? "default"
                    : "outline"
                }
                className="h-auto justify-start py-3 text-left"
                onClick={() => changeMode("ASSIGNMENT")}
              >
                <UserRoundPlus className="mr-2 h-4 w-4" />

                <span>
                  <span className="block text-xs font-bold">
                    Assignment
                  </span>

                  <span className="block text-[10px] font-normal opacity-75">
                    Assign ke bawahan
                  </span>
                </span>
              </Button>

              <Button
                type="button"
                variant={
                  activityMode === "COLLABORATION"
                    ? "default"
                    : "outline"
                }
                className="h-auto justify-start py-3 text-left"
                onClick={() => changeMode("COLLABORATION")}
              >
                <UsersRound className="mr-2 h-4 w-4" />

                <span>
                  <span className="block text-xs font-bold">
                    Kolaborasi
                  </span>

                  <span className="block text-[10px] font-normal opacity-75">
                    Bisa lintas department
                  </span>
                </span>
              </Button>
            </div>
          </div>

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

            {activityMode === "ASSIGNMENT" ? (
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-xs font-bold">
                  Assign ke *
                </label>

                <Select
                  value={ownerProfileId}
                  onValueChange={setOwnerProfileId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih bawahan" />
                  </SelectTrigger>

                  <SelectContent>
                    {subordinateProfiles.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.full_name} — {getOrgLabel(item)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {subordinateProfiles.length === 0 && (
                  <p className="mt-1 text-[10px] text-amber-700">
                    Tidak ada subordinate aktif pada hierarchy akun ini.
                  </p>
                )}
              </div>
            ) : (
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-xs font-bold">
                  PIC / Owner
                </label>

                <Input
                  disabled
                  value={profile?.full_name || ""}
                />
              </div>
            )}

            {(activityMode === "ASSIGNMENT" ||
              activityMode === "COLLABORATION") && (
              <div className="md:col-span-2">
                <ActivityPeoplePicker
                  directory={directory}
                  selectedIds={collaboratorIds}
                  onChange={setCollaboratorIds}
                  currentUserId={profile?.id}
                  excludedIds={[ownerProfileId].filter(Boolean)}
                  label="Kolaborator"
                  required={activityMode === "COLLABORATION"}
                  helperText={
                    activityMode === "COLLABORATION"
                      ? "Cari berdasarkan nama, unit, department, atau jabatan. Kolaborator dapat berasal dari tim lain dan akan menerima notifikasi."
                      : "Opsional. Gunakan jika assignment membutuhkan kontribusi dari user atau tim lain."
                  }
                />
              </div>
            )}

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
                Due Date
              </label>

              <Input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs font-bold">
                Description / Agenda *
              </label>

              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Apa yang harus dikerjakan?"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs font-bold">
                Next Action *
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
              variant="outline"
              onClick={() =>
                handleCreate("DRAFT")
              }
              disabled={busyId === "CREATE"}
            >
              Simpan Draft
            </Button>

            <Button
              onClick={() =>
                handleCreate("TO_DO")
              }
              disabled={busyId === "CREATE"}
            >
              {busyId === "CREATE"
                ? "Menyimpan..."
                : "Buat Aktivitas"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* GOVERNED STATUS TRANSITION — shared by Kanban, List, Detail */}
      <Dialog
        open={transitionOpen}
        onOpenChange={(open) => {
          if (busyId) return;

          setTransitionOpen(open);

          if (!open) {
            setTransitionActivity(null);
            setTransitionTarget("");
            setTransitionNote("");
            setTransitionNextAction("");
            setTransitionFollowUpDate(todayKey());
            setTransitionResult("");
            setTransitionCollaboratorIds([]);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto overscroll-contain">
          <DialogHeader>
            <DialogTitle>
              Validasi Perubahan Status
            </DialogTitle>

            <DialogDescription>
              {transitionActivity
                ? transitionActivity.title
                : "Pilih aksi status yang akan dilakukan."}
            </DialogDescription>
          </DialogHeader>

          {transitionActivity && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  Flow Status
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="outline">
                    {STATUS_LABELS[
                      transitionActivity.status
                    ]}
                  </Badge>

                  <ChevronRight className="h-4 w-4 text-slate-400" />

                  <Badge
                    variant={
                      transitionTarget === "DONE"
                        ? "default"
                        : "secondary"
                    }
                  >
                    {transitionTarget
                      ? STATUS_LABELS[
                          transitionTarget
                        ]
                      : "Pilih tujuan"}
                  </Badge>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">
                  Aksi Status
                </label>

                <Select
                  value={transitionTarget}
                  onValueChange={(value) => {
                    setTransitionTarget(
                      value as UniversalActivityStatus
                    );
                    setTransitionNote("");
                    setTransitionCollaboratorIds([]);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih aksi yang diizinkan" />
                  </SelectTrigger>

                  <SelectContent>
                    {getAllowedTransitionTargets(
                      transitionActivity,
                      actionRoleByActivityId[
                        transitionActivity.id
                      ]
                    ).map((status) => (
                      <SelectItem
                        key={status}
                        value={status}
                      >
                        {
                          getTransitionActionLabel(
                            transitionActivity,
                            status
                          )
                        }
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {transitionTarget ===
                "WAITING_FOLLOW_UP" && (
                <>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-700">
                      Alasan Waiting / Follow Up
                    </label>

                    <Textarea
                      value={transitionNote}
                      onChange={(event) =>
                        setTransitionNote(
                          event.target.value
                        )
                      }
                      placeholder="Apa yang sedang ditunggu?"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-700">
                      Next Action
                    </label>

                    <Textarea
                      value={transitionNextAction}
                      onChange={(event) =>
                        setTransitionNextAction(
                          event.target.value
                        )
                      }
                      placeholder="Tindak lanjut berikutnya..."
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-700">
                      Tanggal Follow Up
                    </label>

                    <Input
                      type="date"
                      value={
                        transitionFollowUpDate
                      }
                      min={todayKey()}
                      onChange={(event) =>
                        setTransitionFollowUpDate(
                          event.target.value
                        )
                      }
                    />
                  </div>

                  <ActivityPeoplePicker
                    directory={directory}
                    selectedIds={transitionCollaboratorIds}
                    onChange={setTransitionCollaboratorIds}
                    currentUserId={profile?.id}
                    excludedIds={[transitionActivity.owner_profile_id]}
                    label="Kolaborasi untuk Follow Up"
                    helperText="Opsional. Pilih user internal jika follow up ini membutuhkan kontribusi tim lain. User yang dipilih akan masuk Need My Action dan menerima notifikasi."
                  />
                </>
              )}

              {transitionTarget ===
                "NEED_SUPPORT" && (
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-700">
                      Dukungan yang Dibutuhkan
                    </label>

                    <Textarea
                      value={transitionNote}
                      onChange={(event) =>
                        setTransitionNote(
                          event.target.value
                        )
                      }
                      placeholder="Jelaskan support/eskalasi yang dibutuhkan..."
                    />

                    <div className="mt-1.5 text-[10px] text-slate-500">
                      Direct superior tetap mendapat awareness. Pilih minimal 1 user yang dibutuhkan untuk membantu penyelesaian task.
                    </div>
                  </div>

                  <ActivityPeoplePicker
                    directory={directory}
                    selectedIds={transitionCollaboratorIds}
                    onChange={setTransitionCollaboratorIds}
                    currentUserId={profile?.id}
                    excludedIds={[transitionActivity.owner_profile_id]}
                    recommendedProfileIds={
                      [
                        profileMap.get(
                          transitionActivity.owner_profile_id
                        )?.manager_id,
                      ].filter((id): id is string => Boolean(id))
                    }
                    label="Minta Bantuan Dari"
                    required
                    helperText="Support target akan mendapat email + in-app notification dan task ini muncul di Need My Action mereka. Mereka dapat comment/upload evidence, tetapi tidak dapat mengubah status utama task."
                  />
                </div>
              )}

              {transitionTarget ===
                "PENDING_VALIDATION" && (
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">
                    Ringkasan Hasil Aktivitas
                  </label>

                  <Textarea
                    value={transitionResult}
                    onChange={(event) =>
                      setTransitionResult(
                        event.target.value
                      )
                    }
                    placeholder="Tuliskan hasil/deliverable yang sudah diselesaikan..."
                  />

                  <div className="mt-1.5 text-[10px] leading-4 text-slate-500">
                    Jika aktivitas memerlukan evidence file, upload dari Detail sebelum submit. Progress otomatis menjadi 100% dan direct manager akan menerima notifikasi validasi.
                  </div>
                </div>
              )}

              {transitionActivity.status ===
                "PENDING_VALIDATION" &&
                transitionTarget ===
                  "ON_PROGRESS" && (
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-700">
                      Remark Revisi *
                    </label>

                    <Textarea
                      value={transitionNote}
                      onChange={(event) =>
                        setTransitionNote(
                          event.target.value
                        )
                      }
                      placeholder="Jelaskan revisi/perbaikan yang wajib dilakukan..."
                    />
                  </div>
                )}

              {transitionActivity.status ===
                "PENDING_VALIDATION" &&
                transitionTarget ===
                  "DONE" && (
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-700">
                      Remark Done *
                    </label>

                    <Textarea
                      value={transitionNote}
                      onChange={(event) =>
                        setTransitionNote(
                          event.target.value
                        )
                      }
                      placeholder="Tuliskan catatan/remark penyelesaian..."
                    />
                  </div>
                )}

              {transitionTarget ===
                "CANCELLED" && (
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">
                    {transitionActivity.status ===
                    "PENDING_VALIDATION"
                      ? "Remark Reject *"
                      : "Alasan Pembatalan"}
                  </label>

                  <Textarea
                    value={transitionNote}
                    onChange={(event) =>
                      setTransitionNote(
                        event.target.value
                      )
                    }
                    placeholder={
                      transitionActivity.status ===
                      "PENDING_VALIDATION"
                        ? "Jelaskan alasan task ditolak dan dibatalkan..."
                        : "Alasan aktivitas dibatalkan..."
                    }
                  />
                </div>
              )}

              {transitionTarget &&
                ![
                  "WAITING_FOLLOW_UP",
                  "NEED_SUPPORT",
                  "PENDING_VALIDATION",
                  "CANCELLED",
                  "DONE",
                ].includes(
                  transitionTarget
                ) &&
                !(
                  transitionActivity.status ===
                    "PENDING_VALIDATION" &&
                  transitionTarget ===
                    "ON_PROGRESS"
                ) && (
                  <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-[11px] leading-5 text-blue-800">
                    Perubahan ini akan dicatat ke Activity History. Status tidak akan berubah sampai Anda menekan Konfirmasi.
                  </div>
                )}
            </div>
          )}

          <DialogFooter className="sticky bottom-0 z-20 -mx-6 -mb-6 border-t border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setTransitionOpen(false)
              }
              disabled={Boolean(busyId)}
            >
              Batal
            </Button>

            <Button
              type="button"
              onClick={
                handleConfirmTransition
              }
              disabled={
                !transitionActivity ||
                !transitionTarget ||
                Boolean(busyId)
              }
            >
              {busyId
                ? "Memproses..."
                : "Konfirmasi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ACTIVITY DETAIL */}
      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);

          if (!open) {
            setDetail(null);
            setAttachmentFile(null);
            setAttachmentInputKey((value) => value + 1);
            setDetailTab("overview");
            deepLinkHandledRef.current = null;

            if (
              searchParams.has("task") ||
              searchParams.has("tab") ||
              searchParams.has("comment")
            ) {
              const nextParams =
                new URLSearchParams(searchParams);

              nextParams.delete("task");
              nextParams.delete("tab");
              nextParams.delete("comment");

              setSearchParams(nextParams, {
                replace: true,
              });
            }
          }
        }}
      >
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
          {detailLoading || !detail ? (
            <div className="py-16 text-center text-sm text-slate-500">
              Memuat detail aktivitas...
            </div>
          ) : (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">
                    {MODE_LABELS[detail.activity.activity_mode || "PERSONAL"]}
                  </Badge>

                  <Badge>
                    {STATUS_LABELS[detail.activity.status]}
                  </Badge>

                  <Badge variant="secondary">
                    {PRIORITY_LABELS[detail.activity.priority]}
                  </Badge>
                </div>

                <DialogTitle className="pt-2 text-xl">
                  {detail.activity.title}
                </DialogTitle>

                <DialogDescription>
                  {CATEGORY_LABELS[detail.activity.category]}
                </DialogDescription>
              </DialogHeader>

              <Tabs
                value={detailTab}
                onValueChange={(value) =>
                  setDetailTab(
                    value as
                      | "overview"
                      | "discussion"
                      | "attachments"
                      | "history"
                  )
                }
                className="mt-2"
              >
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="overview">
                    <Eye className="mr-2 h-4 w-4" />
                    Overview
                  </TabsTrigger>

                  <TabsTrigger value="discussion">
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Discussion ({detail.comments.length})
                    {(discussionUnreadCountByActivityId[
                      detail.activity.id
                    ] || 0) > 0 && (
                      <span className="ml-2 inline-flex min-w-5 items-center justify-center gap-1 rounded-full bg-red-600 px-1.5 py-0.5 text-[9px] font-black text-white">
                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                        {
                          discussionUnreadCountByActivityId[
                            detail.activity.id
                          ]
                        }
                      </span>
                    )}
                  </TabsTrigger>

                  <TabsTrigger value="attachments">
                    <Paperclip className="mr-2 h-4 w-4" />
                    Lampiran ({detail.attachments.length})
                  </TabsTrigger>

                  <TabsTrigger value="history">
                    <History className="mr-2 h-4 w-4" />
                    History ({detail.history.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-5 space-y-5">
                  <div className="grid gap-4 md:grid-cols-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-[10px] font-bold uppercase text-slate-500">
                        Owner
                      </div>

                      <div className="mt-1 text-sm font-bold text-slate-900">
                        {detail.owner.full_name}
                      </div>

                      <div className="mt-1 text-[11px] text-slate-500">
                        {detail.owner.role_level} • {detail.owner.department || detail.owner.unit}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-[10px] font-bold uppercase text-slate-500">
                        Activity Date
                      </div>

                      <div className="mt-1 text-sm font-bold text-slate-900">
                        {formatDateOnly(detail.activity.activity_date)}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-[10px] font-bold uppercase text-slate-500">
                        Due Date
                      </div>

                      <div className="mt-1 text-sm font-bold text-slate-900">
                        {formatDateOnly(detail.activity.due_date)}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-[10px] font-bold uppercase text-slate-500">
                        Progress
                      </div>

                      <div className="mt-1 text-sm font-bold text-slate-900">
                        {detail.activity.progress}%
                      </div>

                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-blue-600"
                          style={{
                            width: `${Math.max(
                              0,
                              Math.min(100, detail.activity.progress)
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {actionRoleByActivityId[detail.activity.id] === "OWNER" &&
                    !["PENDING_VALIDATION", "DONE", "CANCELLED"].includes(
                      detail.activity.status
                    ) && (
                    <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                        <div className="flex-1">
                          <div className="text-xs font-bold text-slate-800">
                            Update Progress
                          </div>

                          <div className="mt-1 text-[11px] text-slate-500">
                            Progress manual 0–99%. Untuk menyelesaikan aktivitas, gunakan Submit Validation.
                          </div>

                          <input
                            type="range"
                            min={0}
                            max={99}
                            value={progressValue}
                            onChange={(event) =>
                              setProgressValue(
                                Number(event.target.value)
                              )
                            }
                            className="mt-3 w-full"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={0}
                            max={99}
                            value={progressValue}
                            onChange={(event) =>
                              setProgressValue(
                                Math.max(
                                  0,
                                  Math.min(
                                    99,
                                    Number(event.target.value) || 0
                                  )
                                )
                              )
                            }
                            className="w-20"
                          />

                          <Button
                            size="sm"
                            onClick={handleUpdateProgress}
                            disabled={progressBusy}
                          >
                            {progressBusy
                              ? "Menyimpan..."
                              : "Update"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid gap-5 md:grid-cols-2">
                    <div>
                      <div className="text-xs font-bold text-slate-700">
                        Description / Agenda
                      </div>

                      <div className="mt-2 min-h-24 whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                        {detail.activity.description || "-"}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-bold text-slate-700">
                        Next Action
                      </div>

                      <div className="mt-2 min-h-24 whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                        {detail.activity.next_action || "-"}
                      </div>
                    </div>
                  </div>

                  {detail.collaborators.length > 0 && (
                    <div>
                      <div className="mb-2 text-xs font-bold text-slate-700">
                        Kolaborator
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {detail.collaborators.map((item) => (
                          <Badge
                            key={item.profile_id}
                            variant="secondary"
                            className="py-1.5"
                          >
                            {item.full_name} • {item.department || item.unit}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid gap-4 rounded-xl border border-slate-200 p-4 md:grid-cols-2">
                    <div>
                      <div className="text-[10px] font-bold uppercase text-slate-500">
                        Dibuat oleh
                      </div>

                      <div className="mt-1 text-sm font-semibold">
                        {detail.created_by.full_name}
                      </div>

                      <div className="text-[11px] text-slate-500">
                        {formatDateTime(detail.activity.created_at)}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] font-bold uppercase text-slate-500">
                        Approver Validasi
                      </div>

                      <div className="mt-1 text-sm font-semibold">
                        {detail.validation_approver?.full_name || "-"}
                      </div>

                      {detail.activity.validated_at && (
                        <div className="text-[11px] text-slate-500">
                          Diproses {formatDateTime(detail.activity.validated_at)}
                        </div>
                      )}
                    </div>
                  </div>

                  {(detail.activity.company_name ||
                    detail.activity.person_met ||
                    detail.activity.product_name ||
                    detail.activity.potential_premium) && (
                    <div className="rounded-xl border border-slate-200 p-4">
                      <div className="mb-3 text-xs font-bold text-slate-700">
                        Informasi Customer / External
                      </div>

                      <div className="grid gap-4 text-sm md:grid-cols-3">
                        <div>
                          <div className="text-[10px] uppercase text-slate-500">
                            Company
                          </div>
                          <div className="font-semibold">
                            {detail.activity.company_name || "-"}
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] uppercase text-slate-500">
                            Person Met
                          </div>
                          <div className="font-semibold">
                            {detail.activity.person_met || "-"}
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] uppercase text-slate-500">
                            Position
                          </div>
                          <div className="font-semibold">
                            {detail.activity.position_met || "-"}
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] uppercase text-slate-500">
                            Product
                          </div>
                          <div className="font-semibold">
                            {detail.activity.product_name || "-"}
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] uppercase text-slate-500">
                            Interaction
                          </div>
                          <div className="font-semibold">
                            {detail.activity.interaction_method || "-"}
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] uppercase text-slate-500">
                            Potential Premium
                          </div>
                          <div className="font-semibold">
                            {formatRupiah(detail.activity.potential_premium)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="discussion" className="mt-5">
                  <ActivityDiscussionV2
                    detail={detail}
                    directory={directory}
                    currentProfileId={profile?.id}
                    highlightCommentId={
                      requestedCommentId
                    }
                    onDetailChange={setDetail}
                  />
                </TabsContent>

                <TabsContent value="attachments" className="mt-5">
                  <div className="space-y-4">
                    {detail.can_edit &&
                      !["DONE", "CANCELLED"].includes(
                        detail.activity.status
                      ) && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="mb-2 text-xs font-bold text-slate-700">
                          Upload Lampiran
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                          <Input
                            key={attachmentInputKey}
                            type="file"
                            accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
                            onChange={(event) =>
                              setAttachmentFile(
                                event.target.files?.[0] || null
                              )
                            }
                            className="flex-1"
                          />

                          <Button
                            size="sm"
                            onClick={handleUploadAttachment}
                            disabled={
                              attachmentBusy ||
                              !attachmentFile
                            }
                          >
                            <UploadCloud className="mr-2 h-4 w-4" />
                            {attachmentBusy
                              ? "Mengunggah..."
                              : "Upload"}
                          </Button>
                        </div>

                        <div className="mt-2 text-[10px] text-slate-500">
                          Maksimal 10 MB. Pilot: jangan unggah dokumen nasabah / data sensitif sebelum approval internal.
                        </div>
                      </div>
                    )}

                    {detail.attachments.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                        Belum ada lampiran.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {detail.attachments.map((attachment) => (
                          <div
                            key={attachment.id}
                            className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <Paperclip className="h-4 w-4 shrink-0 text-slate-400" />

                                <div className="truncate text-sm font-bold text-slate-900">
                                  {attachment.file_name}
                                </div>
                              </div>

                              <div className="mt-1 text-[10px] text-slate-500">
                                {(attachment.file_size / 1024 / 1024).toFixed(2)} MB
                                {" • "}
                                {attachment.uploaded_by_name}
                                {" • "}
                                {formatDateTime(attachment.created_at)}
                              </div>
                            </div>

                            <div className="flex shrink-0 gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  handleDownloadAttachment(
                                    attachment
                                  )
                                }
                              >
                                <Download className="mr-1.5 h-4 w-4" />
                                Buka
                              </Button>

                              {detail.can_edit && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={attachmentBusy}
                                  onClick={() =>
                                    handleDeleteAttachment(
                                      attachment
                                    )
                                  }
                                >
                                  <Trash2 className="mr-1.5 h-4 w-4" />
                                  Hapus
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="history" className="mt-5">
                  <div className="space-y-3">
                    {detail.history.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                        Belum ada history.
                      </div>
                    ) : (
                      detail.history.map((item) => (
                        <div
                          key={item.id}
                          className="relative rounded-xl border border-slate-200 bg-white p-4 pl-11"
                        >
                          <div className="absolute left-4 top-5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                            <History className="h-3 w-3" />
                          </div>

                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <div className="text-sm font-bold text-slate-900">
                                {HISTORY_ACTION_LABELS[item.action] || item.action}
                              </div>

                              <div className="mt-0.5 text-[11px] text-slate-500">
                                {item.actor_name}
                                {item.actor_role
                                  ? ` • ${item.actor_role}`
                                  : ""}
                              </div>
                            </div>

                            <div className="text-[10px] text-slate-400">
                              {formatDateTime(item.created_at)}
                            </div>
                          </div>

                          {(item.old_status || item.new_status) && (
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              {item.old_status && (
                                <Badge variant="outline">
                                  {STATUS_LABELS[
                                    item.old_status as UniversalActivityStatus
                                  ] || item.old_status}
                                </Badge>
                              )}

                              {item.old_status && item.new_status && (
                                <span className="text-slate-400">→</span>
                              )}

                              {item.new_status && (
                                <Badge variant="secondary">
                                  {STATUS_LABELS[
                                    item.new_status as UniversalActivityStatus
                                  ] || item.new_status}
                                </Badge>
                              )}
                            </div>
                          )}

                          {item.notes && (
                            <div className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                              {item.notes}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default AktivitasUniversalPage;
