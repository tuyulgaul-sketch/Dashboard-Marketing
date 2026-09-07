import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import type { Session } from "@supabase/supabase-js";
import { canAccessFeature } from '@/lib/accessControl';
import { syncCentralMasterRuntime, clearCentralMasterRuntime } from '@/services/centralMasterRuntime';
import { syncCentralTargetRuntime, clearCentralTargetRuntime } from '@/services/centralTargetRuntime';
import { supabase } from "@/lib/supabase";
import { syncLegacyIdentityFromSupabase } from "@/lib/legacyIdentityBridge";
import { syncGlobalResetState } from "@/lib/globalResetSync";
import { clearCentralUserRuntime, syncCentralUserRuntime } from "@/services/centralUserRuntime";
import { clearCentralBusinessRuntime, syncCentralBusinessRuntime } from "@/services/centralBusinessStorageRuntime";

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
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const clearLiteRuntime = () => {
  clearCentralBusinessRuntime();
  clearCentralUserRuntime();
  clearCentralMasterRuntime();
  clearCentralTargetRuntime();
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [restoredBusinessReady, setRestoredBusinessReady] = useState(false);
  const [restoredBusinessError, setRestoredBusinessError] = useState<string | null>(null);

  const loadRestoredBusiness = useCallback(async (authProfile: AuthProfile) => {
    setRestoredBusinessReady(false);
    setRestoredBusinessError(null);
    try {
      await syncCentralMasterRuntime(authProfile);
      // Dashboard, production and support views also consume target data.
      // Use the existing server-authorized target runtime for every business
      // profile, even when the user cannot publish or edit Target & RKAP.
      if (canAccessFeature(authProfile, 'DASHBOARD')) {
        await syncCentralTargetRuntime(authProfile.id);
      } else {
        clearCentralTargetRuntime();
      }
      setRestoredBusinessReady(true);
    } catch (error) {
      clearCentralMasterRuntime();
      clearCentralTargetRuntime();
      const message = error instanceof Error ? error.message : 'Database pusat belum dapat dimuat.';
      console.error('[Restored Business] Sinkronisasi gagal', error);
      setRestoredBusinessError(message);
    }
  }, []);

  const loadProfile = useCallback(async (currentSession: Session | null) => {
    if (!currentSession) {
      setRestoredBusinessReady(false);
      setRestoredBusinessError(null);
      clearLiteRuntime();
      setProfile(null);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, auth_user_id, full_name, email, role_level, unit, department, manager_id, legacy_user_id, active")
      .eq("auth_user_id", currentSession.user.id)
      .eq("active", true)
      .single();

    if (error || !data) {
      console.error("Profile tidak ditemukan:", error);
      clearLiteRuntime();
      setProfile(null);
      return;
    }

    const authProfile = data as AuthProfile;
    try {
      await syncGlobalResetState();
    } catch (resetSyncError) {
      console.error("Global reset state sync gagal:", resetSyncError);
    }

    // Preserve the established identity bridge. Never invent a missing legacy ID.
    syncLegacyIdentityFromSupabase(authProfile);

    try {
      await syncCentralUserRuntime(authProfile);
      // A restored-module failure must not block the existing live services.
      await loadRestoredBusiness(authProfile);
      await syncCentralBusinessRuntime(authProfile);
    } catch (runtimeError) {
      console.error("Supabase Lite runtime gagal dimuat:", runtimeError);
      clearLiteRuntime();
      setProfile(null);
      return;
    }

    // Existing legacy pages now read centralized runtime snapshots.
    // No automatic migration of old browser/IndexedDB business records.
    setProfile(authProfile);
  }, [loadRestoredBusiness]);

  useEffect(() => {
    let mounted = true;
    const initialize = async () => {
      const { data: { session: initialSession } } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(initialSession);
      await loadProfile(initialSession);
      if (mounted) setLoading(false);
    };
    void initialize();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      setLoading(true);
      loadProfile(newSession).finally(() => {
        if (mounted) setLoading(false);
      });
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearLiteRuntime();
    };
  }, [loadProfile]);

  useEffect(() => {
    if (!profile) return;
    const intervalId = window.setInterval(async () => {
      try {
        const changed = await syncGlobalResetState();
        if (changed) window.location.reload();
      } catch (error) {
        console.error("Periodic global reset sync gagal:", error);
      }
    }, 60_000);
    return () => { window.clearInterval(intervalId); };
  }, [profile?.id]);

  const retryRestoredBusiness = async () => {
    if (profile) await loadRestoredBusiness(profile);
  };

  const signOut = async () => {
    setRestoredBusinessReady(false);
    setRestoredBusinessError(null);
    clearLiteRuntime();
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{
      session, profile, loading, signOut,
      restoredBusinessReady, restoredBusinessError, retryRestoredBusiness,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth harus digunakan di dalam AuthProvider");
  return context;
};
