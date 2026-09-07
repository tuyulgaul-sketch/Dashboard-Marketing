// Compatibility facade: preserve all current admin operations unchanged.
export * from "./adminServiceCore";
export {
  startAdminImpersonation,
  type AdminImpersonationResult,
} from "./adminImpersonationService";
