import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { AdminDocumentBrowser } from '@/components/documents/AdminDocumentBrowser';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { canAccessFeature, isCrossSupportAdminDocumentReader } from '@/lib/accessControl';
import { filterPublishedAdminDocuments } from '@/lib/adminDocumentReaderView';
import { supabase } from '@/lib/supabase';
import { downloadMarketingSupportFile } from '@/services/marketingSupportFileStorage';
import { store, type ManagedServiceDocument } from '@/services/store';
import type { ProductMaster } from '@/types';
import { FileText, RefreshCw } from 'lucide-react';

/** Cross-support readers never enter the legacy upload/approval workflow. */
export const DokumenAdministrasiReaderPage: React.FC = () => {
  const { profile } = useAuth();
  const allowed = canAccessFeature(profile, 'DOCUMENT_ADMIN') && isCrossSupportAdminDocumentReader(profile);
  const [catalogue, setCatalogue] = useState<{ profileId: string | null; documents: ManagedServiceDocument[] }>({
    profileId: null, documents: [],
  });
  const [products, setProducts] = useState<ProductMaster[]>(() => store.getProducts());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestSequence = useRef(0);

  useEffect(() => {
    const refresh = () => setProducts(store.getProducts());
    refresh();
    const unsubscribe = store.subscribe(refresh);
    return () => { unsubscribe(); };
  }, []);

  const loadDocuments = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setCatalogue({ profileId: null, documents: [] });
    setError('');
    if (!allowed || !profile?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // The backend returns only published Marketing Administration documents.
      const { data, error: queryError } = await supabase.rpc('list_published_admin_documents_v31');
      if (queryError) throw queryError;
      if (sequence !== requestSequence.current) return;
      setCatalogue({
        profileId: profile.id,
        documents: filterPublishedAdminDocuments((data || []) as ManagedServiceDocument[], { product: 'ALL', search: '' }),
      });
    } catch (cause) {
      if (sequence !== requestSequence.current) return;
      setError(cause instanceof Error ? cause.message : 'Dokumen belum dapat dimuat. Hubungi System Admin.');
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [allowed, profile?.id]);

  useEffect(() => {
    void loadDocuments();
    return () => { requestSequence.current += 1; };
  }, [loadDocuments]);

  // Never display the previous user's catalogue while Auth is switching accounts.
  const documents = allowed && catalogue.profileId === profile?.id ? catalogue.documents : [];
  const handleDownload = async (document: ManagedServiceDocument) => {
    if (!allowed || catalogue.profileId !== profile?.id || !documents.some(item => item === document)) return;
    // The backend re-authorizes metadata and private Storage SELECT.
    await downloadMarketingSupportFile(document.id, document.fileName);
  };

  return (
    <AppLayout>
      <div className="w-full space-y-6 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-black text-gray-950">
              <FileText className="h-6 w-6 text-blue-600" /> Dokumen Administrasi
            </h1>
            <p className="mt-1 text-xs leading-relaxed text-gray-500">
              Repository SPAJ, SPAK, dan Fact Finding. Pilih produk dan jenis dokumen sebelum mengunduh. Dokumen dipublikasikan setelah final approval Marketing Administration.
            </p>
          </div>
          {allowed && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">Akses baca</Badge>
              <Button type="button" variant="outline" size="sm" onClick={() => void loadDocuments()} disabled={loading}>
                <RefreshCw className="mr-2 h-4 w-4" /> Refresh
              </Button>
            </div>
          )}
        </div>
        {!allowed ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Akses Dokumen Administrasi tidak tersedia untuk akun ini.</div>
        ) : (
          <>
            {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
            <AdminDocumentBrowser
              key={profile?.id || 'no-profile'}
              documents={documents}
              products={products}
              loading={loading}
              onDownload={handleDownload}
            />
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default DokumenAdministrasiReaderPage;
