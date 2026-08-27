import { store } from "@/services/store";

type SupabaseLegacyIdentity = {
  legacy_user_id: string | null;
  full_name: string;
  email: string;
  role_level: string;
  unit: string;
  department: string | null;
};

const LEGACY_USERS_STORAGE_KEY =
  "pertalife_users";

const buildHaikhalLegacyUser = (
  profile: SupabaseLegacyIdentity
) => ({
  id: "USR-000032",
  name: profile.full_name,
  email: profile.email,
  role: "STAFF_MARKETING",
  position: "Staff Captive II",
  unit: "Captive Marketing",
  department: "Captive II",
  superiorId: "USR-000007",
  status: "Active",
});

export const syncLegacyIdentityFromSupabase = (
  profile: SupabaseLegacyIdentity
) => {
  const requestedId =
    (profile.legacy_user_id || "").trim();

  if (!requestedId) {
    return;
  }

  let users = store.getUsers();

  // Final hierarchy corrections for old browser-only UAT data.
  users = users.map((user) => {
    if (user.id === "USR-000009") {
      return {
        ...user,
        role: "SUPERVISOR_MARKETING",
        position: "Supervisor Captive II",
        superiorId: "USR-000007",
      };
    }

    if (
      user.id === "USR-000026" ||
      user.id === "USR-000027"
    ) {
      return {
        ...user,
        superiorId: "USR-000028",
      };
    }

    return user;
  });

  // Hidayatulloh's old slot USR-000008 is intentionally NOT reused.
  // It may still be referenced by historical UAT records.
  if (
    requestedId === "USR-000032" &&
    !users.some(
      (user) => user.id === "USR-000032"
    )
  ) {
    users.push(
      buildHaikhalLegacyUser(profile) as any
    );
  }

  const targetIndex =
    users.findIndex(
      (user) => user.id === requestedId
    );

  if (targetIndex < 0) {
    console.warn(
      `[Auth] Legacy user ${requestedId} tidak ditemukan pada UAT user master.`
    );
    return;
  }

  users[targetIndex] = {
    ...users[targetIndex],
    name: profile.full_name,
    email: profile.email,
  };

  localStorage.setItem(
    LEGACY_USERS_STORAGE_KEY,
    JSON.stringify(users)
  );

  const current = store.getCurrentUser();

  if (current?.id === requestedId) {
    return;
  }

  store.setCurrentUser(requestedId);
};
