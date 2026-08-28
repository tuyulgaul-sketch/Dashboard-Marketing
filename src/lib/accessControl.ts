import type { AuthProfile } from "@/contexts/AuthContext";

export type AppFeature =
  | "DASHBOARD"
  | "ACTIVITY"
  | "MEETING_ROOM"
  | "TARGET_RKAP"
  | "BOOKING_PIPELINE"
  | "PRODUCTION"
  | "DOCUMENT_ADMIN"
  | "DOCUMENT_MARCOMM"
  | "TANDA_TERIMA"
  | "SYSTEM_ADMIN";

const normalize = (value?: string | null) =>
  (value || "").trim().toLowerCase();

export const isSystemAdminProfile = (
  profile?: AuthProfile | null
) => {
  if (!profile) return false;

  const role = normalize(profile.role_level);
  const unit = normalize(profile.unit);

  return (
    (role.includes("system") &&
      role.includes("admin")) ||
    unit === "administrasi sistem"
  );
};

export const isMarketingSupportProfile = (
  profile?: AuthProfile | null
) =>
  normalize(profile?.unit) ===
  "marketing support";

export const isMarketingSupportRootProfile = (
  profile?: AuthProfile | null
) =>
  Boolean(
    profile &&
      isMarketingSupportProfile(profile) &&
      !normalize(profile.department)
  );

export const isDigitalAffinityProfile = (
  profile?: AuthProfile | null
) =>
  Boolean(
    profile &&
      isMarketingSupportProfile(profile) &&
      normalize(profile.department) ===
        "digital & affinity"
  );

export const isMarketingAdministrationProfile = (
  profile?: AuthProfile | null
) =>
  Boolean(
    profile &&
      isMarketingSupportProfile(profile) &&
      normalize(profile.department) ===
        "marketing administration"
  );

export const isMarketingCommunicationProfile = (
  profile?: AuthProfile | null
) =>
  Boolean(
    profile &&
      isMarketingSupportProfile(profile) &&
      normalize(profile.department) ===
        "marketing communication"
  );

export const isBusinessMarketingProfile = (
  profile?: AuthProfile | null
) =>
  Boolean(
    profile &&
      !isSystemAdminProfile(profile) &&
      !isMarketingSupportProfile(profile)
  );

export const hasLegacyBusinessIdentity = (
  profile?: AuthProfile | null
) =>
  Boolean(
    profile?.legacy_user_id &&
      profile.legacy_user_id.trim()
  );

export const canAccessFeature = (
  profile: AuthProfile | null | undefined,
  feature: AppFeature
): boolean => {
  if (!profile || !profile.active) {
    return false;
  }

  if (
    feature === "ACTIVITY" ||
    feature === "MEETING_ROOM"
  ) {
    return !isSystemAdminProfile(profile);
  }

  if (feature === "SYSTEM_ADMIN") {
    return isSystemAdminProfile(profile);
  }

  if (feature === "DASHBOARD") {
    return !isSystemAdminProfile(profile);
  }

  // Modules below are still backed by the legacy UAT/localStorage
  // business store. A stable legacy_user_id is mandatory so the logged-in
  // Supabase identity cannot accidentally fall back to another user.
  if (!hasLegacyBusinessIdentity(profile)) {
    return false;
  }

  const business =
    isBusinessMarketingProfile(profile);

  const supportRoot =
    isMarketingSupportRootProfile(profile);

  const marketingAdmin =
    isMarketingAdministrationProfile(profile);

  const marketingComm =
    isMarketingCommunicationProfile(profile);

  switch (feature) {
    case "TARGET_RKAP":
      return business || supportRoot;

    case "BOOKING_PIPELINE":
      return (
        business ||
        supportRoot ||
        marketingAdmin
      );

    case "PRODUCTION":
      return (
        business ||
        supportRoot ||
        marketingAdmin
      );

    case "DOCUMENT_ADMIN":
      return (
        business ||
        supportRoot ||
        marketingAdmin
      );

    case "DOCUMENT_MARCOMM":
      return (
        business ||
        supportRoot ||
        marketingComm
      );

    case "TANDA_TERIMA":
      return (
        business ||
        supportRoot ||
        marketingAdmin
      );

    default:
      return false;
  }
};

export const getDocumentFeatureFromSearch = (
  search: string
): AppFeature => {
  const params = new URLSearchParams(search);
  const area = normalize(params.get("area"));

  if (
    area === "marketing-tools" ||
    area === "marcomm-requests"
  ) {
    return "DOCUMENT_MARCOMM";
  }

  return "DOCUMENT_ADMIN";
};
