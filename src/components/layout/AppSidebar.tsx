import React from "react";
import {
  Link,
  NavLink,
  useLocation,
} from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  canAccessFeature,
  isDigitalAffinityProfile,
  isMarketingSupportRootProfile,
  isSystemAdminProfile,
} from "@/lib/accessControl";
import {
  Briefcase,
  CalendarCheck,
  ChevronRight,
  FileText,
  LayoutDashboard,
  Megaphone,
  Settings,
  Target,
  TrendingUp,
} from "lucide-react";

interface FlyoutItem {
  label: string;
  path: string;
  icon: React.ComponentType<{
    className?: string;
  }>;
}

export const AppSidebar: React.FC = () => {
  const { profile } = useAuth();
  const location = useLocation();

  const isDigitalAffinity =
    isDigitalAffinityProfile(
      profile
    );

  const isSystemAdmin =
    isSystemAdminProfile(
      profile
    );

  const isSupportRoot =
    isMarketingSupportRootProfile(
      profile
    );

  const canSeeTarget =
    canAccessFeature(
      profile,
      "TARGET_RKAP"
    );

  const canSeeBooking =
    canAccessFeature(
      profile,
      "BOOKING_PIPELINE"
    );

  const canSeeProduction =
    canAccessFeature(
      profile,
      "PRODUCTION"
    );

  const canSeeAdminDocs =
    canAccessFeature(
      profile,
      "DOCUMENT_ADMIN"
    );

  const canSeeMarcommDocs =
    canAccessFeature(
      profile,
      "DOCUMENT_MARCOMM"
    );

  const showAdministration =
    canSeeBooking ||
    canSeeProduction ||
    canSeeAdminDocs;

  const showCommunication =
    canSeeMarcommDocs;

  const isExactActive = (
    path: string
  ) => {
    const [
      pathname,
      search = "",
    ] = path.split("?");

    if (
      location.pathname !==
      pathname
    ) {
      return false;
    }

    if (!search) {
      return !location.search;
    }

    const expected =
      new URLSearchParams(
        search
      );

    const current =
      new URLSearchParams(
        location.search
      );

    for (
      const [
        key,
        value,
      ] of expected.entries()
    ) {
      if (
        current.get(key) !==
        value
      ) {
        return false;
      }
    }

    return true;
  };

  const administrationItems:
    FlyoutItem[] = [
      ...(canSeeBooking
        ? [
            {
              label:
                "Booking & Pipeline",
              path:
                "/booking-pipeline",
              icon: Briefcase,
            },
          ]
        : []),

      ...(canSeeProduction
        ? [
            {
              label:
                "Produksi",
              path: "/produksi",
              icon: TrendingUp,
            },
          ]
        : []),

      ...(canSeeAdminDocs
        ? [
            {
              label:
                "Dokumen Administrasi",
              path:
                "/dokumen-pendukung?area=administration",
              icon: FileText,
            },
          ]
        : []),
    ];

  const communicationItems:
    FlyoutItem[] = [
      ...(canSeeMarcommDocs
        ? [
            {
              label:
                "Marketing Tools",
              path:
                "/dokumen-pendukung?area=marketing-tools",
              icon: FileText,
            },
            {
              label:
                "Permintaan Marcomm",
              path:
                "/dokumen-pendukung?area=marcomm-requests",
              icon: Megaphone,
            },
          ]
        : []),
    ];

  const renderFlyoutGroup = (
    label: string,
    icon: React.ComponentType<{
      className?: string;
    }>,
    items: FlyoutItem[]
  ) => {
    if (
      items.length === 0
    ) {
      return null;
    }

    const GroupIcon = icon;

    const groupActive =
      items.some((item) =>
        isExactActive(
          item.path
        )
      );

    return (
      <div
        className="group relative"
        tabIndex={0}
      >
        <button
          type="button"
          className={`flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-left text-xs font-semibold transition-all ${
            groupActive
              ? "bg-slate-800 text-white"
              : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          }`}
        >
          <GroupIcon className="h-4 w-4 shrink-0" />

          <span className="min-w-0 flex-1 truncate">
            {label}
          </span>

          <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </button>

        <div className="pointer-events-none absolute left-full top-0 z-[200] ml-2 w-60 rounded-xl border border-slate-700 bg-slate-950 p-2 opacity-0 shadow-2xl transition-all group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
          <div className="px-3 pb-2 pt-1 text-[9px] font-black uppercase tracking-[0.16em] text-slate-600">
            {label}
          </div>

          <div className="space-y-1">
            {items.map(
              (item) => {
                const ItemIcon =
                  item.icon;

                const active =
                  isExactActive(
                    item.path
                  );

                return (
                  <Link
                    key={
                      item.path
                    }
                    to={
                      item.path
                    }
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-semibold transition ${
                      active
                        ? "bg-blue-600 text-white"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    <ItemIcon className="h-4 w-4 shrink-0" />

                    <span>
                      {
                        item.label
                      }
                    </span>
                  </Link>
                );
              }
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <aside className="flex min-h-[calc(100vh-64px)] w-60 shrink-0 flex-col border-r border-slate-800/80 bg-slate-950">
      <div className="px-4 pb-2 pt-5">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
          Menu Utama
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {!isSystemAdmin && (
          <NavLink
            to="/"
            end
            className={({
              isActive,
            }) =>
              `flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-xs font-semibold transition-all ${
                isActive
                  ? "bg-blue-600 text-white shadow-md shadow-blue-900/40"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
              }`
            }
          >
            <LayoutDashboard className="h-4 w-4 shrink-0" />
            <span>
              Dashboard
            </span>
          </NavLink>
        )}

        {canSeeTarget && (
          <NavLink
            to="/target-rkap"
            className={({
              isActive,
            }) =>
              `flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-xs font-semibold transition-all ${
                isActive
                  ? "bg-blue-600 text-white shadow-md shadow-blue-900/40"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
              }`
            }
          >
            <Target className="h-4 w-4 shrink-0" />

            <span>
              {isSupportRoot
                ? "Target & RKAP"
                : "Target Kinerja"}
            </span>
          </NavLink>
        )}

        {canAccessFeature(
          profile,
          "ACTIVITY"
        ) && (
          <NavLink
            to="/aktivitas"
            className={({
              isActive,
            }) =>
              `flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-xs font-semibold transition-all ${
                isActive
                  ? "bg-blue-600 text-white shadow-md shadow-blue-900/40"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
              }`
            }
          >
            <CalendarCheck className="h-4 w-4 shrink-0" />

            <span>
              Aktivitas
            </span>
          </NavLink>
        )}

        {(showAdministration ||
          showCommunication) && (
          <div className="pt-3">
            <div className="px-3 pb-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-slate-700">
              Service Marketing Support
            </div>

            <div className="space-y-1">
              {showAdministration &&
                renderFlyoutGroup(
                  "Marketing Administration",
                  Briefcase,
                  administrationItems
                )}

              {showCommunication &&
                renderFlyoutGroup(
                  "Marketing Communication",
                  Megaphone,
                  communicationItems
                )}
            </div>
          </div>
        )}

        {isSystemAdmin && (
          <div className="pt-3">
            <NavLink
              to="/administrasi"
              className={({
                isActive,
              }) =>
                `flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                }`
              }
            >
              <Settings className="h-4 w-4 shrink-0" />

              <span>
                Administrasi Sistem
              </span>
            </NavLink>
          </div>
        )}
      </nav>

      <div className="border-t border-slate-800/80 p-4 text-[11px] text-slate-500">
        <div className="font-semibold text-slate-400">
          Perta Life Marketing OS
        </div>

        <div>
          {isDigitalAffinity
            ? "Digital & Affinity"
            : profile?.department ||
              profile?.unit ||
              "Supabase RBAC"}
        </div>
      </div>
    </aside>
  );
};

export default AppSidebar;
