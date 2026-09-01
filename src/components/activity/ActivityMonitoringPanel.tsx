import React, { useMemo, useState } from "react";
import type { AuthProfile } from "@/contexts/AuthContext";
import type {
  DirectoryProfile,
  UniversalActivity,
  UniversalActivityStatus,
} from "@/services/activityService";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Clock3,
  Eye,
  Gauge,
  ShieldCheck,
  Siren,
  UsersRound,
} from "lucide-react";
import {
  addDays,
  differenceInCalendarDays,
  parseISO,
} from "date-fns";

type Props = {
  currentProfile: AuthProfile;
  activities: UniversalActivity[];
  directory: DirectoryProfile[];
  onOpenActivity: (activityId: string) => void;
};

type AlertType =
  | "APPROVAL"
  | "OVERDUE"
  | "DUE_SOON"
  | "NEED_SUPPORT"
  | "STUCK";

type AlertItem = {
  activity: UniversalActivity;
  types: AlertType[];
  severity: number;
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

const ALERT_LABELS: Record<AlertType, string> = {
  APPROVAL: "Pending Validation",
  OVERDUE: "Overdue",
  DUE_SOON: "Due ≤ 3 Hari",
  NEED_SUPPORT: "Need Support",
  STUCK: "Stuck > 7 Hari",
};

const ALERT_VARIANT_CLASS: Record<AlertType, string> = {
  APPROVAL:
    "border-violet-200 bg-violet-50 text-violet-700",
  OVERDUE:
    "border-red-200 bg-red-50 text-red-700",
  DUE_SOON:
    "border-amber-200 bg-amber-50 text-amber-700",
  NEED_SUPPORT:
    "border-orange-200 bg-orange-50 text-orange-700",
  STUCK:
    "border-slate-300 bg-slate-100 text-slate-700",
};

const ACTIVE_STATUSES = new Set<UniversalActivityStatus>([
  "DRAFT",
  "TO_DO",
  "ON_PROGRESS",
  "WAITING_FOLLOW_UP",
  "NEED_SUPPORT",
  "PENDING_VALIDATION",
]);

const todayKey = () =>
  new Date().toISOString().slice(0, 10);

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

const getOrgLabel = (
  profile?: DirectoryProfile | null
) =>
  profile?.department ||
  profile?.unit ||
  "-";

const getBranchLabel = (
  profile: DirectoryProfile
) => {
  const org = getOrgLabel(profile);

  if (
    org &&
    org !== "-" &&
    org.toLowerCase() !== profile.full_name.toLowerCase()
  ) {
    return `${org} — ${profile.full_name}`;
  }

  return `${profile.full_name} — ${profile.role_level}`;
};

const getDivisionLabel = (
  profile: DirectoryProfile
) => {
  const unit = profile.unit?.trim();

  if (
    unit &&
    unit.toLowerCase() !== "directorate marketing" &&
    unit.toLowerCase() !== "direktorat marketing"
  ) {
    return unit;
  }

  const department = profile.department?.trim();
  if (department) return department;

  if (
    profile.role_level.trim().toUpperCase() === "ADVISOR"
  ) {
    return "Direktorat Marketing / Advisor";
  }

  return getBranchLabel(profile);
};

const isActive = (
  activity: UniversalActivity
) => ACTIVE_STATUSES.has(activity.status);

const isOverdue = (
  activity: UniversalActivity
) =>
  Boolean(
    isActive(activity) &&
      activity.due_date &&
      activity.due_date < todayKey()
  );

const isDueSoon = (
  activity: UniversalActivity
) => {
  if (
    !isActive(activity) ||
    !activity.due_date
  ) {
    return false;
  }

  const today = parseISO(todayKey());
  const due = parseISO(activity.due_date);
  const difference =
    differenceInCalendarDays(due, today);

  return difference >= 0 && difference <= 3;
};

const isStuck = (
  activity: UniversalActivity
) => {
  if (
    !isActive(activity) ||
    activity.status === "PENDING_VALIDATION"
  ) {
    return false;
  }

  const updated = new Date(activity.updated_at);
  const threshold = addDays(new Date(), -7);

  return updated < threshold;
};

const ActivityMonitoringPanel: React.FC<Props> = ({
  currentProfile,
  activities,
  directory,
  onOpenActivity,
}) => {
  const [divisionId, setDivisionId] = useState("ALL");
  const [subUnitId, setSubUnitId] = useState("ALL");
  const [personId, setPersonId] = useState("ALL");
  const [alertFilter, setAlertFilter] = useState<
    AlertType | "ALL"
  >("ALL");

  const roleKey =
    currentProfile.role_level
      ?.trim()
      .toUpperCase() || "";

  const isDirector =
    roleKey === "DIRECTOR" ||
    roleKey === "DIREKTUR";

  const profileMap = useMemo(
    () =>
      new Map(
        directory.map((item) => [
          item.id,
          item,
        ])
      ),
    [directory]
  );

  const childrenMap = useMemo(() => {
    const result = new Map<string, string[]>();

    directory.forEach((item) => {
      if (!item.manager_id) return;

      const list =
        result.get(item.manager_id) || [];

      list.push(item.id);
      result.set(item.manager_id, list);
    });

    return result;
  }, [directory]);

  const directReports = useMemo(
    () =>
      directory
        .filter(
          (item) =>
            item.manager_id ===
            currentProfile.id
        )
        .sort((a, b) =>
          getBranchLabel(a).localeCompare(
            getBranchLabel(b),
            "id"
          )
        ),
    [currentProfile.id, directory]
  );

  const hasSubordinates =
    directReports.length > 0;

  const getSubtreeIds = (
    rootId: string
  ) => {
    const result = new Set<string>();
    const stack = [rootId];

    while (stack.length > 0) {
      const current = stack.pop()!;

      if (result.has(current)) continue;

      result.add(current);

      const children =
        childrenMap.get(current) || [];

      children.forEach((childId) =>
        stack.push(childId)
      );
    }

    return result;
  };

  const divisionOptions = useMemo(
    () =>
      isDirector
        ? [...directReports].sort((a, b) =>
            getDivisionLabel(a).localeCompare(
              getDivisionLabel(b),
              "id"
            )
          )
        : [],
    [directReports, isDirector]
  );

  const subUnitOptions = useMemo(() => {
    if (!hasSubordinates) {
      return [];
    }

    if (!isDirector) {
      return directReports;
    }

    if (divisionId === "ALL") {
      return [];
    }

    return (childrenMap.get(divisionId) || [])
      .map((id) => profileMap.get(id))
      .filter(
        (
          item
        ): item is DirectoryProfile =>
          Boolean(item)
      )
      .sort((a, b) =>
        getBranchLabel(a).localeCompare(
          getBranchLabel(b),
          "id"
        )
      );
  }, [
    childrenMap,
    directReports,
    divisionId,
    hasSubordinates,
    isDirector,
    profileMap,
  ]);

  const divisionScopeIds = useMemo(() => {
    if (!hasSubordinates) {
      return new Set([currentProfile.id]);
    }

    const result = new Set<string>();

    if (
      isDirector &&
      divisionId !== "ALL"
    ) {
      getSubtreeIds(divisionId).forEach(
        (id) => result.add(id)
      );
      return result;
    }

    directReports.forEach((report) => {
      getSubtreeIds(report.id).forEach(
        (id) => result.add(id)
      );
    });

    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    childrenMap,
    currentProfile.id,
    directReports,
    divisionId,
    hasSubordinates,
    isDirector,
  ]);

  const baseScopeIds = useMemo(() => {
    if (
      subUnitId !== "ALL" &&
      divisionScopeIds.has(subUnitId)
    ) {
      return getSubtreeIds(subUnitId);
    }

    return divisionScopeIds;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    childrenMap,
    divisionScopeIds,
    subUnitId,
  ]);

  const scopeProfiles = useMemo(
    () =>
      directory
        .filter((item) =>
          baseScopeIds.has(item.id)
        )
        .sort((a, b) =>
          a.full_name.localeCompare(
            b.full_name,
            "id"
          )
        ),
    [baseScopeIds, directory]
  );

  const selectedScopeIds = useMemo(() => {
    if (personId === "ALL") {
      return baseScopeIds;
    }

    if (!baseScopeIds.has(personId)) {
      return baseScopeIds;
    }

    return new Set([personId]);
  }, [baseScopeIds, personId]);

  const scopeActivities = useMemo(
    () =>
      activities.filter((activity) =>
        selectedScopeIds.has(
          activity.owner_profile_id
        )
      ),
    [activities, selectedScopeIds]
  );

  const activeActivities = useMemo(
    () =>
      scopeActivities.filter(isActive),
    [scopeActivities]
  );

  const overdueActivities = useMemo(
    () =>
      scopeActivities.filter(isOverdue),
    [scopeActivities]
  );

  const dueSoonActivities = useMemo(
    () =>
      scopeActivities.filter(isDueSoon),
    [scopeActivities]
  );

  const pendingValidationActivities =
    useMemo(
      () =>
        scopeActivities.filter(
          (activity) =>
            activity.status ===
            "PENDING_VALIDATION"
        ),
      [scopeActivities]
    );

  const stuckActivities = useMemo(
    () =>
      scopeActivities.filter(isStuck),
    [scopeActivities]
  );

  const needSupportActivities = useMemo(
    () =>
      scopeActivities.filter(
        (activity) =>
          activity.status ===
          "NEED_SUPPORT"
      ),
    [scopeActivities]
  );

  const alerts = useMemo(() => {
    const result: AlertItem[] = [];

    scopeActivities.forEach((activity) => {
      const types: AlertType[] = [];

      if (
        activity.status ===
        "PENDING_VALIDATION"
      ) {
        types.push("APPROVAL");
      }

      if (isOverdue(activity)) {
        types.push("OVERDUE");
      }

      if (
        activity.status ===
        "NEED_SUPPORT"
      ) {
        types.push("NEED_SUPPORT");
      }

      if (isDueSoon(activity)) {
        types.push("DUE_SOON");
      }

      if (isStuck(activity)) {
        types.push("STUCK");
      }

      if (types.length === 0) {
        return;
      }

      let severity = 1;

      if (types.includes("OVERDUE")) {
        severity = 5;
      } else if (
        types.includes("NEED_SUPPORT")
      ) {
        severity = 4;
      } else if (
        types.includes("APPROVAL")
      ) {
        severity = 3;
      } else if (
        types.includes("DUE_SOON")
      ) {
        severity = 2;
      }

      result.push({
        activity,
        types,
        severity,
      });
    });

    return result.sort((a, b) => {
      if (b.severity !== a.severity) {
        return b.severity - a.severity;
      }

      const aDue =
        a.activity.due_date ||
        "9999-12-31";
      const bDue =
        b.activity.due_date ||
        "9999-12-31";

      return aDue.localeCompare(bDue);
    });
  }, [scopeActivities]);

  const filteredAlerts = useMemo(
    () =>
      alertFilter === "ALL"
        ? alerts
        : alerts.filter((item) =>
            item.types.includes(
              alertFilter
            )
          ),
    [alertFilter, alerts]
  );

  const workloadRows = useMemo(() => {
    return scopeProfiles
      .map((person) => {
        const owned =
          scopeActivities.filter(
            (activity) =>
              activity.owner_profile_id ===
              person.id
          );

        const active =
          owned.filter(isActive);

        const avgProgress =
          active.length > 0
            ? Math.round(
                active.reduce(
                  (sum, item) =>
                    sum +
                    item.progress,
                  0
                ) /
                  active.length
              )
            : 0;

        return {
          person,
          total: owned.length,
          active: active.length,
          done: owned.filter(
            (item) =>
              item.status ===
              "DONE"
          ).length,
          cancelled: owned.filter(
            (item) =>
              item.status ===
              "CANCELLED"
          ).length,
          onProgress: owned.filter(
            (item) =>
              item.status ===
              "ON_PROGRESS"
          ).length,
          overdue:
            owned.filter(isOverdue)
              .length,
          dueSoon:
            owned.filter(isDueSoon)
              .length,
          pending: owned.filter(
            (item) =>
              item.status ===
              "PENDING_VALIDATION"
          ).length,
          avgProgress,
        };
      })
      .sort((a, b) => {
        if (
          b.overdue !== a.overdue
        ) {
          return (
            b.overdue - a.overdue
          );
        }

        if (
          b.active !== a.active
        ) {
          return b.active - a.active;
        }

        return a.person.full_name.localeCompare(
          b.person.full_name,
          "id"
        );
      });
  }, [
    scopeActivities,
    scopeProfiles,
  ]);

  const selectedDivisionName = useMemo(() => {
    if (!isDirector) {
      return null;
    }

    if (divisionId === "ALL") {
      return "Semua Divisi";
    }

    const division =
      profileMap.get(divisionId);

    return division
      ? getDivisionLabel(division)
      : "Divisi";
  }, [
    divisionId,
    isDirector,
    profileMap,
  ]);

  const selectedSubUnitName = useMemo(() => {
    if (!hasSubordinates) {
      return "Aktivitas Saya";
    }

    if (subUnitId === "ALL") {
      if (isDirector) {
        return divisionId === "ALL"
          ? "Semua Sub Unit"
          : "Semua Sub Unit di Divisi";
      }

      return "Semua Sub Unit";
    }

    const subUnit =
      profileMap.get(subUnitId);

    return subUnit
      ? getBranchLabel(subUnit)
      : "Sub Unit";
  }, [
    divisionId,
    hasSubordinates,
    isDirector,
    profileMap,
    subUnitId,
  ]);

  const summaryCards = [
    {
      label: "Active",
      value: activeActivities.length,
      icon: Gauge,
      className:
        "bg-blue-50 text-blue-700",
    },
    {
      label: "Overdue",
      value: overdueActivities.length,
      icon: Siren,
      className:
        "bg-red-50 text-red-700",
    },
    {
      label: "Due ≤ 3 Hari",
      value: dueSoonActivities.length,
      icon: Clock3,
      className:
        "bg-amber-50 text-amber-700",
    },
    {
      label: "Pending Validation",
      value:
        pendingValidationActivities.length,
      icon: ShieldCheck,
      className:
        "bg-violet-50 text-violet-700",
    },
    {
      label: "Stuck > 7 Hari",
      value: stuckActivities.length,
      icon: AlertTriangle,
      className:
        "bg-slate-100 text-slate-700",
    },
    {
      label: "Need Support",
      value:
        needSupportActivities.length,
      icon: BellRing,
      className:
        "bg-orange-50 text-orange-700",
    },
  ];

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <CardTitle className="text-base">
                {hasSubordinates
                  ? "Monitoring Tim & Alerts"
                  : "Alerts Aktivitas Saya"}
              </CardTitle>

              <p className="mt-1 text-xs text-slate-500">
                {hasSubordinates
                  ? isDirector
                    ? "Filter Direktur: pilih Divisi, lalu Sub Unit dan PIC. Scope tetap mengikuti hierarchy organisasi."
                    : "Scope mengikuti hierarchy organisasi. Pilih sub unit dan PIC untuk mempermudah monitoring."
                  : "Menampilkan aktivitas pribadi yang membutuhkan perhatian."}
              </p>
            </div>

            {hasSubordinates && (
              <div className="grid w-full gap-2 sm:grid-cols-2 xl:w-auto xl:grid-cols-3">
                {isDirector && (
                  <Select
                    value={divisionId}
                    onValueChange={(value) => {
                      setDivisionId(value);
                      setSubUnitId("ALL");
                      setPersonId("ALL");
                    }}
                  >
                    <SelectTrigger className="w-full xl:w-[230px]">
                      <SelectValue placeholder="Pilih Divisi" />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="ALL">
                        Semua Divisi
                      </SelectItem>

                      {divisionOptions.map(
                        (division) => (
                          <SelectItem
                            key={division.id}
                            value={division.id}
                          >
                            {getDivisionLabel(
                              division
                            )}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                )}

                <Select
                  value={subUnitId}
                  onValueChange={(value) => {
                    setSubUnitId(value);
                    setPersonId("ALL");
                  }}
                  disabled={
                    isDirector &&
                    divisionId === "ALL"
                  }
                >
                  <SelectTrigger className="w-full xl:w-[280px]">
                    <SelectValue
                      placeholder={
                        isDirector &&
                        divisionId === "ALL"
                          ? "Pilih Divisi dulu"
                          : "Pilih Sub Unit"
                      }
                    />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="ALL">
                      Semua Sub Unit
                    </SelectItem>

                    {subUnitOptions.map(
                      (subUnit) => (
                        <SelectItem
                          key={subUnit.id}
                          value={subUnit.id}
                        >
                          {getBranchLabel(
                            subUnit
                          )}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>

                <Select
                  value={personId}
                  onValueChange={setPersonId}
                >
                  <SelectTrigger className="w-full xl:w-[230px]">
                    <SelectValue placeholder="Pilih PIC" />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="ALL">
                      Semua PIC
                    </SelectItem>

                    {scopeProfiles.map(
                      (person) => (
                        <SelectItem
                          key={person.id}
                          value={person.id}
                        >
                          {person.full_name}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Scope aktif:{" "}
            {selectedDivisionName && (
              <>
                <span className="font-bold text-slate-900">
                  {selectedDivisionName}
                </span>
                {" • "}
              </>
            )}
            <span className="font-bold text-slate-900">
              {selectedSubUnitName}
            </span>

            {personId !== "ALL" && (
              <>
                {" • PIC: "}
                <span className="font-bold text-slate-900">
                  {
                    profileMap.get(
                      personId
                    )?.full_name
                  }
                </span>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {summaryCards.map((item) => {
          const Icon = item.icon;

          return (
            <Card key={item.label}>
              <CardContent className="p-4">
                <div
                  className={`mb-3 inline-flex rounded-lg p-2 ${item.className}`}
                >
                  <Icon className="h-4 w-4" />
                </div>

                <div className="text-2xl font-black text-slate-900">
                  {item.value}
                </div>

                <div className="mt-1 text-[11px] text-slate-500">
                  {item.label}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <BellRing className="h-4 w-4" />
                  Notification Center
                </CardTitle>

                <p className="mt-1 text-[11px] text-slate-500">
                  Live alert berdasarkan kondisi activity, bukan notifikasi manual.
                </p>
              </div>

              <Select
                value={alertFilter}
                onValueChange={(value) =>
                  setAlertFilter(
                    value as
                      | AlertType
                      | "ALL"
                  )
                }
              >
                <SelectTrigger className="w-full sm:w-[190px]">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="ALL">
                    Semua Alert
                  </SelectItem>

                  {(
                    Object.keys(
                      ALERT_LABELS
                    ) as AlertType[]
                  ).map((type) => (
                    <SelectItem
                      key={type}
                      value={type}
                    >
                      {ALERT_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>

          <CardContent>
            {filteredAlerts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />

                <div className="mt-3 text-sm font-bold text-slate-900">
                  Tidak ada alert
                </div>

                <div className="mt-1 text-xs text-slate-500">
                  Scope ini tidak memiliki aktivitas yang membutuhkan perhatian.
                </div>
              </div>
            ) : (
              <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
                {filteredAlerts.map(
                  ({
                    activity,
                    types,
                  }) => {
                    const owner =
                      profileMap.get(
                        activity.owner_profile_id
                      );

                    return (
                      <div
                        key={activity.id}
                        className="rounded-xl border border-slate-200 bg-white p-4"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900">
                              {activity.title}
                            </div>

                            <div className="mt-1 text-[11px] text-slate-500">
                              {owner?.full_name ||
                                "-"}
                              {" • "}
                              {getOrgLabel(
                                owner
                              )}
                              {" • "}
                              {
                                STATUS_LABELS[
                                  activity.status
                                ]
                              }
                            </div>

                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {types.map(
                                (type) => (
                                  <span
                                    key={type}
                                    className={`rounded-full border px-2 py-1 text-[9px] font-bold ${ALERT_VARIANT_CLASS[type]}`}
                                  >
                                    {
                                      ALERT_LABELS[
                                        type
                                      ]
                                    }
                                  </span>
                                )
                              )}
                            </div>

                            <div className="mt-2 text-[10px] text-slate-500">
                              Due:{" "}
                              <span className="font-semibold text-slate-700">
                                {formatDateOnly(
                                  activity.due_date
                                )}
                              </span>
                              {" • "}
                              Progress:{" "}
                              <span className="font-semibold text-slate-700">
                                {
                                  activity.progress
                                }
                                %
                              </span>
                            </div>
                          </div>

                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="shrink-0"
                            onClick={() =>
                              onOpenActivity(
                                activity.id
                              )
                            }
                          >
                            <Eye className="mr-1.5 h-4 w-4" />
                            Detail
                          </Button>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <UsersRound className="h-4 w-4" />
              Workload per PIC
            </CardTitle>

            <p className="text-[11px] text-slate-500">
              Prioritas urutan: overdue tertinggi, lalu aktivitas aktif terbanyak. Angka mengikuti Periode Aktivitas yang dipilih.
            </p>
          </CardHeader>

          <CardContent>
            <div className="max-h-[520px] overflow-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[840px] text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 text-[9px] uppercase text-slate-500">
                  <tr>
                    <th className="p-3">
                      PIC
                    </th>
                    <th className="p-3 text-center">
                      Aktivitas
                    </th>
                    <th className="p-3 text-center">
                      Active
                    </th>
                    <th className="p-3 text-center">
                      Done
                    </th>
                    <th className="p-3 text-center">
                      Cancelled
                    </th>
                    <th className="p-3 text-center">
                      On Prog
                    </th>
                    <th className="p-3 text-center">
                      Overdue
                    </th>
                    <th className="p-3 text-center">
                      Due 3D
                    </th>
                    <th className="p-3 text-center">
                      Pending
                    </th>
                    <th className="p-3">
                      Avg Progress
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {workloadRows.map(
                    (row) => (
                      <tr
                        key={
                          row.person.id
                        }
                      >
                        <td className="p-3">
                          <div className="font-bold text-slate-900">
                            {
                              row.person
                                .full_name
                            }
                          </div>

                          <div className="mt-0.5 text-[9px] text-slate-500">
                            {
                              row.person
                                .role_level
                            }
                            {" • "}
                            {getOrgLabel(
                              row.person
                            )}
                          </div>
                        </td>

                        <td className="p-3 text-center font-black text-slate-900">
                          {row.total}
                        </td>

                        <td className="p-3 text-center font-semibold">
                          {row.active}
                        </td>

                        <td className="p-3 text-center font-semibold text-emerald-700">
                          {row.done}
                        </td>

                        <td className="p-3 text-center font-semibold text-slate-600">
                          {row.cancelled}
                        </td>

                        <td className="p-3 text-center">
                          {
                            row.onProgress
                          }
                        </td>

                        <td className="p-3 text-center">
                          <span
                            className={
                              row.overdue > 0
                                ? "font-black text-red-700"
                                : ""
                            }
                          >
                            {row.overdue}
                          </span>
                        </td>

                        <td className="p-3 text-center">
                          {row.dueSoon}
                        </td>

                        <td className="p-3 text-center">
                          {row.pending}
                        </td>

                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full bg-blue-600"
                                style={{
                                  width: `${Math.max(
                                    0,
                                    Math.min(
                                      100,
                                      row.avgProgress
                                    )
                                  )}%`,
                                }}
                              />
                            </div>

                            <div className="w-8 text-right text-[10px] font-bold">
                              {
                                row.avgProgress
                              }
                              %
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-[11px] text-slate-600">
        <span className="font-bold text-slate-800">
          Rule alert:
        </span>{" "}
        Overdue = due date lewat dan belum selesai; Due ≤ 3 Hari = jatuh tempo hari ini sampai 3 hari ke depan; Stuck = activity aktif tanpa update lebih dari 7 hari; Pending Validation = sudah diajukan dan menunggu approval; Need Support = status membutuhkan bantuan.
      </div>
    </div>
  );
};

export default ActivityMonitoringPanel;
