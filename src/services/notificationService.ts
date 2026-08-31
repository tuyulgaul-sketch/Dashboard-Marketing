import { supabase } from "@/lib/supabase";

export type AppNotification = {
  id: string;
  notification_type: string;
  module: string;
  title: string;
  message: string;
  related_record_id: string | null;
  link_path: string | null;
  read_at: string | null;
  created_at: string;
};

export async function getMyNotifications(limit = 30) {
  const { data, error } = await supabase.rpc(
    "get_my_notifications",
    { p_limit: limit }
  );
  if (error) throw error;
  return (data || []) as AppNotification[];
}

export async function getMyUnreadNotificationCount() {
  const { data, error } = await supabase.rpc(
    "get_my_unread_notification_count"
  );
  if (error) throw error;
  return Number(data || 0);
}

export async function markNotificationRead(notificationId: string) {
  const { data, error } = await supabase.rpc(
    "mark_notification_read",
    { p_notification_id: notificationId }
  );
  if (error) throw error;
  return Boolean(data);
}

export async function markAllNotificationsRead() {
  const { data, error } = await supabase.rpc(
    "mark_all_notifications_read"
  );
  if (error) throw error;
  return Number(data || 0);
}

export function resolveNotificationTarget(item: AppNotification) {
  const moduleKey = (item.module || "").trim().toUpperCase();
  const currentPath = item.link_path || "";

  const isActivityNotification =
    moduleKey.includes("ACTIV") ||
    currentPath.startsWith("/aktivitas");

  if (isActivityNotification && item.related_record_id) {
    const [, rawQuery = ""] =
      currentPath.split("?");

    const params =
      new URLSearchParams(rawQuery);

    params.set(
      "task",
      item.related_record_id
    );

    return `/aktivitas?${params.toString()}`;
  }

  return currentPath || "/aktivitas";
}
