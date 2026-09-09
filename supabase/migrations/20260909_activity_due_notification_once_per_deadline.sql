-- Production hotfix applied 2026-09-09. Keep the server routine under source control.
-- One due-soon notification and one overdue notification per recipient/task/deadline.
-- Existing notification history is retained and prevents a fresh reminder for
-- an overdue episode that was already notified by the previous daily-key routine.
CREATE OR REPLACE FUNCTION public.generate_activity_due_notifications()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  a public.activities%rowtype;
  v_manager uuid;
  v_today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  due_count integer := 0;
  overdue_count integer := 0;
BEGIN
  IF public.current_profile_id() IS NULL THEN
    RAISE EXCEPTION 'Profile aktif untuk user login tidak ditemukan.';
  END IF;

  FOR a IN
    SELECT * FROM public.activities
    WHERE status NOT IN ('DONE', 'CANCELLED')
      AND due_date = v_today + 1
  LOOP
    PERFORM public.create_system_notification_vnext(
      a.owner_profile_id, 'ACTIVITY_DUE_SOON',
      'Aktivitas jatuh tempo besok',
      coalesce(a.title, 'Aktivitas') || ' memiliki due date besok.',
      a.id, '/aktivitas', 'ACTIVITY',
      'due:' || a.id::text || ':' || a.due_date::text, true
    );
    due_count := due_count + 1;
  END LOOP;

  -- The previous routine used current_date in overdue keys, so it generated
  -- new notifications and email outbox rows every day until completion.
  FOR a IN
    SELECT * FROM public.activities
    WHERE status NOT IN ('DONE', 'CANCELLED')
      AND due_date < v_today
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.recipient_profile_id = a.owner_profile_id
        AND n.related_record_id = a.id
        AND n.notification_type = 'ACTIVITY_OVERDUE'
        AND (n.created_at AT TIME ZONE 'Asia/Jakarta')::date >= a.due_date
    ) THEN
      PERFORM public.create_system_notification_vnext(
        a.owner_profile_id, 'ACTIVITY_OVERDUE',
        'Aktivitas overdue',
        coalesce(a.title, 'Aktivitas') || ' telah melewati due date.',
        a.id, '/aktivitas', 'ACTIVITY',
        'overdue-owner:' || a.id::text || ':' || a.due_date::text, true
      );
    END IF;

    SELECT manager_id INTO v_manager
    FROM public.profiles
    WHERE id = a.owner_profile_id AND active = true;

    IF v_manager IS NOT NULL AND v_manager <> a.owner_profile_id
       AND NOT EXISTS (
         SELECT 1 FROM public.notifications n
         WHERE n.recipient_profile_id = v_manager
           AND n.related_record_id = a.id
           AND n.notification_type = 'ACTIVITY_OVERDUE_TEAM'
           AND (n.created_at AT TIME ZONE 'Asia/Jakarta')::date >= a.due_date
       ) THEN
      PERFORM public.create_system_notification_vnext(
        v_manager, 'ACTIVITY_OVERDUE_TEAM',
        'Aktivitas tim overdue',
        coalesce(a.title, 'Aktivitas') || ' telah melewati due date.',
        a.id, '/aktivitas', 'ACTIVITY',
        'overdue-manager:' || a.id::text || ':' || a.due_date::text, true
      );
    END IF;
    overdue_count := overdue_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'due_tomorrow_scanned', due_count,
    'overdue_scanned', overdue_count
  );
END;
$function$;
