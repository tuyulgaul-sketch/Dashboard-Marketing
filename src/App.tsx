import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import {
  AuthProvider,
  useAuth,
} from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import {
  AppFeature,
  canAccessFeature,
  getDocumentFeatureFromSearch,
  isDigitalAffinityProfile,
  isSystemAdminProfile,
} from "@/lib/accessControl";

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

const FeatureOnly: React.FC<{
  feature: AppFeature;
  children: React.ReactElement;
}> = ({
  feature,
  children,
}) => {
  const { profile } = useAuth();

  if (!canAccessFeature(profile, feature)) {
    return (
      <Navigate
        to={
          canAccessFeature(
            profile,
            "ACTIVITY"
          )
            ? "/aktivitas"
            : "/"
        }
        replace
      />
    );
  }

  return children;
};

const DocumentOnly: React.FC<{
  children: React.ReactElement;
}> = ({ children }) => {
  const { profile } = useAuth();
  const location = useLocation();

  const feature =
    getDocumentFeatureFromSearch(
      location.search
    );

  if (
    !canAccessFeature(
      profile,
      feature
    )
  ) {
    return <Navigate to="/aktivitas" replace />;
  }

  return children;
};

const HomeRoute: React.FC = () => {
  const { profile } = useAuth();

  if (!profile) {
    return null;
  }

  if (isSystemAdminProfile(profile)) {
    return (
      <Navigate
        to="/administrasi"
        replace
      />
    );
  }

  if (
    isDigitalAffinityProfile(
      profile
    )
  ) {
    return <DigitalAffinityPage />;
  }

  // Safety fallback:
  // a newly imported profile without a legacy mapping never gets the
  // legacy dashboard fallback identity. Activity is Supabase-native.
  if (
    !profile.legacy_user_id
  ) {
    return (
      <Navigate
        to="/aktivitas"
        replace
      />
    );
  }

  return <Index />;
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
    <Route
      path="/login"
      element={<LoginPage />}
    />

    <Route
      path="/set-password"
      element={<SetPasswordPage />}
    />

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
          <FeatureOnly feature="ACTIVITY">
            <AktivitasUniversalPage />
          </FeatureOnly>
        </Protected>
      }
    />

    <Route
      path="/target-rkap"
      element={
        <Protected>
          <FeatureOnly feature="TARGET_RKAP">
            <TargetRkapPage />
          </FeatureOnly>
        </Protected>
      }
    />

    <Route
      path="/booking-pipeline"
      element={
        <Protected>
          <FeatureOnly feature="BOOKING_PIPELINE">
            <BookingPipelinePage />
          </FeatureOnly>
        </Protected>
      }
    />

    <Route
      path="/produksi"
      element={
        <Protected>
          <FeatureOnly feature="PRODUCTION">
            <ProduksiPage />
          </FeatureOnly>
        </Protected>
      }
    />

    <Route
      path="/dokumen-pendukung"
      element={
        <Protected>
          <DocumentOnly>
            <DokumenPendukungPage />
          </DocumentOnly>
        </Protected>
      }
    />

    <Route
      path="/tanda-terima"
      element={
        <Protected>
          <FeatureOnly feature="TANDA_TERIMA">
            <TandaTerimaPage />
          </FeatureOnly>
        </Protected>
      }
    />

    <Route
      path="/administrasi"
      element={
        <Protected>
          <FeatureOnly feature="SYSTEM_ADMIN">
            <AdministrasiPage />
          </FeatureOnly>
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
  <QueryClientProvider
    client={queryClient}
  >
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
