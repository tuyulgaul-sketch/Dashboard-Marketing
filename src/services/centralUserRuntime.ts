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

let currentRuntimeId:
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

  // Digital & Affinity menggunakan role business-compatible yang sudah ada
  // di legacy type agar fitur kolaboratif dapat memakai hierarchy runtime
  // tanpa menambah ketergantungan ke modul komersial lama.
  if (
    department ===
      "digital & affinity"
  ) {
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

const profileRuntimeId = (
  profile:
    AuthProfile
) =>
  profile.legacy_user_id?.trim()
    ? profile.legacy_user_id
        .trim()
        .toUpperCase()
    : `PRF-${profile.id}`;

const profileFallbackRow = (
  profile:
    AuthProfile
): DirectoryRow => ({
  profile_id:
    profile.id,
  legacy_user_id:
    profileRuntimeId(
      profile
    ),
  full_name:
    profile.full_name,
  email:
    profile.email,
  role_level:
    profile.role_level,
  unit:
    profile.unit,
  department:
    profile.department,
  manager_profile_id:
    profile.manager_id,
  manager_legacy_user_id:
    null,
  active:
    profile.active,
});

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
          currentRuntimeId
        ) {
          const current =
            users.find(
              user =>
                user.id ===
                currentRuntimeId
            );

          if (
            current
          ) {
            return {
              ...current,
            };
          }
        }

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

const loadDirectoryRows =
  async (): Promise<DirectoryRow[]> => {
    const v14 =
      await supabase.rpc(
        "get_business_user_directory_v14"
      );

    if (
      !v14.error
    ) {
      return (
        v14.data ||
        []
      ) as DirectoryRow[];
    }

    // Deployment-safe fallback sampai migration V14 dijalankan.
    const legacy =
      await supabase.rpc(
        "get_legacy_user_directory"
      );

    if (
      legacy.error
    ) {
      throw legacy.error;
    }

    return (
      legacy.data ||
      []
    ) as DirectoryRow[];
  };

export const syncCentralUserRuntime =
  async (
    profile:
      AuthProfile
  ) => {
    patchStore();

    const rows =
      await loadDirectoryRows();

    users =
      rows
        .map(
          row =>
            toUser(
              row
            )
        )
        .filter(
          user =>
            user.status ===
            "Active"
        );

    currentRuntimeId =
      profileRuntimeId(
        profile
      );

    // Profile tanpa legacy_user_id tetap mendapat runtime identity yang
    // deterministik. Setelah RPC V14 tersedia, identity yang sama juga
    // muncul pada directory penerima user lain.
    if (
      !users.some(
        user =>
          user.id ===
          currentRuntimeId
      )
    ) {
      users.push(
        toUser(
          profileFallbackRow(
            profile
          )
        )
      );
    }

    notify();
  };

export const clearCentralUserRuntime =
  () => {
    users =
      [];

    currentRuntimeId =
      null;
  };
