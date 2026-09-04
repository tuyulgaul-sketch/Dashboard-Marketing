# Live Edge Functions Snapshot — 4 Sep 2026

Production Supabase project reference: `olyfnaviewzsbocflrzi` (`pertalife-marketing-dashboard`).

This folder exists because not every live Edge Function had been committed to the production `main` branch at the handover cut-off. It is a handover/runtime snapshot, not a reason to keep production code outside version control.

| Function | Live Version | Verify JWT | Handover Status |
|---|---:|---|---|
| `admin-user-control` | 15 | true | Production-critical; source snapshot included here |
| `notification-email-dispatcher` | 14 | false | Production-critical for governed notification email; source snapshot included here |
| `graph-oauth-start` | 4 | true | Required for Microsoft Graph delegated mailbox connection; source snapshot included here |
| `graph-oauth-callback` | 4 | false | OAuth callback; source snapshot included here |
| `push-dispatch` | 1 | false | Production-critical for web push; canonical source already exists under `supabase/functions/push-dispatch/index.ts` |
| `admin-impersonate` | 1 | true | Backend exists, but frontend Login As feature was not merged to production at cut-off; treat as experimental/pending |

## Required server secrets / configuration

Do **not** hard-code or commit secret values. Recreate them in the official secret manager/environment:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MS_GRAPH_TENANT_ID`
- `MS_GRAPH_CLIENT_ID`
- `MS_GRAPH_CLIENT_SECRET`
- `MS_GRAPH_SENDER`
- `MS_GRAPH_TOKEN_ENCRYPTION_KEY`
- `MS_GRAPH_ACCESS_TOKEN` (temporary fallback only; avoid for official steady-state)
- `NOTIFICATION_WEBHOOK_SECRET`
- `PUSH_DISPATCH_KEY`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`

## Security note

Functions with `verify_jwt=false` must perform their own explicit authentication/secret validation in the function body. Preserve this behavior or replace it with an equivalent corporate gateway policy. Never expose the service-role key to the browser.
