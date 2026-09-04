# admin-impersonate

Server-side SYSTEM_ADMIN impersonation endpoint for Dashboard Marketing.

## Security properties

- Must be deployed with JWT verification enabled.
- Validates the caller's Supabase access token server-side.
- Requires an active `SYSTEM_ADMIN` / `Administrasi Sistem` profile.
- Rejects impersonation into another system-admin profile.
- Uses `SUPABASE_SERVICE_ROLE_KEY` only inside the Edge Function runtime.
- Generates a one-time magic-link session for the target account; it never resets or reads the target user's password.
- Never logs the generated action link or one-time token.

## Deployment

Deploy this function to the production Supabase project with JWT verification enabled before merging/enabling the frontend `Login As` control.
