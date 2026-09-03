import { supabase } from "@/lib/supabase";

export type AppSyncChannel =
  | "DIRECTORY"
  | "MEETING_ROOM"
  | "ACTIVITY_DETAIL";

export type AppSyncRevision = {
  channel: AppSyncChannel;
  revision: number;
  updated_at: string;
};

export function subscribeAppSyncRevision(
  channel: AppSyncChannel,
  onChange: (
    revision: AppSyncRevision
  ) => void
) {
  const realtime =
    supabase
      .channel(
        `app-sync-${channel}-${crypto.randomUUID()}`
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "app_sync_revisions",
          filter: `channel=eq.${channel}`,
        },
        payload => {
          const row =
            payload.new as
              Partial<AppSyncRevision>;

          if (
            row.channel !== channel
          ) {
            return;
          }

          onChange({
            channel,
            revision:
              Number(
                row.revision || 0
              ),
            updated_at:
              String(
                row.updated_at ||
                new Date().toISOString()
              ),
          });
        }
      )
      .subscribe();

  return () => {
    void supabase
      .removeChannel(
        realtime
      );
  };
}
