import React, { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import { store } from "@/services/store";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

import Index from "./pages/Index";
import TargetRkapPage from "./pages/TargetRkapPage";
import AktivitasUniversalPage from "./pages/AktivitasUniversalPage";
import BookingPipelinePage from "./pages/BookingPipelinePage";
import ProduksiPage from "./pages/ProduksiPage";
import DokumenPendukungPage from "./pages/DokumenPendukungPage";
import AdministrasiPage from "./pages/AdministrasiPage";
import TandaTerimaPage from "./pages/TandaTerimaPage";
import SetPasswordPage from "./pages/SetPasswordPage";
import LoginPage from "./pages/LoginPage";
import DigitalAffinityPage from "./pages/DigitalAffinityPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const useCurrentRole = () => {
  const [role, setRole] = useState(store.getCurrentUser().role);

  useEffect(() => {
    const refresh = () => {
      setRole(store.getCurrentUser().role);
    };

    refresh();
    return store.subscribe(refresh);
  }, []);

  return role;
};

const BusinessOnly: React.FC<{
  children: React.ReactElement;
}> = ({ children }) => {
  const role = useCurrentRole();

  if (role === "SYSTEM_ADMIN") {
    return <Navigate to="/administrasi" replace />;
  }

  return children;
};

const SysAdminOnly: React.FC<{
  children: React.ReactElement;
}> = ({ children }) => {
  const role = useCurrentRole();

  if (role !== "SYSTEM_ADMIN") {
    return <Navigate to="/" replace />;
  }

  return children;
};

const TandaTerimaOnly: React.FC<{
  children: React.ReactElement;
}> = ({ children }) => {
  const role = useCurrentRole();

  const allowedRoles = [
    "DIRECTOR_MARKETING",
    "ADVISOR_MARKETING_DIRECTOR",
    "VP_CAPTIVE_MARKETING",
    "VP_CORPORATE_RETAIL_MARKETING",
    "DEPARTMENT_HEAD_MARKETING",
    "SUPERVISOR_MARKETING",
    "STAFF_MARKETING",
    "TEAM_LEADER_MARKETING_SUPPORT",
    "DEPARTMENT_HEAD_MARKETING_ADMINISTRATION",
    "SUPERVISOR_MARKETING_ADMINISTRATION",
    "STAFF_MARKETING_ADMINISTRATION",
  ];

  if (role === "SYSTEM_ADMIN") {
    return <Navigate to="/administrasi" replace />;
  }

  if (!allowedRoles.includes(role)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

const HomeRoute: React.FC = () => {
  const { profile } = useAuth();

  const normalizedUnit =
    (profile?.unit || "").toLowerCase();

  const isDigitalAffinity =
    normalizedUnit.includes("digital") &&
    normalizedUnit.includes("affinity");

  if (isDigitalAffinity) {
    return <DigitalAffinityPage />;
  }

  return (
    <BusinessOnly>
      <Index />
    </BusinessOnly>
  );
};

const Protected = ({
  children,
}: {
  children: React.ReactElement;
}) => (
  <ProtectedRoute>
    {children}
  </ProtectedRoute>
);

const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/set-password" element={<SetPasswordPage />} />

    <Route
      path="/"
      element={
        <Protected>
          <HomeRoute />
        </Protected>
      }
    />

    <Route
      path="/aktivitas"
      element={
        <Protected>
          <AktivitasUniversalPage />
        </Protected>
      }
    />

    <Route
      path="/target-rkap"
      element={
        <Protected>
          <BusinessOnly>
            <TargetRkapPage />
          </BusinessOnly>
        </Protected>
      }
    />

    <Route
      path="/booking-pipeline"
      element={
        <Protected>
          <BusinessOnly>
            <BookingPipelinePage />
          </BusinessOnly>
        </Protected>
      }
    />

    <Route
      path="/produksi"
      element={
        <Protected>
          <BusinessOnly>
            <ProduksiPage />
          </BusinessOnly>
        </Protected>
      }
    />

    <Route
      path="/dokumen-pendukung"
      element={
        <Protected>
          <BusinessOnly>
            <DokumenPendukungPage />
          </BusinessOnly>
        </Protected>
      }
    />

    <Route
      path="/tanda-terima"
      element={
        <Protected>
          <TandaTerimaOnly>
            <TandaTerimaPage />
          </TandaTerimaOnly>
        </Protected>
      }
    />

    <Route
      path="/administrasi"
      element={
        <Protected>
          <SysAdminOnly>
            <AdministrasiPage />
          </SysAdminOnly>
        </Protected>
      }
    />

    <Route
      path="*"
      element={
        <Protected>
          <NotFound />
        </Protected>
      }
    />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />

      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
