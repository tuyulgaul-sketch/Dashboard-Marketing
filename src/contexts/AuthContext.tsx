import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { canAccessFeature } from '@/lib/accessControl';
import { syncCentralMasterRuntime, clearCentralMasterRuntime } from '@/services/centralMasterRuntime';
import { syncCentralTargetRuntime, clearCentralTargetRuntime } from '@/services/centralTargetRuntime';
import { supabase } from '@/lib/supabase';
import { syncLegacyIdentityFromSupabase } from '@/lib/legacyIdentityBridge';
import { syncGlobalResetState } from '@/lib/globalResetSync';
import { clearCentralUserRuntime, syncCentralUserRuntime } from '@/services/centralUserRuntime';
import { clearCentralBusinessRuntime, syncCentralBusinessRuntime } from '@/services/centralBusinessStorageRuntime';

export type AuthProfile = {
  id: string;
  auth_user_id: string | null;
  full_name: string;
  email: string;
  role_level: string;
  unit: string;
  department: string | null;
  manager_id: string | null;
  legacy_user_id: string | null;
  active: boolean;
};

type AuthContextValue = {
  session: Session | null;
  profile: AuthProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  restoredBusinessReady: boolean;
  restoredBusinessError: string | null;
  retryRestoredBusiness: () => Promise<void>;
  refreshAuthenticatedProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const authoritySignature = (profile: AuthProfile) => JSON.stringify([
  profile.id, profile.auth_user_id, profile.role_level, profile.unit,
  profile.department, profile.manager_id, profile.legacy_user_id, profile.active,
]);
const clearLiteRuntime = () => {
  clearCentralBusinessRuntime();
  clearCentralUserRuntime();
  clearCentralMasterRuntime();
  clearCentralTargetRuntime();
};

// A refreshed token is not a new login. Keep the existing React tree mounted.
// A real identity change, inactive profile or explicit global reset still revokes
// access and must never be treated as a harmless background refresh.
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [restoredBusinessReady, setRestoredBusinessReady] = useState(false);
  const [restoredBusinessError, setRestoredBusinessError] = useState<string | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const profileRef = useRef<AuthProfile | null>(null);
  const generation = useRef(0);
  const refreshing = useRef<Promise<void> | null>(null);

  const updateProfile = useCallback((next: AuthProfile | null) => {
    profileRef.current = next;
    setProfile(next);
  }, []);

  const revoke = useCallback(() => {
    generation.current += 1;
    sessionRef.current = null;
    profileRef.current = null;
    refreshing.current = null;
    setSession(null);
    setProfile(null);
    setRestoredBusinessReady(false);
    setRestoredBusinessError(null);
    clearLiteRuntime();
  }, []);

  const loadRestoredBusiness = useCallback(async (authProfile: AuthProfile, isCurrent: () => boolean) => {
    if (!isCurrent()) return;
    setRestoredBusinessReady(false);
    setRestoredBusinessError(null);
    try {
      await syncCentralMasterRuntime(authProfile);
      if (!isCurrent()) return;
      if (canAccessFeature(authProfile, 'DASHBOARD')) {
        await syncCentralTargetRuntime(authProfile.id);
      } else {
        clearCentralTargetRuntime();
      }
      if (isCurrent()) setRestoredBusinessReady(true);
    } catch (error) {
      if (!isCurrent()) return;
      clearCentralMasterRuntime();
      clearCentralTargetRuntime();
      const message = error instanceof Error ? error.message : 'Database pusat belum dapat dimuat.';
      console.error('[Restored Business] Sinkronisasi gagal', error);
      setRestoredBusinessError(message);
    }
  }, []);

  const loadProfile = useCallback(async (currentSession: Session, version: number, background = false, forceDirectory = false) => {
    const isCurrent = () => generation.current === version && sessionRef.current?.user.id === currentSession.user.id;
    const { data, error } = await Promise.resolve(supabase.from('profiles')
      .select('id, auth_user_id, full_name, email, role_level, unit, department, manager_id, legacy_user_id, active')
      .eq('auth_user_id', currentSession.user.id).eq('active', true).single()).catch(error => ({ data: null, error }));
    if (!isCurrent()) return;
    if (error || !data || data.auth_user_id !== currentSession.user.id || !data.active) {
      console.error('Profile tidak ditemukan:', error);
      // A temporary network error is not evidence that a valid account was revoked.
      // Preserve its UI but do not grant any new authority. Explicitly inactive or
      // missing profiles still revoke access.
      if (error && data === null && profileRef.current?.auth_user_id === currentSession.user.id && background && error.code !== 'PGRST116') {
        console.error('Pemeriksaan profile sementara gagal; sesi lama tidak diubah.');
        return;
      }
      revoke();
      setSession(currentSession);
      sessionRef.current = currentSession;
      setLoading(false);
      return;
    }
    const authProfile = data as AuthProfile;
    const previous = profileRef.current;
    const unchanged = Boolean(previous && JSON.stringify(previous) === JSON.stringify(authProfile));
    const sameAuthority = Boolean(previous && authoritySignature(previous) === authoritySignature(authProfile));
    if (background && sameAuthority) {
      // Display-only changes and directory revisions do not rebuild business
      // runtimes. Keep the active forms mounted and refresh only the directory.
      try {
        if (forceDirectory || !unchanged) await syncCentralUserRuntime(authProfile);
        if (isCurrent() && !unchanged) updateProfile(authProfile);
      } catch (refreshError) {
        console.error('Directory refresh failed:', refreshError);
      }
      return;
    }
    if (background && previous && !sameAuthority) {
      // A genuine role, hierarchy or account change must not retain the old
      // authorization while the new authoritative runtime is being loaded.
      updateProfile(null);
      setRestoredBusinessReady(false);
      clearLiteRuntime();
    }
    try {
      await syncGlobalResetState();
      if (!isCurrent()) return;
      syncLegacyIdentityFromSupabase(authProfile);
      await syncCentralUserRuntime(authProfile);
      if (!isCurrent()) return;
      await loadRestoredBusiness(authProfile, isCurrent);
      if (!isCurrent()) return;
      await syncCentralBusinessRuntime(authProfile);
    } catch (runtimeError) {
      if (!isCurrent()) return;
      console.error('Supabase Lite runtime gagal dimuat:', runtimeError);
      clearLiteRuntime();
      updateProfile(null);
      return;
    }
    if (isCurrent()) updateProfile(authProfile);
  }, [loadRestoredBusiness, revoke, updateProfile]);

  const refreshAuthenticatedProfile = useCallback(async () => {
    const current = sessionRef.current;
    if (!current) return;
    const version = generation.current;
    const previousTask = refreshing.current;
    if (previousTask) {
      // A directory revision must not be dropped just because a token check
      // is in flight. Wait, then perform the requested authoritative refresh.
      await previousTask.catch(error => { console.error('Profile refresh failed:', error); });
      if (generation.current !== version || sessionRef.current?.user.id !== current.user.id) return;
    }
    const task = loadProfile(sessionRef.current!, version, true, true);
    refreshing.current = task;
    try { await task; } finally { if (refreshing.current === task) refreshing.current = null; }
  }, [loadProfile]);

  useEffect(() => {
    let mounted = true;
    let eventSeen = false;
    const applySession = (next: Session | null, background: boolean) => {
      if (!mounted) return;
      const nextId = next?.user.id || null;
      const previousId = sessionRef.current?.user.id || null;
      if (!next || !nextId) {
        revoke();
        setLoading(false);
        return;
      }
      sessionRef.current = next;
      setSession(next);
      if (previousId === nextId && profileRef.current?.auth_user_id === nextId) {
        // Revalidate the profile without replacing the page or reloading data.
        if (!refreshing.current) {
          const task = loadProfile(next, generation.current, true);
          refreshing.current = task;
          void task.catch(error => { console.error('Profile refresh failed:', error); }).finally(() => { if (refreshing.current === task) refreshing.current = null; });
        }
        return;
      }
      const version = ++generation.current;
      refreshing.current = null;
      if (previousId !== nextId) {
        clearLiteRuntime();
        updateProfile(null);
        setRestoredBusinessReady(false);
        setRestoredBusinessError(null);
      }
      setLoading(true);
      void loadProfile(next, version, background && previousId === nextId).finally(() => {
        if (mounted && generation.current === version) setLoading(false);
      });
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, next) => {
      if (!mounted) return;
      eventSeen = true;
      applySession(next, event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION' || event === 'SIGNED_IN');
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (mounted && !eventSeen) applySession(data.session, false);
    }).catch(error => {
      console.error('Inisialisasi sesi gagal:', error);
      if (mounted && !eventSeen) setLoading(false);
    });
    return () => {
      mounted = false;
      generation.current += 1;
      subscription.unsubscribe();
      clearLiteRuntime();
    };
  }, [loadProfile, revoke, updateProfile]);

  useEffect(() => {
    if (!profile) return;
    const intervalId = window.setInterval(async () => {
      try {
        const changed = await syncGlobalResetState();
        if (changed) window.location.reload();
      } catch (error) { console.error('Periodic global reset sync gagal:', error); }
    }, 60_000);
    return () => window.clearInterval(intervalId);
  }, [profile?.id]);

  const retryRestoredBusiness = async () => {
    const current = profileRef.current;
    if (current) await loadRestoredBusiness(current, () => profileRef.current?.id === current.id);
  };
  const signOut = async () => {
    revoke();
    setLoading(false);
    await supabase.auth.signOut();
  };

  return <AuthContext.Provider value={{
    session, profile, loading, signOut,
    restoredBusinessReady, restoredBusinessError, retryRestoredBusiness, refreshAuthenticatedProfile,
  }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth harus digunakan di dalam AuthProvider');
  return context;
};
