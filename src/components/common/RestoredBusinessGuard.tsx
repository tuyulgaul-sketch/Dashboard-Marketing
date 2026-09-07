import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { AppFeature, canAccessFeature } from '@/lib/accessControl';
import { Database, RefreshCw } from 'lucide-react';

interface Props {
  feature: AppFeature;
  children: React.ReactElement;
}

/** Prevent legacy pages from rendering against stale browser data. */
const RestoredBusinessGuard: React.FC<Props> = ({ feature, children }) => {
  const { profile, restoredBusinessReady, restoredBusinessError, retryRestoredBusiness } = useAuth();
  const [retrying, setRetrying] = useState(false);

  if (!canAccessFeature(profile, feature)) {
    return <Navigate to="/aktivitas" replace />;
  }
  if (restoredBusinessReady) return children;

  const retry = async () => {
    setRetrying(true);
    try {
      await retryRestoredBusiness();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <AppLayout>
      <Card className="mx-auto mt-6 max-w-xl border-slate-200">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <Database className="h-10 w-10 text-slate-400" />
          <div>
            <h1 className="text-lg font-bold text-slate-900">Data bisnis pusat belum siap</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {restoredBusinessError
                ? 'Data modul ini belum berhasil dimuat. Untuk mencegah penggunaan data browser lama, modul sementara tidak dapat dibuka. Fitur live lainnya tetap tersedia.'
                : 'Memuat data bisnis dari database pusat...'}
            </p>
          </div>
          <Button type="button" variant="outline" onClick={() => void retry()} disabled={retrying} className="gap-2">
            <RefreshCw className="h-4 w-4" />{retrying ? 'Memuat...' : 'Coba lagi'}
          </Button>
        </CardContent>
      </Card>
    </AppLayout>
  );
};

export default RestoredBusinessGuard;
