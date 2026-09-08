import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useTargetRealizationPublisher } from '@/hooks/useTargetRealizationPublisher';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, Archive, FileSpreadsheet, Upload, Target as TargetIcon } from 'lucide-react';
import TargetRkapPage from '@/pages/TargetRkapPage';
import ProduksiPage from '@/pages/ProduksiPage';
import RkapPipelineMatrixUpload from '@/components/rkap/RkapPipelineMatrixUpload';
import OfficialUploadArchiveManager from '@/components/rkap/OfficialUploadArchiveManager';
import TargetOnScreenSetup from '@/components/rkap/TargetOnScreenSetup';

type UploadTab = 'setup' | 'targets' | 'bulk' | 'realization' | 'manage';

/** The original publisher boundary and existing upload workflows are preserved. */
const TargetRealizationUploadPage: React.FC = () => {
  const { canPublish, loading } = useTargetRealizationPublisher();
  const [tab, setTab] = useState<UploadTab>('setup');

  if (loading) return <AppLayout><Card><CardContent className="p-10 text-center text-sm text-slate-500">Memverifikasi otoritas publisher...</CardContent></Card></AppLayout>;
  if (!canPublish) return <Navigate to="/target-rkap" replace />;

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-5">
          <div className="rounded-lg bg-blue-50 p-2.5"><TargetIcon className="h-5 w-5 text-blue-700" /></div>
          <div><h1 className="text-xl font-bold text-slate-900">Setup Target dan Realisasi</h1><p className="mt-1 text-xs text-slate-500">Pengelolaan Target RKAP, Bulk Pipeline, dan Realisasi Produksi Official.</p><p className="mt-2 text-[11px] font-semibold text-blue-700">Otoritas: Arianie Fajarwati • Marketing Support</p></div>
        </div>
        <Tabs value={tab} onValueChange={value => setTab(value as UploadTab)} className="w-full">
          <TabsList className="grid h-auto w-full grid-cols-1 gap-1 bg-white p-1 sm:grid-cols-2 lg:grid-cols-5">
            <TabsTrigger value="setup" className="gap-2 py-2.5 text-xs"><TargetIcon className="h-4 w-4" /> Setup Target</TabsTrigger>
            <TabsTrigger value="targets" className="gap-2 py-2.5 text-xs"><FileSpreadsheet className="h-4 w-4" /> Upload Target Excel</TabsTrigger>
            <TabsTrigger value="bulk" className="gap-2 py-2.5 text-xs"><FileSpreadsheet className="h-4 w-4" /> Bulk Pipeline</TabsTrigger>
            <TabsTrigger value="realization" className="gap-2 py-2.5 text-xs"><FileSpreadsheet className="h-4 w-4" /> Upload Realisasi</TabsTrigger>
            <TabsTrigger value="manage" className="gap-2 py-2.5 text-xs"><Archive className="h-4 w-4" /> Kelola / Hapus Upload</TabsTrigger>
          </TabsList>
          <TabsContent value="setup" className="mt-4" forceMount hidden={tab !== 'setup'}><TargetOnScreenSetup publisherAuthorized={canPublish} /></TabsContent>
          <TabsContent value="targets" className="mt-4"><TargetRkapPage key="targets" embedded initialUploadTab="targets" publisherAuthorized={canPublish} /></TabsContent>
          <TabsContent value="bulk" className="mt-4"><RkapPipelineMatrixUpload publisherAuthorized={canPublish} /></TabsContent>
          <TabsContent value="realization" className="mt-4"><ProduksiPage embedded uploadOnly publisherAuthorized={canPublish} /></TabsContent>
          <TabsContent value="manage" className="mt-4"><OfficialUploadArchiveManager /></TabsContent>
        </Tabs>
        <div className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50/50 p-3 text-xs leading-relaxed text-blue-900"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><p>Setup target, upload, dan penghapusan hanya tersedia bagi publisher resmi. Target baru tidak mengganti data resmi sebelum validasi dan konfirmasi Publish. Penghapusan tetap memerlukan preview, alasan, serta konfirmasi ID batch; riwayat resmi dipertahankan.</p></div>
      </div>
    </AppLayout>
  );
};

export default TargetRealizationUploadPage;
