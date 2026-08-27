import React from "react";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import NotificationBell from "@/components/layout/NotificationBell";

export const AppHeader: React.FC = () => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  const isSystemAdmin =
    profile?.role_level?.trim().toUpperCase() === "SYSTEM_ADMIN";

  return (
    <header className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between sticky top-0 z-30 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-700 to-indigo-900 flex items-center justify-center text-white font-black text-lg shadow-md">
          P
        </div>
        <div>
          <h1 className="text-sm font-bold text-gray-900 leading-none">
            PT PERTA LIFE INSURANCE
          </h1>
          <p className="text-[11px] text-gray-500 font-medium leading-none mt-1">
            Dashboard Marketing Operating System
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {profile && !isSystemAdmin && <NotificationBell />}

        <div className="hidden sm:block text-right">
          <div className="text-xs font-bold text-slate-900">
            {profile?.full_name || "User"}
          </div>
          <div className="mt-0.5 text-[10px] text-slate-500">
            {[profile?.role_level, profile?.unit]
              .filter(Boolean)
              .join(" • ")}
          </div>
        </div>

        <Button variant="outline" size="sm" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </header>
  );
};
