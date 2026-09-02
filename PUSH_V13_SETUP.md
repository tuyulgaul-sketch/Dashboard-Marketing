# Push Notification V13 — Setup

Bundle ini menambahkan Web Push Notification untuk seluruh event yang sudah menghasilkan Bell notification.

Coverage:
- Modern `public.notifications` (Activity, validation, comment/@mention/reply, dll.)
- Legacy Bell notification di `central_business_entities` dengan `storage_key = pertalife_notifications`
  (Tanda Terima, Dokumen Administrasi, Marcomm, Marketing Tools, dan service flow yang masih memakai store.addNotification)

## Setelah file di-copy ke repo

1. Build frontend:
   pnpm install --no-frozen-lockfile
   git restore pnpm-lock.yaml
   pnpm build

2. Apply migration:
   supabase/migrations/20260902_push_notifications_v13.sql

3. Generate VAPID key pair:
   npx --yes web-push generate-vapid-keys --json

4. Generate dispatch key:
   openssl rand -hex 32

5. Set Edge Function secrets (replace placeholders):
   npx supabase secrets set \
     VAPID_PUBLIC_KEY="<PUBLIC_KEY>" \
     VAPID_PRIVATE_KEY="<PRIVATE_KEY>" \
     PUSH_DISPATCH_KEY="<DISPATCH_KEY>" \
     VAPID_SUBJECT="mailto:dashboard-marketing@pertalife.com" \
     --project-ref "<PROJECT_REF>"

6. Deploy Edge Function:
   npx supabase functions deploy push-dispatch \
     --no-verify-jwt \
     --project-ref "<PROJECT_REF>"

7. Configure DB dispatcher:
   update public.push_dispatch_config_v13
   set
     vapid_public_key = '<PUBLIC_KEY>',
     dispatch_url = 'https://<PROJECT_REF>.supabase.co/functions/v1/push-dispatch',
     dispatch_key = '<DISPATCH_KEY>',
     updated_at = now()
   where singleton = true;

8. Verify:
   select singleton, vapid_public_key is not null as has_public_key,
          dispatch_url, dispatch_key is not null as has_dispatch_key
   from public.push_dispatch_config_v13;

   select status, count(*)
   from public.push_outbox_v13
   group by status
   order by status;

9. On phone/PWA:
   - login
   - open Bell
   - tap "Aktifkan" on Notifikasi HP
   - allow notifications
   - trigger an event from another user
   - notification should show on lock screen/notification center
   - tap notification to deep-link into the relevant module

Notes:
- Sound/vibration follow OS notification settings, silent mode, Focus/DND, and browser/PWA policy.
- iPhone Web Push is intended for the Home Screen-installed web app.
- The private VAPID key and dispatch key must NEVER be committed to GitHub.
