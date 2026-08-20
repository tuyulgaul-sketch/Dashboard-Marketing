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
import Index from "./pages/Index";
import TargetRkapPage from "./pages/TargetRkapPage";
import AktivitasPage from "./pages/AktivitasPage";
import BookingPipelinePage from "./pages/BookingPipelinePage";
import ProduksiPage from "./pages/ProduksiPage";
import DokumenPendukungPage from "./pages/DokumenPendukungPage";
import AdministrasiPage from "./pages/AdministrasiPage";
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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />

      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              <BusinessOnly>
                <Index />
              </BusinessOnly>
            }
          />

          <Route
            path="/target-rkap"
            element={
              <BusinessOnly>
                <TargetRkapPage />
              </BusinessOnly>
            }
          />

          <Route
            path="/aktivitas"
            element={
              <BusinessOnly>
                <AktivitasPage />
              </BusinessOnly>
            }
          />

          <Route
            path="/booking-pipeline"
            element={
              <BusinessOnly>
                <BookingPipelinePage />
              </BusinessOnly>
            }
          />

          <Route
            path="/produksi"
            element={
              <BusinessOnly>
                <ProduksiPage />
              </BusinessOnly>
            }
          />

          <Route
            path="/dokumen-pendukung"
            element={
              <BusinessOnly>
                <DokumenPendukungPage />
              </BusinessOnly>
            }
          />

          <Route
            path="/administrasi"
            element={
              <SysAdminOnly>
                <AdministrasiPage />
              </SysAdminOnly>
            }
          />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
