import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { subscribeAppSyncRevision } from '@/services/appSyncRevisionService';

export const ACTIVITY_DETAIL_SYNC_EVENT = 'pertalife-activity-detail-sync';

const ReleaseSyncBridge: React.FC = () => {
  const { profile, refreshAuthenticatedProfile } = useAuth();
  useEffect(() => {
    if (!profile) return;
    let directoryReloadTimer: number | null = null;
    const unsubscribeDirectory = subscribeAppSyncRevision('DIRECTORY', () => {
      if (profile.role_level.trim().toUpperCase() === 'SYSTEM_ADMIN') return;
      if (directoryReloadTimer !== null) window.clearTimeout(directoryReloadTimer);
      directoryReloadTimer = window.setTimeout(() => {
        directoryReloadTimer = null;
        // Refresh the authoritative profile/directory without destroying the
        // current route, open dialog or unsaved form. AuthContext still revokes
        // access if the server reports that the account is inactive or changed.
        void refreshAuthenticatedProfile().catch(error => {
          console.error('Directory refresh failed:', error);
        });
      }, 350);
    });
    const unsubscribeMeetingRoom = subscribeAppSyncRevision('MEETING_ROOM', () => {
      if (window.location.pathname === '/booking-ruang-meeting') window.dispatchEvent(new Event('focus'));
    });
    const unsubscribeActivityDetail = subscribeAppSyncRevision('ACTIVITY_DETAIL', () => {
      if (window.location.pathname !== '/aktivitas') return;
      window.dispatchEvent(new Event('focus'));
      window.dispatchEvent(new CustomEvent(ACTIVITY_DETAIL_SYNC_EVENT));
    });
    return () => {
      if (directoryReloadTimer !== null) window.clearTimeout(directoryReloadTimer);
      unsubscribeDirectory();
      unsubscribeMeetingRoom();
      unsubscribeActivityDetail();
    };
  }, [profile?.id, profile?.role_level, refreshAuthenticatedProfile]);
  return null;
};

export default ReleaseSyncBridge;
