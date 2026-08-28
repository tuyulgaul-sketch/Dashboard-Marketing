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

const buildHaikhalLegacyUser = () => ({
  id: "USR-000032",
  name: "Haikhal Khadafi",
  email: "haikhal.khadafi@pertalife.com",
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

  /**
   * Canonical hierarchy normalization for old browser-only UAT data.
   *
   * This runs for EVERY authenticated legacy user so Target/RKAP checker
   * does not depend on which user happened to log in previously on the
   * same browser.
   *
   * Final target-holder hierarchy:
   * - USR-000008 Hidayatulloh: inactive / historical only; ID not reused.
   * - USR-000009 Ganesti: SPV Captive II, direct to Resty (USR-000007).
   * - USR-000032 Haikhal: Staff Captive II, direct to Resty.
   * - USR-000013 Prisko: Staff Captive III, direct to Affit (USR-000010).
   * - USR-000026/027 Marketing Administration: direct to Endah (USR-000028).
   */
  users = users.map((user) => {
    if (user.id === "USR-000008") {
      return {
        ...user,
        status: "Inactive",
      };
    }

    if (user.id === "USR-000009") {
      return {
        ...user,
        role: "SUPERVISOR_MARKETING",
        position: "Supervisor Captive II",
        superiorId: "USR-000007",
        status: "Active",
      };
    }

    if (user.id === "USR-000032") {
      return {
        ...user,
        role: "STAFF_MARKETING",
        position: "Staff Captive II",
        unit: "Captive Marketing",
        department: "Captive II",
        superiorId: "USR-000007",
        status: "Active",
      };
    }

    if (user.id === "USR-000013") {
      return {
        ...user,
        role: "STAFF_MARKETING",
        position: "Staff Captive III",
        unit: "Captive Marketing",
        department: "Captive III",
        superiorId: "USR-000010",
        status: "Active",
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

  // USR-000008 remains historical and is intentionally never reused.
  // Ensure Haikhal exists in every browser's legacy user master, even
  // when the current login is Arianie/Director/another user.
  if (
    !users.some(
      (user) => user.id === "USR-000032"
    )
  ) {
    users.push(
      buildHaikhalLegacyUser() as any
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
