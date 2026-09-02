import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Bell,
  BellOff,
  BellRing,
  CheckCheck,
  Loader2,
  Smartphone,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import {
  AppNotification as ModernNotification,
  getMyNotifications,
  getMyUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  resolveNotificationTarget,
} from "@/services/notificationService";
import {
  disablePushNotifications,
  enablePushNotifications,
  getPushNotificationState,
  PushNotificationState,
  syncExistingPushSubscription,
} from "@/services/pushNotificationService";
import { store } from "@/services/store";
import type { AppNotification as LegacyNotification } from "@/types";

type BellItem = {
  source: "MODERN" | "LEGACY";
  id: string;
  title: string;
  message: string;
  target: string;
  read: boolean;
  createdAt: string;
};

const relativeTime = (value: string) => {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (mins < 1) return "Baru saja";
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.floor(hours / 24)} hari lalu`;
};

const pushStateLabel = (
  state: PushNotificationState | null
) => {
  if (!state) return "Memeriksa perangkat...";
  if (state === "ENABLED") {
    return "Push HP aktif";
  }
  if (state === "DENIED") {
    return "Izin diblokir browser/HP";
  }
  if (state === "UNSUPPORTED") {
    return "Perangkat/browser belum mendukung";
  }
  return "Belum aktif di perangkat ini";
};

export const NotificationBell: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [modernItems, setModernItems] = useState<ModernNotification[]>([]);
  const [modernUnread, setModernUnread] = useState(0);
  const [legacyItems, setLegacyItems] = useState<LegacyNotification[]>([]);
  const [pushState, setPushState] =
    useState<PushNotificationState | null>(null);
  const [pushBusy, setPushBusy] =
    useState(false);

  const legacyUserId = (profile?.legacy_user_id || "").trim();

  const refresh = useCallback(async () => {
    if (!profile) return;
    try {
      const [rows, count] = await Promise.all([
        getMyNotifications(30),
        getMyUnreadNotificationCount(),
      ]);
      setModernItems(rows);
      setModernUnread(count);
    } catch (error) {
      console.error("Notification refresh gagal:", error);
    }
  }, [profile?.id]);

  const refreshLegacy = useCallback(() => {
    if (!legacyUserId) {
      setLegacyItems([]);
      return;
    }

    try {
      setLegacyItems(store.getNotifications(legacyUserId));
    } catch (error) {
      console.error("Notification legacy refresh gagal:", error);
    }
  }, [legacyUserId]);

  const refreshPushState =
    useCallback(async () => {
      try {
        const state =
          await getPushNotificationState();
        setPushState(state);
      } catch (error) {
        console.error(
          "Push notification state gagal dibaca:",
          error
        );
        setPushState("AVAILABLE");
      }
    }, []);

  useEffect(() => {
    if (!profile) return;

    refresh();

    const channel = supabase
      .channel(`notifications:${profile.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `recipient_profile_id=eq.${profile.id}`,
        },
        refresh
      )
      .subscribe();

    // Realtime is primary; polling is only a resilience fallback.
    const timer = window.setInterval(refresh, 120000);

    return () => {
      window.clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [profile?.id, refresh]);

  useEffect(() => {
    if (!profile) return;

    refreshLegacy();

    const unsubscribe = store.subscribe(refreshLegacy);

    return () => {
      unsubscribe();
    };
  }, [profile?.id, refreshLegacy]);

  useEffect(() => {
    if (!profile) {
      setPushState(null);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        await syncExistingPushSubscription();
      } catch (error) {
        console.error(
          "Sinkronisasi push subscription gagal:",
          error
        );
      }

      if (!cancelled) {
        await refreshPushState();
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [profile?.id, refreshPushState]);

  const legacyUnread = legacyItems.filter((item) => !item.isRead).length;
  const unread = modernUnread + legacyUnread;

  const items: BellItem[] = [
    ...modernItems.map((item) => ({
      source: "MODERN" as const,
      id: item.id,
      title: item.title,
      message: item.message,
      target: resolveNotificationTarget(item),
      read: Boolean(item.read_at),
      createdAt: item.created_at,
    })),
    ...legacyItems.map((item) => ({
      source: "LEGACY" as const,
      id: item.id,
      title: item.title,
      message: item.message,
      target: item.linkPath || "/aktivitas",
      read: Boolean(item.isRead),
      createdAt: item.createdAt,
    })),
  ]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime()
    )
    .slice(0, 50);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const openItem = async (item: BellItem) => {
    if (!item.read) {
      try {
        if (item.source === "MODERN") {
          await markNotificationRead(item.id);
        } else {
          store.markNotificationAsRead(item.id);
        }
      } catch (error) {
        console.error(error);
      }
    }

    setOpen(false);

    if (item.source === "MODERN") {
      await refresh();
    } else {
      refreshLegacy();
    }

    navigate(item.target || "/aktivitas");
  };

  const markAll = async () => {
    try {
      if (modernUnread > 0) {
        await markAllNotificationsRead();
      }

      legacyItems
        .filter((item) => !item.isRead)
        .forEach((item) => {
          store.markNotificationAsRead(item.id);
        });

      await refresh();
      refreshLegacy();
    } catch (error) {
      console.error("Gagal menandai semua notifikasi:", error);
    }
  };

  const togglePush = async () => {
    if (
      pushBusy ||
      pushState === "UNSUPPORTED" ||
      pushState === "DENIED"
    ) {
      return;
    }

    try {
      setPushBusy(true);

      if (pushState === "ENABLED") {
        await disablePushNotifications();
      } else {
        await enablePushNotifications();
      }

      await refreshPushState();
    } catch (error) {
      console.error(
        "Gagal mengubah push notification:",
        error
      );

      window.alert(
        error instanceof Error
          ? error.message
          : "Gagal mengubah pengaturan push notification."
      );

      await refreshPushState();
    } finally {
      setPushBusy(false);
    }
  };

  if (!profile) return null;

  return (
    <div ref={ref} className="relative">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="relative h-9 w-9"
        onClick={() => {
          setOpen((value) => !value);
          refresh();
          refreshLegacy();
          void refreshPushState();
        }}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </Button>

      {open && (
        <div className="fixed left-3 right-3 top-[68px] z-[300] w-auto max-w-none overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl sm:absolute sm:left-auto sm:right-0 sm:top-11 sm:w-[380px] sm:max-w-[calc(100vw-24px)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <div className="text-sm font-bold text-slate-900">Notifikasi</div>
              <div className="text-[11px] text-slate-500">{unread} belum dibaca</div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={unread === 0}
              onClick={markAll}
            >
              <CheckCheck className="mr-1.5 h-4 w-4" />
              Tandai semua
            </Button>
          </div>

          <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                  <Smartphone className="h-4 w-4 text-blue-600" />
                  Notifikasi HP
                </div>
                <div className="mt-1 text-[10px] leading-4 text-slate-500">
                  {pushStateLabel(pushState)}
                </div>
              </div>

              <Button
                type="button"
                size="sm"
                variant={
                  pushState === "ENABLED"
                    ? "outline"
                    : "default"
                }
                disabled={
                  pushBusy ||
                  !pushState ||
                  pushState === "UNSUPPORTED" ||
                  pushState === "DENIED"
                }
                onClick={togglePush}
                className="shrink-0"
              >
                {pushBusy ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : pushState === "ENABLED" ? (
                  <BellOff className="mr-1.5 h-4 w-4" />
                ) : (
                  <BellRing className="mr-1.5 h-4 w-4" />
                )}

                {pushState === "ENABLED"
                  ? "Nonaktifkan"
                  : "Aktifkan"}
              </Button>
            </div>

            {pushState === "DENIED" && (
              <div className="mt-2 text-[10px] leading-4 text-amber-700">
                Izin notifikasi sudah diblokir. Aktifkan kembali dari pengaturan browser/HP, lalu buka ulang Dashboard Marketing.
              </div>
            )}
          </div>

          <div className="max-h-[calc(100dvh-210px)] overflow-y-auto overscroll-contain sm:max-h-[430px]">
            {items.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Belum ada notifikasi.
              </div>
            ) : (
              items.map((item) => (
                <button
                  type="button"
                  key={`${item.source}:${item.id}`}
                  onClick={() => openItem(item)}
                  className={`block w-full border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50 ${
                    !item.read ? "bg-blue-50/60" : "bg-white"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                        !item.read ? "bg-blue-600" : "bg-slate-300"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="break-words text-xs font-bold text-slate-900">{item.title}</div>
                      <div className="mt-1 break-words text-[11px] leading-5 text-slate-600">{item.message}</div>
                      <div className="mt-1.5 text-[10px] text-slate-400">{relativeTime(item.createdAt)}</div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
