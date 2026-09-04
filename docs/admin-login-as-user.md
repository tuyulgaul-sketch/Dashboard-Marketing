# Admin Login As User

This feature lets SYSTEM_ADMIN open a real Supabase Auth session for an active non-admin user without knowing or resetting that user's password.

Flow:
1. SYSTEM_ADMIN chooses `Login As` from Administrasi > Account & Password.
2. The frontend calls the JWT-protected `admin-impersonate` Edge Function.
3. The Edge Function re-validates the caller as SYSTEM_ADMIN, validates the target, and creates a one-time Supabase magic-link session server-side.
4. The browser follows that link and becomes the target user's real Supabase session, so existing `auth.uid()`, RLS, profile, hierarchy, notifications, Activity, Tanda Terima, and Meeting Room behavior all resolve as the target user.
5. While impersonating, the header shows `Login As: <name>` and hides the password-change control.
6. `Kembali Admin` signs out the target session and returns to the login page with the admin email prefilled. The admin password must be entered again; admin credentials/tokens are never stored for restoration.

Security:
- Target SYSTEM_ADMIN accounts are excluded.
- Inactive/unactivated target accounts are rejected.
- Service-role credentials never reach the browser.
- Target passwords are never read or changed.
- Generated one-time links/tokens are never logged.
- Edge Function logs include admin/target identity and issuance time for server-side audit.

Deployment gate:
- Deploy `supabase/functions/admin-impersonate` to production with JWT verification enabled before merging the frontend feature.
