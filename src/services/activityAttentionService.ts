import { supabase } from "@/lib/supabase";
import {
  AppNotification,
  getMyNotifications,
} from "@/services/notificationService";

export type ActivityAttentionRow = {
  activity_id: string;
  unseen_count: number;
  latest_notification_at: string | null;
  last_seen_at: string | null;
};

type ActivityViewStateRow = {
  activity_id: string;
  last_seen_at: string;
};

const LOCAL_SEEN_PREFIX = "pertalife_activity_seen_";
const LOCAL_STARTED_PREFIX = "pertalife_activity_attention_started_";
let serverViewStateAvailable: boolean | null = null;
let warnedMissingRpc = false;

const isActivityNotification = (item: AppNotification) => {
  const moduleKey = (item.module || "").trim().toUpperCase();
  const path = item.link_path || "";

  return Boolean(
    item.related_record_id &&
      (moduleKey.includes("ACTIV") || path.startsWith("/aktivitas"))
  );
};

const seenStorageKey = (profileId: string) =>
  `${LOCAL_SEEN_PREFIX}${profileId}`;

const startedStorageKey = (profileId: string) =>
  `${LOCAL_STARTED_PREFIX}${profileId}`;

const readLocalSeenMap = (
  profileId: string
): Record<string, string> => {
  try {
    const raw = window.localStorage.getItem(
      seenStorageKey(profileId)
    );
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const writeLocalSeenMap = (
  profileId: string,
  value: Record<string, string>
) => {
  try {
    window.localStorage.setItem(
      seenStorageKey(profileId),
      JSON.stringify(value)
    );
  } catch {
    // localStorage is only a resilience fallback.
  }
};

const getAttentionStartedAt = (profileId: string) => {
  const key = startedStorageKey(profileId);

  try {
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;

    // Avoid turning very old historical notifications into "new" cards
    // when this feature is deployed for the first time.
    const baseline = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000
    ).toISOString();

    window.localStorage.setItem(key, baseline);
    return baseline;
  } catch {
    return new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000
    ).toISOString();
  }
};

const latestIso = (
  a?: string | null,
  b?: string | null
): string | null => {
  if (!a) return b || null;
  if (!b) return a;
  return new Date(a).getTime() >= new Date(b).getTime()
    ? a
    : b;
};

async function getServerViewStates() {
  if (serverViewStateAvailable === false) {
    return [] as ActivityViewStateRow[];
  }

  try {
    const { data, error } = await supabase.rpc(
      "get_my_activity_view_states"
    );

    if (error) {
      serverViewStateAvailable = false;

      if (!warnedMissingRpc) {
        warnedMissingRpc = true;
        console.warn(
          "Activity view-state RPC belum tersedia; menggunakan localStorage fallback.",
          error
        );
      }

      return [] as ActivityViewStateRow[];
    }

    serverViewStateAvailable = true;
    return (data || []) as ActivityViewStateRow[];
  } catch (error) {
    serverViewStateAvailable = false;

    if (!warnedMissingRpc) {
      warnedMissingRpc = true;
      console.warn(
        "Activity view-state RPC tidak tersedia; menggunakan localStorage fallback.",
        error
      );
    }

    return [] as ActivityViewStateRow[];
  }
}

export async function getMyActivityAttention(
  profileId: string
): Promise<ActivityAttentionRow[]> {
  if (!profileId) return [];

  const [notifications, serverStates] = await Promise.all([
    getMyNotifications(500).catch((error) => {
      console.warn(
        "Tidak dapat membaca notifikasi untuk attention state:",
        error
      );
      return [] as AppNotification[];
    }),
    getServerViewStates(),
  ]);

  const localSeen = readLocalSeenMap(profileId);
  const startedAt = getAttentionStartedAt(profileId);

  const serverSeen = new Map(
    serverStates.map((row) => [
      row.activity_id,
      row.last_seen_at,
    ])
  );

  const attention = new Map<string, ActivityAttentionRow>();

  notifications
    .filter(isActivityNotification)
    .forEach((notification) => {
      const activityId = notification.related_record_id!;
      const lastSeen = latestIso(
        localSeen[activityId],
        serverSeen.get(activityId)
      );
      const effectiveSeenAt = lastSeen || startedAt;

      if (
        new Date(notification.created_at).getTime() <=
        new Date(effectiveSeenAt).getTime()
      ) {
        return;
      }

      const existing = attention.get(activityId);

      attention.set(activityId, {
        activity_id: activityId,
        unseen_count: (existing?.unseen_count || 0) + 1,
        latest_notification_at: latestIso(
          existing?.latest_notification_at,
          notification.created_at
        ),
        last_seen_at: lastSeen,
      });
    });

  return Array.from(attention.values());
}

export async function markActivitySeen(
  activityId: string,
  profileId: string
) {
  if (!activityId || !profileId) return;

  const seenAt = new Date().toISOString();
  const localSeen = readLocalSeenMap(profileId);

  localSeen[activityId] = seenAt;
  writeLocalSeenMap(profileId, localSeen);

  if (serverViewStateAvailable === false) {
    return;
  }

  try {
    const { error } = await supabase.rpc(
      "mark_activity_seen",
      {
        p_activity_id: activityId,
      }
    );

    if (error) {
      serverViewStateAvailable = false;

      if (!warnedMissingRpc) {
        warnedMissingRpc = true;
        console.warn(
          "mark_activity_seen belum tersedia; localStorage tetap aktif.",
          error
        );
      }
      return;
    }

    serverViewStateAvailable = true;
  } catch (error) {
    serverViewStateAvailable = false;

    if (!warnedMissingRpc) {
      warnedMissingRpc = true;
      console.warn(
        "mark_activity_seen gagal; localStorage tetap aktif.",
        error
      );
    }
  }
}
