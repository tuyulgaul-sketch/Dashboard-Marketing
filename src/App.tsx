import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import TargetRkapPage from "./pages/TargetRkapPage";
import AktivitasPage from "./pages/AktivitasPage";
import BookingPipelinePage from "./pages/BookingPipelinePage";
import ProduksiPage from "./pages/ProduksiPage";
import DokumenPendukungPage from "./pages/DokumenPendukungPage";
import AdministrasiPage from "./pages/AdministrasiPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/target-rkap" element={<TargetRkapPage />} />
          <Route path="/aktivitas" element={<AktivitasPage />} />
          <Route path="/booking-pipeline" element={<BookingPipelinePage />} />
          <Route path="/produksi" element={<ProduksiPage />} />
          <Route path="/dokumen-pendukung" element={<DokumenPendukungPage />} />
          <Route path="/administrasi" element={<AdministrasiPage />} />
          {/* CATCH-ALL ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;