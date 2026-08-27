import React, { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import {
  AppNotification,
  getMyNotifications,
  getMyUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/services/notificationService";

const relativeTime = (value: string) => {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (mins < 1) return "Baru saja";
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.floor(hours / 24)} hari lalu`;
};

export const NotificationBell: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    if (!profile) return;
    try {
      const [rows, count] = await Promise.all([
        getMyNotifications(30),
        getMyUnreadNotificationCount(),
      ]);
      setItems(rows);
      setUnread(count);
    } catch (error) {
      console.error("Notification refresh gagal:", error);
    }
  }, [profile?.id]);

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

    const timer = window.setInterval(refresh, 30000);

    return () => {
      window.clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [profile?.id, refresh]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const openItem = async (item: AppNotification) => {
    if (!item.read_at) {
      try {
        await markNotificationRead(item.id);
      } catch (error) {
        console.error(error);
      }
    }
    setOpen(false);
    await refresh();
    navigate(item.link_path || "/aktivitas");
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
        <div className="absolute right-0 top-11 z-[300] w-[380px] max-w-[calc(100vw-24px)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
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
              onClick={async () => {
                await markAllNotificationsRead();
                await refresh();
              }}
            >
              <CheckCheck className="mr-1.5 h-4 w-4" />
              Tandai semua
            </Button>
          </div>

          <div className="max-h-[480px] overflow-y-auto">
            {items.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Belum ada notifikasi.
              </div>
            ) : (
              items.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => openItem(item)}
                  className={`block w-full border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50 ${
                    !item.read_at ? "bg-blue-50/60" : "bg-white"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                        !item.read_at ? "bg-blue-600" : "bg-slate-300"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-900">{item.title}</div>
                      <div className="mt-1 text-[11px] leading-5 text-slate-600">{item.message}</div>
                      <div className="mt-1.5 text-[10px] text-slate-400">{relativeTime(item.created_at)}</div>
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
