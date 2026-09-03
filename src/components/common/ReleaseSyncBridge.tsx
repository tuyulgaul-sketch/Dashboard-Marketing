import React, {
  useEffect,
} from "react";

import {
  useAuth,
} from "@/contexts/AuthContext";

import {
  subscribeAppSyncRevision,
} from "@/services/appSyncRevisionService";

export const ACTIVITY_DETAIL_SYNC_EVENT =
  "pertalife-activity-detail-sync";

const ReleaseSyncBridge:
  React.FC = () => {
    const { profile } =
      useAuth();

    useEffect(() => {
      if (!profile) {
        return;
      }

      let directoryReloadTimer:
        number | null =
        null;

      const unsubscribeDirectory =
        subscribeAppSyncRevision(
          "DIRECTORY",
          () => {
            // System Admin is the source of most directory changes and its
            // own admin page already reloads authoritative data after writes.
            // Business sessions must reload the authenticated profile plus
            // directory together so hierarchy/access never stays stale.
            if (
              profile.role_level
                .trim()
                .toUpperCase() ===
              "SYSTEM_ADMIN"
            ) {
              return;
            }

            if (
              directoryReloadTimer !==
              null
            ) {
              window.clearTimeout(
                directoryReloadTimer
              );
            }

            directoryReloadTimer =
              window.setTimeout(
                () => {
                  window.location.reload();
                },
                350
              );
          }
        );

      const unsubscribeMeetingRoom =
        subscribeAppSyncRevision(
          "MEETING_ROOM",
          () => {
            if (
              window.location.pathname ===
              "/booking-ruang-meeting"
            ) {
              // MarketingMeetingRoomPage already treats window focus as an
              // authoritative refresh request. Reuse that safe path instead
              // of exposing the room table directly to browser Realtime.
              window.dispatchEvent(
                new Event("focus")
              );
            }
          }
        );

      const unsubscribeActivityDetail =
        subscribeAppSyncRevision(
          "ACTIVITY_DETAIL",
          () => {
            if (
              window.location.pathname !==
              "/aktivitas"
            ) {
              return;
            }

            // Refresh list/action-role/attention state through the page's
            // existing focus handler, and separately signal an open detail
            // surface so it can refresh its authorized RPC snapshot.
            window.dispatchEvent(
              new Event("focus")
            );

            window.dispatchEvent(
              new CustomEvent(
                ACTIVITY_DETAIL_SYNC_EVENT
              )
            );
          }
        );

      return () => {
        if (
          directoryReloadTimer !==
          null
        ) {
          window.clearTimeout(
            directoryReloadTimer
          );
        }

        unsubscribeDirectory();
        unsubscribeMeetingRoom();
        unsubscribeActivityDetail();
      };
    }, [
      profile?.id,
      profile?.role_level,
    ]);

    return null;
  };

export default ReleaseSyncBridge;
