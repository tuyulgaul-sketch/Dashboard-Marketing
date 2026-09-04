import React, {
  useEffect,
  useState,
} from "react";
import {
  KeyRound,
  LogOut,
  Menu,
  RotateCcw,
  UserRoundCog,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import NotificationBell from "@/components/layout/NotificationBell";
import PasswordControlDialog from "@/components/layout/PasswordControlDialog";
import {
  clearAdminImpersonationMarker,
  getAdminImpersonationMarker,
  type AdminImpersonationMarker,
} from "@/lib/adminImpersonation";

interface AppHeaderProps {
  onMenuClick?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  onMenuClick,
}) => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [impersonationMarker, setImpersonationMarker] =
    useState<AdminImpersonationMarker | null>(() =>
      getAdminImpersonationMarker()
    );

  useEffect(() => {
    setImpersonationMarker(
      getAdminImpersonationMarker()
    );
  }, [profile?.id]);

  const activeImpersonation =
    profile &&
    impersonationMarker?.target_profile_id === profile.id
      ? impersonationMarker
      : null;

  const handleLogout = async () => {
    clearAdminImpersonationMarker();
    await signOut();
    navigate("/login", { replace: true });
  };

  const handleReturnToAdmin = async () => {
    const adminEmail =
      activeImpersonation?.admin_email || "";

    clearAdminImpersonationMarker();
    setImpersonationMarker(null);
    await signOut();

    const params =
      new URLSearchParams();

    if (adminEmail) {
      params.set("email", adminEmail);
    }

    params.set(
      "impersonation_return",
      "1"
    );

    navigate(
      `/login?${params.toString()}`,
      { replace: true }
    );
  };

  const isSystemAdmin =
    profile?.role_level?.trim().toUpperCase() === "SYSTEM_ADMIN";

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-3 shadow-sm sm:px-6">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 md:hidden"
            onClick={onMenuClick}
            aria-label="Buka menu"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <img
            src="/pertalife.png"
            alt="PertaLife Insurance"
            className="h-8 w-auto shrink-0 object-contain sm:h-10"
          />

          <div className="min-w-0">
            <h1 className="truncate text-xs font-bold leading-none text-gray-900 sm:text-sm">
              PT PERTA LIFE INSURANCE
            </h1>
            <p className="mt-1 hidden text-[11px] font-medium leading-none text-gray-500 sm:block">
              Created by Digital Affinity
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          {profile && !isSystemAdmin && <NotificationBell />}

          {activeImpersonation && (
            <div className="hidden items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1.5 md:flex">
              <UserRoundCog className="h-4 w-4 text-amber-700" />
              <div className="max-w-40 truncate text-[10px] font-bold text-amber-900">
                Login As: {profile?.full_name}
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 border-amber-300 px-2 text-[10px] text-amber-900 hover:bg-amber-100"
                onClick={handleReturnToAdmin}
              >
                <RotateCcw className="mr-1 h-3.5 w-3.5" />
                Kembali Admin
              </Button>
            </div>
          )}

          <div className="hidden text-right lg:block">
            <div className="text-xs font-bold text-slate-900">
              {profile?.full_name || "User"}
            </div>
            <div className="mt-0.5 text-[10px] text-slate-500">
              {[profile?.role_level, profile?.unit]
                .filter(Boolean)
                .join(" • ")}
            </div>
          </div>

          {activeImpersonation && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9 border-amber-300 px-2 text-amber-900 md:hidden"
              onClick={handleReturnToAdmin}
              aria-label="Kembali ke akun admin"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}

          {profile && !activeImpersonation && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 w-9 px-0 sm:w-auto sm:px-3"
              onClick={() => setPasswordOpen(true)}
              aria-label="Ubah password"
            >
              <KeyRound className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Password</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            className="h-9 w-9 px-0 sm:w-auto sm:px-3"
            onClick={handleLogout}
            aria-label="Logout"
          >
            <LogOut className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </header>

      <PasswordControlDialog
        open={passwordOpen}
        onOpenChange={setPasswordOpen}
      />
    </>
  );
};
