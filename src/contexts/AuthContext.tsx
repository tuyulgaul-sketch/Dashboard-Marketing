import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { syncLegacyIdentityFromSupabase } from "@/lib/legacyIdentityBridge";

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

const AuthContext = createContext<AuthContextValue | undefined>(
  undefined
);

export const AuthProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [session, setSession] =
    useState<Session | null>(null);

  const [profile, setProfile] =
    useState<AuthProfile | null>(null);

  const [loading, setLoading] =
    useState(true);

  const loadProfile = async (
    currentSession: Session | null
  ) => {
    if (!currentSession) {
      setProfile(null);
      return;
    }

    const { data, error } = await supabase
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

    if (error || !data) {
      console.error(
        "Profile tidak ditemukan:",
        error
      );

      setProfile(null);
      return;
    }

    const authProfile =
      data as AuthProfile;

    // Keep old UAT modules aligned to the authenticated Supabase account.
    // If legacy_user_id is NULL the old modules are blocked by accessControl.
    syncLegacyIdentityFromSupabase(
      authProfile
    );

    setProfile(authProfile);
  };

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      const {
        data: { session: initialSession },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      setSession(initialSession);

      await loadProfile(initialSession);

      if (mounted) {
        setLoading(false);
      }
    };

    initialize();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (!mounted) return;

        setSession(newSession);
        setLoading(true);

        loadProfile(newSession).finally(() => {
          if (mounted) {
            setLoading(false);
          }
        });
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
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
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth harus digunakan di dalam AuthProvider"
    );
  }

  return context;
};
