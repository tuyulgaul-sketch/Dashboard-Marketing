# Admin Login As — live integration

The current implementation is based on main at 8efc817ba8f9a012f28f0d9ac558d6f872b7ddcf. PR #18 is an older draft; do not merge it without reconciling later password and activity changes.

Only a current active SYSTEM_ADMIN / Administrasi Sistem account can request a target session. The server validates the caller and target. Never use a browser-only identity switch, read/reset the target password, or expose service credentials.

The production `admin-impersonate` function was manually deployed by the project owner. It must keep verify_jwt enabled and validate the supplied user JWT using auth.getUser(). The function rejects inactive, unlinked, self and SYSTEM_ADMIN targets, then generates a one-time magic link. The admin/target/time are audited without logging tokens. The frontend must validate the returned Supabase origin before navigating and must not restore an admin token from browser storage.

Returning to admin signs out the target and requires the administrator to authenticate again. A session marker is presentation state, not a trusted authorization claim. Password controls are unavailable during impersonation. Existing server-side RLS and business permission checks remain authoritative.

Before production release: verify the current function version and redirect configuration, test missing/invalid JWT and non-admin/target-admin denial, test a real admin-to-target login, verify auth.uid/RLS, test return to admin, then check the exact production Vercel commit. Do not log or paste action links, JWTs or credentials into GitHub, chat or test evidence. A successful source build is not an end-to-end authentication test.
