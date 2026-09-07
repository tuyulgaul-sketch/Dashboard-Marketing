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
import NativeAlertBridge from "@/components/common/NativeAlertBridge";
import BrandedActionDialog from "@/components/common/BrandedActionDialog";
import ReleaseSyncBridge from "@/components/common/ReleaseSyncBridge";
import {
  AppFeature,
  canAccessFeature,
  getDocumentFeatureFromSearch,
  isCrossSupportAdminDocumentReader,
  isSystemAdminProfile,
} from "@/lib/accessControl";

import Index from './pages/Index';
import TargetRkapPage from './pages/TargetRkapPage';
import BookingPipelinePage from './pages/BookingPipelinePage';
import ProduksiPage from './pages/ProduksiPage';
import DigitalAffinityPage from './pages/DigitalAffinityPage';
import RestoredBusinessGuard from './components/common/RestoredBusinessGuard';
import { isDigitalAffinityProfile } from '@/lib/accessControl';
import AktivitasUniversalPage from "./pages/AktivitasUniversalPage";
import MarketingMeetingRoomPage from "./pages/MarketingMeetingRoomPage";
import DokumenPendukungPage from "./pages/DokumenPendukungPage";
import DokumenAdministrasiReaderPage from "./pages/DokumenAdministrasiReaderPage";
import TandaTerimaV14Page from "./pages/TandaTerimaV14Page";
import AdministrasiPage from "./pages/AdministrasiPage";
import SetPasswordPage from "./pages/SetPasswordPage";
import LoginPage from "./pages/LoginPage";

const queryClient = new QueryClient();

const FeatureOnly: React.FC<{
  feature: AppFeature;
  children: React.ReactElement;
}> = ({ feature, children }) => {
  const { profile } = useAuth();

  if (!canAccessFeature(profile, feature)) {
    return <Navigate to="/aktivitas" replace />;
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
    return (
      <Navigate
        to="/aktivitas"
        replace
      />
    );
  }

  // The existing legacy workflow is reserved for its original roles.
  // Cross-support users read from the central service without assuming a
  // legacy identity, receiving upload, approval or mutation privileges.
  if (
    feature === "DOCUMENT_ADMIN" &&
    isCrossSupportAdminDocumentReader(profile)
  ) {
    return <DokumenAdministrasiReaderPage />;
  }

  return children;
};

const HomeRoute: React.FC = () => {
  const { profile } = useAuth();
  if (!profile) return null;
  if (isSystemAdminProfile(profile)) return <Navigate to="/administrasi" replace />;
  if (isDigitalAffinityProfile(profile)) return <DigitalAffinityPage />;
  if (!profile.legacy_user_id) return <Navigate to="/aktivitas" replace />;
  return <RestoredBusinessGuard feature="DASHBOARD"><Index /></RestoredBusinessGuard>;
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

    <Route path="/target-rkap" element={<Protected><RestoredBusinessGuard feature="TARGET_RKAP"><TargetRkapPage /></RestoredBusinessGuard></Protected>} />
    <Route path="/booking-pipeline" element={<Protected><RestoredBusinessGuard feature="BOOKING_PIPELINE"><BookingPipelinePage /></RestoredBusinessGuard></Protected>} />
    <Route path="/produksi" element={<Protected><RestoredBusinessGuard feature="PRODUCTION"><ProduksiPage /></RestoredBusinessGuard></Protected>} />

    <Route
      path="/booking-ruang-meeting"
      element={
        <Protected>
          <FeatureOnly feature="MEETING_ROOM">
            <MarketingMeetingRoomPage />
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
            <TandaTerimaV14Page />
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
          <Navigate
            to="/aktivitas"
            replace
          />
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
      <NativeAlertBridge />
      <BrandedActionDialog />

      <AuthProvider>
        <ReleaseSyncBridge />

        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
