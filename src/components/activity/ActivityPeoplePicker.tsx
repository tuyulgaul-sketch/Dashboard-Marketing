import React, { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Check,
  Search,
  Star,
  UsersRound,
  X,
} from "lucide-react";
import type { DirectoryProfile } from "@/services/activityService";

type ActivityPeoplePickerProps = {
  directory: DirectoryProfile[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  excludedIds?: string[];
  recommendedProfileIds?: string[];
  currentUserId?: string | null;
  label?: string;
  helperText?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
};

const normalize = (value?: string | null) =>
  (value || "").trim().toLocaleLowerCase("id");

const isSystemAccount = (profile: DirectoryProfile) => {
  const role = normalize(profile.role_level);
  const unit = normalize(profile.unit);
  const department = normalize(profile.department);

  return (
    role.includes("system_admin") ||
    (role.includes("system") && role.includes("admin")) ||
    unit === "administrasi sistem" ||
    department === "administrasi sistem"
  );
};

const preferredUnitOrder = [
  "captive marketing",
  "corporate & retail marketing",
  "marketing support",
  "direktorat marketing",
  "directorate marketing",
];

const sortByName = (a: DirectoryProfile, b: DirectoryProfile) =>
  a.full_name.localeCompare(b.full_name, "id");

const ActivityPeoplePicker: React.FC<ActivityPeoplePickerProps> = ({
  directory,
  selectedIds,
  onChange,
  excludedIds = [],
  recommendedProfileIds = [],
  currentUserId,
  label = "Pilih Kolaborator",
  helperText,
  placeholder = "Cari nama, unit, department, atau jabatan...",
  required = false,
  disabled = false,
}) => {
  const [query, setQuery] = useState("");

  const excluded = useMemo(
    () =>
      new Set(
        [...excludedIds, currentUserId || ""].filter(Boolean)
      ),
    [excludedIds, currentUserId]
  );

  const selectedSet = useMemo(
    () => new Set(selectedIds),
    [selectedIds]
  );

  const visibleProfiles = useMemo(() => {
    const keyword = normalize(query);

    return directory
      .filter((profile) => {
        if (excluded.has(profile.id)) return false;
        if (isSystemAccount(profile)) return false;

        if (!keyword) return true;

        const haystack = [
          profile.full_name,
          profile.role_level,
          profile.unit,
          profile.department,
        ]
          .map(normalize)
          .join(" ");

        return haystack.includes(keyword);
      })
      .sort(sortByName);
  }, [directory, excluded, query]);

  const recommendedProfiles = useMemo(() => {
    const recommended = new Set(recommendedProfileIds);

    return visibleProfiles.filter((profile) =>
      recommended.has(profile.id)
    );
  }, [recommendedProfileIds, visibleProfiles]);

  const groupedProfiles = useMemo(() => {
    const recommended = new Set(recommendedProfileIds);
    const unitMap = new Map<
      string,
      {
        label: string;
        departments: Map<string, DirectoryProfile[]>;
      }
    >();

    visibleProfiles
      .filter((profile) => !recommended.has(profile.id))
      .forEach((profile) => {
        const unitLabel = profile.unit?.trim() || "Unit Lainnya";
        const unitKey = normalize(unitLabel) || "unit-lainnya";
        const departmentLabel =
          profile.department?.trim() || "Umum / Tanpa Sub Unit";
        const departmentKey =
          normalize(departmentLabel) || "umum-tanpa-sub-unit";

        if (!unitMap.has(unitKey)) {
          unitMap.set(unitKey, {
            label: unitLabel,
            departments: new Map(),
          });
        }

        const unitGroup = unitMap.get(unitKey)!;

        if (!unitGroup.departments.has(departmentKey)) {
          unitGroup.departments.set(departmentKey, []);
        }

        unitGroup.departments.get(departmentKey)!.push(profile);
      });

    return Array.from(unitMap.entries())
      .map(([key, unit]) => ({
        key,
        label: unit.label,
        departments: Array.from(unit.departments.entries())
          .map(([departmentKey, items]) => ({
            key: departmentKey,
            label:
              items[0]?.department?.trim() || "Umum / Tanpa Sub Unit",
            items: [...items].sort(sortByName),
          }))
          .sort((a, b) => a.label.localeCompare(b.label, "id")),
      }))
      .sort((a, b) => {
        const aIndex = preferredUnitOrder.indexOf(a.key);
        const bIndex = preferredUnitOrder.indexOf(b.key);

        if (aIndex !== -1 || bIndex !== -1) {
          if (aIndex === -1) return 1;
          if (bIndex === -1) return -1;
          return aIndex - bIndex;
        }

        return a.label.localeCompare(b.label, "id");
      });
  }, [recommendedProfileIds, visibleProfiles]);

  const selectedProfiles = useMemo(
    () =>
      selectedIds
        .map((id) => directory.find((profile) => profile.id === id))
        .filter((profile): profile is DirectoryProfile => Boolean(profile)),
    [directory, selectedIds]
  );

  const toggleProfile = (profileId: string) => {
    if (disabled) return;

    if (selectedSet.has(profileId)) {
      onChange(selectedIds.filter((id) => id !== profileId));
      return;
    }

    onChange([...selectedIds, profileId]);
  };

  const renderPersonRow = (
    profile: DirectoryProfile,
    recommended = false
  ) => {
    const selected = selectedSet.has(profile.id);

    return (
      <button
        key={profile.id}
        type="button"
        disabled={disabled}
        onClick={() => toggleProfile(profile.id)}
        className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition ${
          selected
            ? "border-blue-200 bg-blue-50"
            : "border-transparent bg-white hover:border-slate-200 hover:bg-slate-50"
        } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
      >
        <div
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
            selected
              ? "border-blue-600 bg-blue-600 text-white"
              : "border-slate-300 bg-white text-transparent"
          }`}
        >
          <Check className="h-3.5 w-3.5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <div className="truncate text-xs font-bold text-slate-900">
              {profile.full_name}
            </div>

            {recommended && (
              <Badge
                variant="secondary"
                className="h-5 gap-1 px-1.5 text-[9px]"
              >
                <Star className="h-3 w-3" />
                Recommended
              </Badge>
            )}
          </div>

          <div className="mt-0.5 truncate text-[10px] text-slate-500">
            {profile.role_level}
            {profile.department ? ` • ${profile.department}` : ""}
            {profile.unit ? ` • ${profile.unit}` : ""}
          </div>
        </div>
      </button>
    );
  };

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <label className="block text-xs font-bold text-slate-700">
          {label}
          {required ? " *" : ""}
        </label>

        <div className="text-[10px] font-semibold text-slate-400">
          {selectedIds.length} dipilih
        </div>
      </div>

      {selectedProfiles.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {selectedProfiles.map((profile) => (
            <Badge
              key={profile.id}
              variant="secondary"
              className="gap-1 py-1"
            >
              {profile.full_name}
              <button
                type="button"
                disabled={disabled}
                onClick={() => toggleProfile(profile.id)}
                className="ml-1 rounded hover:bg-slate-300/50 disabled:cursor-not-allowed"
                aria-label={`Hapus ${profile.full_name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-2.5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={placeholder}
              disabled={disabled}
              className="pl-9"
            />
          </div>
        </div>

        <div className="max-h-72 overflow-y-auto p-2">
          {recommendedProfiles.length > 0 && (
            <div className="mb-2 rounded-lg border border-amber-100 bg-amber-50/50 p-2">
              <div className="mb-1.5 flex items-center gap-1.5 px-1 text-[9px] font-black uppercase tracking-[0.14em] text-amber-700">
                <Star className="h-3 w-3" />
                Recommended
              </div>

              <div className="space-y-1">
                {recommendedProfiles.map((profile) =>
                  renderPersonRow(profile, true)
                )}
              </div>
            </div>
          )}

          {groupedProfiles.length === 0 &&
          recommendedProfiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-8 text-center text-slate-400">
              <UsersRound className="mb-2 h-6 w-6" />
              <div className="text-xs font-semibold">
                Tidak ada user yang cocok.
              </div>
              <div className="mt-1 text-[10px]">
                Coba cari nama, unit, department, atau jabatan lain.
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {groupedProfiles.map((unit) => (
                <div key={unit.key}>
                  <div className="sticky top-0 z-10 rounded-md bg-slate-100 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-slate-600">
                    {unit.label}
                  </div>

                  <div className="mt-1.5 space-y-2">
                    {unit.departments.map((department) => (
                      <div key={`${unit.key}-${department.key}`}>
                        <div className="px-2 py-1 text-[10px] font-bold text-slate-500">
                          {department.label} ({department.items.length})
                        </div>

                        <div className="space-y-1">
                          {department.items.map((profile) =>
                            renderPersonRow(profile)
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {helperText && (
        <p className="mt-1.5 text-[10px] leading-4 text-slate-500">
          {helperText}
        </p>
      )}
    </div>
  );
};

export default ActivityPeoplePicker;
