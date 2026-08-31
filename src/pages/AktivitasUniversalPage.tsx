import React, { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import ActivityMonitoringPanel from "@/components/activity/ActivityMonitoringPanel";
import { useAuth } from "@/contexts/AuthContext";
import {
  ActivityActionRole,
  ActivityAttachmentDetail,
  ActivityCategory,
  ActivityDetailPayload,
  ActivityMode,
  ActivityPriority,
  ActivityTransitionPayload,
  DirectoryProfile,
  UniversalActivity,
  UniversalActivityStatus,
  addUniversalActivityComment,
  createUniversalActivity,
  deleteUniversalActivityAttachment,
  getActivityDirectory,
  getMyActivityActionRoles,
  getUniversalActivities,
  getUniversalActivityAttachmentUrl,
  getUniversalActivityDetail,
  transitionUniversalActivity,
  updateUniversalActivityProgress,
  uploadUniversalActivityAttachment,
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
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
  Send,
  ShieldCheck,
  Trash2,
  UploadCloud,
  UserRound,
  UserRoundPlus,
  UsersRound,
  X,
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

const KANBAN_STATUSES: Array<
  Exclude<UniversalActivityStatus, "CANCELLED">
> = [
  "DRAFT",
  "TO_DO",
  "ON_PROGRESS",
  "WAITING_FOLLOW_UP",
  "NEED_SUPPORT",
  "PENDING_VALIDATION",
  "DONE",
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
      ? ["DONE", "ON_PROGRESS"]
      : [];
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

  const [activities, setActivities] = useState<UniversalActivity[]>([]);
  const [directory, setDirectory] = useState<DirectoryProfile[]>([]);
  const [actionRoleByActivityId, setActionRoleByActivityId] =
    useState<Record<string, ActivityActionRole>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState("");

  const [scope, setScope] = useState<ScopeFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [query, setQuery] = useState("");
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
  const [collaboratorCandidateId, setCollaboratorCandidateId] =
    useState("");

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
  const [commentText, setCommentText] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);

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

  const collaboratorCandidates = useMemo(
    () =>
      directory.filter(
        (item) =>
          item.id !== profile?.id &&
          item.id !== ownerProfileId &&
          !collaboratorIds.includes(item.id) &&
          !(
            item.role_level
              .trim()
              .toUpperCase()
              .includes("SYSTEM") &&
            item.role_level
              .trim()
              .toUpperCase()
              .includes("ADMIN")
          ) &&
          item.unit
            .trim()
            .toLowerCase() !==
            "administrasi sistem"
      ),
    [
      collaboratorIds,
      directory,
      ownerProfileId,
      profile?.id,
    ]
  );

  const collaboratorDivisionGroups = useMemo(() => {
    const getDivisionRoot = (
      item: DirectoryProfile
    ) => {
      let current = item;
      const visited =
        new Set<string>();

      while (
        current.manager_id &&
        !visited.has(current.id)
      ) {
        visited.add(
          current.id
        );

        const manager =
          profileMap.get(
            current.manager_id
          );

        if (!manager) {
          break;
        }

        const managerRole =
          manager.role_level
            .trim()
            .toUpperCase();

        if (
          managerRole ===
            "DIRECTOR" ||
          managerRole ===
            "DIREKTUR"
        ) {
          return current;
        }

        current = manager;
      }

      return current;
    };

    const groupMap = new Map<
      string,
      {
        label: string;
        items: DirectoryProfile[];
      }
    >();

    collaboratorCandidates.forEach(
      (item) => {
        const divisionRoot =
          getDivisionRoot(
            item
          );

        const rootRole =
          divisionRoot.role_level
            .trim()
            .toUpperCase();

        const label =
          rootRole ===
            "DIRECTOR" ||
          rootRole ===
            "DIREKTUR"
            ? "Direktorat Marketing"
            : getWorkspaceDivisionLabel(
                divisionRoot
              );

        const key =
          label
            .trim()
            .toLowerCase();

        const existing =
          groupMap.get(key);

        if (existing) {
          existing.items.push(
            item
          );
        } else {
          groupMap.set(
            key,
            {
              label,
              items: [item],
            }
          );
        }
      }
    );

    const preferredOrder =
      [
        "captive marketing",
        "corporate & retail marketing",
        "marketing support",
        "direktorat marketing / advisor",
        "direktorat marketing",
      ];

    return Array.from(
      groupMap.values()
    )
      .map((group) => ({
        ...group,
        items: [
          ...group.items,
        ].sort((a, b) =>
          a.full_name.localeCompare(
            b.full_name,
            "id"
          )
        ),
      }))
      .sort((a, b) => {
        const aKey =
          a.label
            .trim()
            .toLowerCase();

        const bKey =
          b.label
            .trim()
            .toLowerCase();

        const aIndex =
          preferredOrder.indexOf(
            aKey
          );

        const bIndex =
          preferredOrder.indexOf(
            bKey
          );

        if (
          aIndex !== -1 ||
          bIndex !== -1
        ) {
          if (aIndex === -1) {
            return 1;
          }

          if (bIndex === -1) {
            return -1;
          }

          return (
            aIndex -
            bIndex
          );
        }

        return a.label.localeCompare(
          b.label,
          "id"
        );
      });
  }, [
    collaboratorCandidates,
    profileMap,
  ]);

  const refresh = async () => {
    setLoading(true);
    setError("");

    try {
      const [
        activityRows,
        directoryRows,
        actionRoleRows,
      ] = await Promise.all([
        getUniversalActivities(),
        getActivityDirectory(),
        getMyActivityActionRoles(),
      ]);

      setActivities(activityRows);
      setDirectory(directoryRows);

      setActionRoleByActivityId(
        actionRoleRows.reduce<
          Record<string, ActivityActionRole>
        >((result, row) => {
          result[row.activity_id] =
            row.action_role;
          return result;
        }, {})
      );
    } catch (err) {
      console.error(err);
      setError(
        "Gagal membaca data aktivitas. Pastikan SQL Activity vNext sudah dijalankan di Supabase."
      );
    } finally {
      setLoading(false);
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

    refresh();
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

  const orgScopedActivities = useMemo(
    () =>
      workspaceOwnerFilterIds
        ? activities.filter((activity) =>
            workspaceOwnerFilterIds.has(activity.owner_profile_id)
          )
        : activities,
    [activities, workspaceOwnerFilterIds]
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

  const myCount = activities.filter(
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
    setCollaboratorCandidateId("");
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
    setCollaboratorCandidateId("");

    if (mode === "ASSIGNMENT") {
      setOwnerProfileId("");
    } else {
      setOwnerProfileId(profile?.id || "");
    }
  };

  const addCollaborator = () => {
    if (!collaboratorCandidateId) return;

    setCollaboratorIds((current) =>
      Array.from(
        new Set([
          ...current,
          collaboratorCandidateId,
        ])
      )
    );

    setCollaboratorCandidateId("");
  };

  const removeCollaborator = (id: string) => {
    setCollaboratorIds((current) =>
      current.filter((item) => item !== id)
    );
  };

  const handleCreate = async (
    initialStatus: "DRAFT" | "TO_DO" = "TO_DO"
  ) => {
    if (!profile) return;

    if (!title.trim()) {
      window.alert("Judul aktivitas wajib diisi.");
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
        description,
        next_action: nextAction,
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
        transitionTarget ===
          "ON_PROGRESS" &&
        !payload.note
      ) {
        window.alert(
          "Alasan Return wajib diisi."
        );
        return;
      }

      try {
        setBusyId(
          transitionActivity.id
        );

        await transitionUniversalActivity(
          transitionActivity.id,
          transitionTarget,
          payload
        );

        const transitionedId =
          transitionActivity.id;

        setTransitionOpen(false);
        setTransitionActivity(null);
        setTransitionTarget("");
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
    setCommentText("");

    try {
      const nextDetail =
        await getUniversalActivityDetail(activityId);

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

  const handleAddComment = async () => {
    if (!detail || !commentText.trim()) return;

    try {
      setCommentBusy(true);

      await addUniversalActivityComment(
        detail.activity.id,
        commentText
      );

      setCommentText("");

      const refreshed =
        await getUniversalActivityDetail(
          detail.activity.id
        );

      setDetail(refreshed);
    } catch (err: any) {
      console.error(err);
      window.alert(
        err?.message || "Gagal mengirim komentar."
      );
    } finally {
      setCommentBusy(false);
    }
  };


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

        {workspaceSection === "WORKSPACE" ? (
          <>
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
                  Need My Action
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-sm">
                Aktivitas
              </CardTitle>

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

                            <Badge variant="secondary">
                              {bucketItems.length}
                            </Badge>
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
                                    className={`rounded-xl border bg-white p-3 shadow-sm transition ${
                                      canDrag
                                        ? "cursor-grab border-slate-200 hover:border-blue-300 hover:shadow-md active:cursor-grabbing"
                                        : "cursor-default border-slate-200"
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          openActivityDetail(
                                            activity.id
                                          )
                                        }
                                        className="min-w-0 flex-1 text-left"
                                      >
                                        <div className="line-clamp-2 text-xs font-bold text-slate-900 hover:text-blue-700">
                                          {activity.title}
                                        </div>
                                      </button>

                                      <Badge
                                        variant="outline"
                                        className="shrink-0 text-[9px]"
                                      >
                                        {
                                          PRIORITY_LABELS[
                                            activity.priority
                                          ]
                                        }
                                      </Badge>
                                    </div>

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
                                          onClick={() =>
                                            requestTransition(
                                              activity
                                            )
                                          }
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
                          <tr key={activity.id} className="align-top hover:bg-slate-50/60">
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
                              <Badge variant="outline">
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

                                return (
                                  <button
                                    key={activity.id}
                                    type="button"
                                    onClick={() =>
                                      openActivityDetail(
                                        activity.id
                                      )
                                    }
                                    className="block w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-left hover:border-blue-300 hover:bg-blue-50"
                                  >
                                    <div className="truncate text-[10px] font-bold text-slate-900">
                                      {activity.title}
                                    </div>

                                    <div className="mt-0.5 truncate text-[9px] text-slate-500">
                                      {owner?.full_name || "-"} • {STATUS_LABELS[activity.status]}
                                    </div>
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
              activities={activities}
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
                <label className="mb-1.5 block text-xs font-bold">
                  Kolaborator
                  {activityMode === "COLLABORATION" ? " *" : " (opsional)"}
                </label>

                <div className="flex gap-2">
                  <Select
                    value={collaboratorCandidateId}
                    onValueChange={setCollaboratorCandidateId}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Pilih user dari department mana pun" />
                    </SelectTrigger>

                    <SelectContent className="max-h-80">
                      {collaboratorDivisionGroups.map(
                        (
                          group,
                          groupIndex
                        ) => (
                          <React.Fragment
                            key={
                              group.label
                            }
                          >
                            {groupIndex >
                              0 && (
                              <SelectSeparator />
                            )}

                            <SelectGroup>
                              <SelectLabel className="px-2 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                                {
                                  group.label
                                }{" "}
                                (
                                {
                                  group
                                    .items
                                    .length
                                }
                                )
                              </SelectLabel>

                              {group.items.map(
                                (
                                  item
                                ) => (
                                  <SelectItem
                                    key={
                                      item.id
                                    }
                                    value={
                                      item.id
                                    }
                                  >
                                    {
                                      item.full_name
                                    }{" "}
                                    —{" "}
                                    {getOrgLabel(
                                      item
                                    )}
                                  </SelectItem>
                                )
                              )}
                            </SelectGroup>
                          </React.Fragment>
                        )
                      )}
                    </SelectContent>
                  </Select>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={addCollaborator}
                    disabled={!collaboratorCandidateId}
                  >
                    Tambah
                  </Button>
                </div>

                {collaboratorIds.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {collaboratorIds.map((id) => {
                      const collaborator = profileMap.get(id);

                      return (
                        <Badge
                          key={id}
                          variant="secondary"
                          className="gap-1 py-1"
                        >
                          {collaborator?.full_name || id}

                          <button
                            type="button"
                            onClick={() => removeCollaborator(id)}
                            className="ml-1 rounded hover:bg-slate-300/50"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                )}

                <p className="mt-1 text-[10px] text-slate-500">
                  Kolaborator dapat berasal dari department lain dan mendapat akses edit ke aktivitas ini.
                </p>
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
          }
        }}
      >
        <DialogContent className="max-w-lg">
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
                          TRANSITION_ACTION_LABELS[
                            status
                          ]
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
                </>
              )}

              {transitionTarget ===
                "NEED_SUPPORT" && (
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
                    Direct superior akan menerima in-app notification dan email.
                  </div>
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
                      Alasan Return
                    </label>

                    <Textarea
                      value={transitionNote}
                      onChange={(event) =>
                        setTransitionNote(
                          event.target.value
                        )
                      }
                      placeholder="Jelaskan apa yang perlu diperbaiki..."
                    />
                  </div>
                )}

              {transitionActivity.status ===
                "PENDING_VALIDATION" &&
                transitionTarget ===
                  "DONE" && (
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-700">
                      Catatan Approval
                    </label>

                    <Textarea
                      value={transitionNote}
                      onChange={(event) =>
                        setTransitionNote(
                          event.target.value
                        )
                      }
                      placeholder="Opsional"
                    />
                  </div>
                )}

              {transitionTarget ===
                "CANCELLED" && (
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">
                    Alasan Pembatalan
                  </label>

                  <Textarea
                    value={transitionNote}
                    onChange={(event) =>
                      setTransitionNote(
                        event.target.value
                      )
                    }
                    placeholder="Alasan aktivitas dibatalkan..."
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

          <DialogFooter>
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
            setCommentText("");
            setAttachmentFile(null);
            setAttachmentInputKey((value) => value + 1);
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

              <Tabs defaultValue="overview" className="mt-2">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="overview">
                    <Eye className="mr-2 h-4 w-4" />
                    Overview
                  </TabsTrigger>

                  <TabsTrigger value="discussion">
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Discussion ({detail.comments.length})
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

                  {detail.can_edit &&
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
                  <div className="space-y-4">
                    <div className="max-h-[380px] space-y-3 overflow-y-auto pr-1">
                      {detail.comments.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                          Belum ada komentar.
                        </div>
                      ) : (
                        detail.comments.map((comment) => (
                          <div
                            key={comment.id}
                            className="rounded-xl border border-slate-200 bg-white p-4"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <div className="text-sm font-bold text-slate-900">
                                  {comment.author_name}
                                </div>

                                <div className="text-[10px] text-slate-500">
                                  {comment.author_role} • {comment.author_department || comment.author_unit}
                                </div>
                              </div>

                              <div className="shrink-0 text-[10px] text-slate-400">
                                {formatDateTime(comment.created_at)}
                              </div>
                            </div>

                            <div className="mt-3 whitespace-pre-wrap text-sm text-slate-700">
                              {comment.body}
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-2 text-xs font-bold text-slate-700">
                        Tambah Komentar
                      </div>

                      <Textarea
                        value={commentText}
                        onChange={(event) =>
                          setCommentText(event.target.value)
                        }
                        placeholder="Tulis update, pertanyaan, atau catatan untuk aktivitas ini..."
                        maxLength={4000}
                      />

                      <div className="mt-2 flex items-center justify-between">
                        <div className="text-[10px] text-slate-400">
                          {commentText.length}/4000
                        </div>

                        <Button
                          size="sm"
                          onClick={handleAddComment}
                          disabled={
                            commentBusy ||
                            !commentText.trim()
                          }
                        >
                          <Send className="mr-2 h-4 w-4" />
                          {commentBusy
                            ? "Mengirim..."
                            : "Kirim Komentar"}
                        </Button>
                      </div>
                    </div>
                  </div>
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
