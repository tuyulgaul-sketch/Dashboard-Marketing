import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useTargetRealizationPublisher } from '@/hooks/useTargetRealizationPublisher';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, FileSpreadsheet, Upload } from 'lucide-react';
import TargetRkapPage from '@/pages/TargetRkapPage';
import ProduksiPage from '@/pages/ProduksiPage';
import RkapPipelineMatrixUpload from '@/components/rkap/RkapPipelineMatrixUpload';

type UploadTab = 'targets' | 'bulk' | 'realization';

/** Existing validators and publishers are reused, not copied or rewritten. */
const TargetRealizationUploadPage: React.FC = () => {
  const { canPublish, loading } = useTargetRealizationPublisher();
  const [tab, setTab] = useState<UploadTab>('targets');

  if (loading) return <AppLayout><Card><CardContent className="p-10 text-center text-sm text-slate-500">Memverifikasi otoritas upload...</CardContent></Card></AppLayout>;
  if (!canPublish) return <Navigate to="/target-rkap" replace />;

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-5">
          <div className="rounded-lg bg-blue-50 p-2.5"><Upload className="h-5 w-5 text-blue-700" /></div>
          <div><h1 className="text-xl font-bold text-slate-900">Upload Target dan Realisasi</h1><p className="mt-1 text-xs text-slate-500">Pusat pengelolaan Target RKAP, Bulk Pipeline, dan Realisasi Produksi Official.</p><p className="mt-2 text-[11px] font-semibold text-blue-700">Otoritas: Arianie Fajarwati • Marketing Support</p></div>
        </div>
        <Tabs value={tab} onValueChange={value => setTab(value as UploadTab)} className="w-full">
          <TabsList className="grid h-auto w-full grid-cols-1 gap-1 bg-white p-1 sm:grid-cols-3">
            <TabsTrigger value="targets" className="gap-2 py-2.5 text-xs"><FileSpreadsheet className="h-4 w-4" /> Upload Target</TabsTrigger>
            <TabsTrigger value="bulk" className="gap-2 py-2.5 text-xs"><FileSpreadsheet className="h-4 w-4" /> Bulk Pipeline</TabsTrigger>
            <TabsTrigger value="realization" className="gap-2 py-2.5 text-xs"><FileSpreadsheet className="h-4 w-4" /> Upload Realisasi</TabsTrigger>
          </TabsList>
          <TabsContent value="targets" className="mt-4"><TargetRkapPage key="targets" embedded initialUploadTab="targets" publisherAuthorized={canPublish} /></TabsContent>
          <TabsContent value="bulk" className="mt-4"><RkapPipelineMatrixUpload publisherAuthorized={canPublish} /></TabsContent>
          <TabsContent value="realization" className="mt-4"><ProduksiPage embedded uploadOnly publisherAuthorized={canPublish} /></TabsContent>
        </Tabs>
        <div className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50/50 p-3 text-xs leading-relaxed text-blue-900"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><p>Setiap upload tetap menggunakan validasi, konfirmasi, dan mekanisme publish yang sudah ada. Perubahan ini hanya memindahkan tempat pengelolaannya; data existing tidak direset.</p></div>
      </div>
    </AppLayout>
  );
};

export default TargetRealizationUploadPage;
