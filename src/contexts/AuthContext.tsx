import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { syncLegacyIdentityFromSupabase } from "@/lib/legacyIdentityBridge";
import { syncGlobalResetState } from "@/lib/globalResetSync";
import {
  clearCentralMasterRuntime,
  syncCentralMasterRuntime,
} from "@/services/centralMasterRuntime";

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
};

const AuthContext =
  createContext<AuthContextValue | undefined>(
    undefined
  );

export const AuthProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [session, setSession] =
    useState<Session | null>(
      null
    );

  const [profile, setProfile] =
    useState<AuthProfile | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  const loadProfile = async (
    currentSession: Session | null
  ) => {
    if (!currentSession) {
      clearCentralMasterRuntime();
      setProfile(null);
      return;
    }

    const { data, error } =
      await supabase
        .from("profiles")
        .select(
          "id, auth_user_id, full_name, email, role_level, unit, department, manager_id, legacy_user_id, active"
        )
        .eq(
          "auth_user_id",
          currentSession.user.id
        )
        .eq("active", true)
        .single();

    if (
      error ||
      !data
    ) {
      console.error(
        "Profile tidak ditemukan:",
        error
      );

      clearCentralMasterRuntime();
      setProfile(null);
      return;
    }

    const authProfile =
      data as AuthProfile;

    try {
      await syncGlobalResetState();
    } catch (resetSyncError) {
      console.error(
        "Global reset state sync gagal:",
        resetSyncError
      );
    }

    // Legacy identity remains temporarily required by modules that are not
    // yet migrated. User/hierarchy authority itself is Supabase profiles.
    syncLegacyIdentityFromSupabase(
      authProfile
    );

    try {
      // Critical ordering:
      // load the central Product/Broker/Agent snapshot BEFORE protected
      // business pages render. This prevents old browser-local master data
      // from influencing Target checker / Pipeline forms / Master lookups.
      await syncCentralMasterRuntime(
        authProfile
      );
    } catch (
      masterDataError
    ) {
      console.error(
        "Central master data gagal dimuat:",
        masterDataError
      );

      // Fail closed. Do not silently continue with localStorage master data.
      clearCentralMasterRuntime();
      setProfile(null);

      return;
    }

    setProfile(authProfile);
  };

  useEffect(() => {
    let mounted = true;

    const initialize =
      async () => {
        const {
          data: {
            session:
              initialSession,
          },
        } =
          await supabase.auth.getSession();

        if (!mounted) {
          return;
        }

        setSession(
          initialSession
        );

        await loadProfile(
          initialSession
        );

        if (mounted) {
          setLoading(false);
        }
      };

    initialize();

    const {
      data: {
        subscription,
      },
    } =
      supabase.auth.onAuthStateChange(
        (
          _event,
          newSession
        ) => {
          if (!mounted) {
            return;
          }

          setSession(
            newSession
          );

          setLoading(true);

          loadProfile(
            newSession
          ).finally(() => {
            if (mounted) {
              setLoading(
                false
              );
            }
          });
        }
      );

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearCentralMasterRuntime();
    };
  }, []);

  useEffect(() => {
    if (!profile) {
      return;
    }

    const intervalId =
      window.setInterval(
        async () => {
          try {
            const changed =
              await syncGlobalResetState();

            if (changed) {
              window.location.reload();
            }
          } catch (error) {
            console.error(
              "Periodic global reset sync gagal:",
              error
            );
          }
        },
        60_000
      );

    return () => {
      window.clearInterval(
        intervalId
      );
    };
  }, [profile?.id]);

  const signOut = async () => {
    clearCentralMasterRuntime();

    await supabase.auth.signOut();

    setSession(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        loading,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context =
    useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth harus digunakan di dalam AuthProvider"
    );
  }

  return context;
};
