import type {
  AuthProfile,
} from "@/contexts/AuthContext";

import type {
  DepartmentType,
  UnitType,
  User,
  UserRole,
} from "@/types";

import {
  supabase,
} from "@/lib/supabase";

import {
  store,
} from "@/services/store";

type DirectoryRow = {
  profile_id: string;
  legacy_user_id: string;
  full_name: string;
  email: string;
  role_level: string;
  unit: string;
  department: string | null;
  manager_profile_id: string | null;
  manager_legacy_user_id: string | null;
  active: boolean;
};

let users:
  User[] =
  [];

let installed =
  false;

let currentLegacyId:
  string | null =
  null;

const normalizeOrg = (
  row:
    DirectoryRow
): {
  unit:
    UnitType;
  department:
    DepartmentType;
} => {
  const unit =
    String(
      row.unit ||
      ""
    ).trim();

  const department =
    String(
      row.department ||
      ""
    ).trim();

  if (
    [
      "Captive I",
      "Captive II",
      "Captive III",
    ].includes(
      unit
    )
  ) {
    return {
      unit:
        "Captive Marketing",
      department:
        unit as DepartmentType,
    };
  }

  if (
    [
      "CRM I",
      "CRM II",
      "CRM III",
    ].includes(
      unit
    )
  ) {
    return {
      unit:
        "Corporate & Retail Marketing",
      department:
        unit as DepartmentType,
    };
  }

  if (
    unit ===
      "Directorate Marketing"
  ) {
    return {
      unit:
        "Direktorat Pemasaran",
      department:
        "None",
    };
  }

  if (
    unit ===
      "Captive Marketing"
  ) {
    return {
      unit:
        "Captive Marketing",
      department:
        "None",
    };
  }

  if (
    unit ===
      "Corporate & Retail Marketing"
  ) {
    return {
      unit:
        "Corporate & Retail Marketing",
      department:
        "None",
    };
  }

  if (
    unit ===
      "Marketing Support"
  ) {
    return {
      unit:
        "Marketing Support",
      department:
        (
          department ||
          "None"
        ) as DepartmentType,
    };
  }

  if (
    unit ===
      "Administrasi Sistem"
  ) {
    return {
      unit:
        "Administrasi Sistem",
      department:
        "None",
    };
  }

  // Conservative compatibility fallback.
  return {
    unit:
      unit as UnitType,
    department:
      (
        department ||
        "None"
      ) as DepartmentType,
  };
};

const mapRole = (
  row:
    DirectoryRow
): UserRole => {
  const role =
    String(
      row.role_level ||
      ""
    )
      .trim()
      .toUpperCase();

  const unit =
    String(
      row.unit ||
      ""
    )
      .trim()
      .toLowerCase();

  const department =
    String(
      row.department ||
      ""
    )
      .trim()
      .toLowerCase();

  const legacy =
    String(
      row.legacy_user_id ||
      ""
    )
      .trim()
      .toUpperCase();

  if (
    role ===
      "SYSTEM_ADMIN"
  ) {
    return "SYSTEM_ADMIN";
  }

  if (
    legacy ===
      "USR-000024"
  ) {
    return "TEAM_LEADER_MARKETING_SUPPORT";
  }

  if (
    department ===
      "marketing administration"
  ) {
    if (
      role ===
        "DH"
    ) {
      return "DEPARTMENT_HEAD_MARKETING_ADMINISTRATION";
    }

    if (
      role ===
        "SPV"
    ) {
      return "SUPERVISOR_MARKETING_ADMINISTRATION";
    }

    return "STAFF_MARKETING_ADMINISTRATION";
  }

  if (
    department ===
      "marketing communication"
  ) {
    if (
      role ===
        "DH"
    ) {
      return "DEPARTMENT_HEAD_MARKETING_COMMUNICATION";
    }

    return "STAFF_MARKETING_COMMUNICATION";
  }

  if (
    role ===
      "DIRECTOR"
  ) {
    return "DIRECTOR_MARKETING";
  }

  if (
    role ===
      "ADVISOR"
  ) {
    return "ADVISOR_MARKETING_DIRECTOR";
  }

  if (
    role ===
      "VP"
  ) {
    if (
      unit ===
        "captive marketing"
    ) {
      return "VP_CAPTIVE_MARKETING";
    }

    return "VP_CORPORATE_RETAIL_MARKETING";
  }

  if (
    role ===
      "DH"
  ) {
    return "DEPARTMENT_HEAD_MARKETING";
  }

  if (
    role ===
      "SPV"
  ) {
    return "SUPERVISOR_MARKETING";
  }

  return "STAFF_MARKETING";
};

const toUser = (
  row:
    DirectoryRow
): User => {
  const org =
    normalizeOrg(
      row
    );

  return {
    id:
      row.legacy_user_id,
    name:
      row.full_name,
    email:
      row.email,
    role:
      mapRole(
        row
      ),
    position:
      `${row.role_level} ${row.unit}`.trim(),
    unit:
      org.unit,
    department:
      org.department,
    superiorId:
      row.manager_legacy_user_id ||
      null,
    status:
      row.active
        ? "Active"
        : "Inactive",
  };
};

const notify =
  () => {
    const candidate =
      store as unknown as {
        notify?: () => void;
      };

    candidate.notify?.();
  };

const patchStore =
  () => {
    if (
      installed
    ) {
      return;
    }

    installed =
      true;

    store.getUsers =
      () =>
        users.map(
          user => ({
            ...user,
          })
        );

    const legacyGetCurrentUser =
      store.getCurrentUser.bind(
        store
      );

    store.getCurrentUser =
      () => {
        if (
          currentLegacyId
        ) {
          const current =
            users.find(
              user =>
                user.id ===
                currentLegacyId
            );

          if (
            current
          ) {
            return {
              ...current,
            };
          }
        }

        // Non-legacy users (e.g. Digital & Affinity) do not use old
        // commercial modules; preserve the existing compatibility fallback.
        return legacyGetCurrentUser();
      };

    store.getSubordinateUserIds =
      (
        managerId:
          string
      ) => {
        const result =
          new Set<string>([
            managerId,
          ]);

        const visit =
          (
            parentId:
              string
          ) => {
            users
              .filter(
                user =>
                  user.superiorId ===
                  parentId
              )
              .forEach(
                child => {
                  if (
                    result.has(
                      child.id
                    )
                  ) {
                    return;
                  }

                  result.add(
                    child.id
                  );

                  visit(
                    child.id
                  );
                }
              );
          };

        visit(
          managerId
        );

        return Array.from(
          result
        );
      };
  };

export const syncCentralUserRuntime =
  async (
    profile:
      AuthProfile
  ) => {
    patchStore();

    const {
      data,
      error,
    } =
      await supabase.rpc(
        "get_legacy_user_directory"
      );

    if (
      error
    ) {
      throw error;
    }

    users =
      (
        data ||
        []
      )
        .map(
          row =>
            toUser(
              row as DirectoryRow
            )
        )
        .filter(
          user =>
            user.status ===
            "Active"
        );

    currentLegacyId =
      profile.legacy_user_id
        ? profile.legacy_user_id
            .trim()
            .toUpperCase()
        : null;

    notify();
  };

export const clearCentralUserRuntime =
  () => {
    users =
      [];

    currentLegacyId =
      null;
  };
