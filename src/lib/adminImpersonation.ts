export type AdminImpersonationMarker = {
  admin_email: string;
  admin_name: string;
  target_profile_id: string;
  target_name: string;
  started_at: string;
};

const STORAGE_KEY =
  "pertalife_admin_login_as_v1";

export const setAdminImpersonationMarker = (
  marker: AdminImpersonationMarker
) => {
  sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(marker)
  );
};

export const getAdminImpersonationMarker =
  (): AdminImpersonationMarker | null => {
    try {
      const raw =
        sessionStorage.getItem(
          STORAGE_KEY
        );

      if (!raw) {
        return null;
      }

      const parsed =
        JSON.parse(raw) as
          Partial<AdminImpersonationMarker>;

      if (
        !parsed.admin_email ||
        !parsed.target_profile_id ||
        !parsed.target_name
      ) {
        return null;
      }

      return {
        admin_email:
          parsed.admin_email,
        admin_name:
          parsed.admin_name ||
          "SYSTEM_ADMIN",
        target_profile_id:
          parsed.target_profile_id,
        target_name:
          parsed.target_name,
        started_at:
          parsed.started_at ||
          new Date().toISOString(),
      };
    } catch {
      return null;
    }
  };

export const clearAdminImpersonationMarker =
  () => {
    sessionStorage.removeItem(
      STORAGE_KEY
    );
  };
