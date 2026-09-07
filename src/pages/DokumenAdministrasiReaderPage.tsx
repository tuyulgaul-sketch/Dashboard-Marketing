import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { canAccessFeature, isCrossSupportAdminDocumentReader } from '@/lib/accessControl';
import { ADMIN_DOCUMENT_CATEGORIES } from '@/lib/adminDocumentCategories';
import {
  filterPublishedAdminDocuments,
  getAdminDocumentProductOptions,
  getPublishedAdminDocumentCounts,
} from '@/lib/adminDocumentReaderView';
import { supabase } from '@/lib/supabase';
import { downloadMarketingSupportFile } from '@/services/marketingSupportFileStorage';
import { store, type ManagedServiceDocument } from '@/services/store';
import type { ProductMaster } from '@/types';
import { Download, FileText, RefreshCw, Search } from 'lucide-react';

const formatDate = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
};

/** Same repository browsing experience, without entering the legacy mutation workflow. */
export const DokumenAdministrasiReaderPage: React.FC = () => {
  const { profile } = useAuth();
  const allowed = canAccessFeature(profile, 'DOCUMENT_ADMIN') && isCrossSupportAdminDocumentReader(profile);
  const [catalogue, setCatalogue] = useState<{ profileId: string | null; documents: ManagedServiceDocument[] }>({
    profileId: null, documents: [],
  });
  const [products, setProducts] = useState<ProductMaster[]>(() => store.getProducts());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [productFilter, setProductFilter] = useState('ALL');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const requestSequence = useRef(0);

  useEffect(() => {
    const refresh = () => setProducts(store.getProducts());
    refresh();
    return store.subscribe(refresh);
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
      // Only the server-filtered published catalogue is read. Never fetch all business payloads.
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
  const productOptions = useMemo(() => getAdminDocumentProductOptions(products, documents), [products, documents]);
  const counts = useMemo(() => getPublishedAdminDocumentCounts(documents), [documents]);
  const visibleDocuments = useMemo(() => filterPublishedAdminDocuments(documents, {
    product: productFilter, search,
  }), [documents, productFilter, search]);

  useEffect(() => {
    if (productFilter !== 'ALL' && !productOptions.includes(productFilter)) setProductFilter('ALL');
  }, [productFilter, productOptions]);

  const handleDownload = async (document: ManagedServiceDocument) => {
    if (!allowed || downloadingId || catalogue.profileId !== profile?.id) return;
    setDownloadingId(document.id);
    try {
      // Metadata and private Storage SELECT are re-authorized by the backend.
      await downloadMarketingSupportFile(document.id, document.fileName);
    } catch (cause) {
      window.alert(cause instanceof Error ? cause.message : 'File tidak dapat diunduh.');
    } finally {
      setDownloadingId(null);
    }
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
              Repository SPAJ, SPAK, dan Fact Finding. Suci/Ayu/Ulfia/Raydinda upload, Endah Wasis final approve, lalu tersedia untuk seluruh Marketing.
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
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {ADMIN_DOCUMENT_CATEGORIES.map(category => (
                <Card key={category.value} className="border-blue-100 bg-blue-50/30">
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <div className="text-sm font-black text-gray-900">{category.label}</div>
                      <div className="mt-1 text-[10px] text-gray-500">{counts[category.value]} dokumen published</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_260px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input value={search} onChange={event => setSearch(event.target.value)}
                  placeholder="Cari judul, produk, file..." aria-label="Cari dokumen administrasi" className="pl-9 text-xs" />
              </div>
              <Select value={productFilter} onValueChange={setProductFilter}>
                <SelectTrigger className="text-xs" aria-label="Filter produk">
                  <SelectValue placeholder="Semua Produk" />
                </SelectTrigger>
                <SelectContent className="z-[120] max-h-80">
                  <SelectItem value="ALL">Semua Produk</SelectItem>
                  {productOptions.map(productName => (
                    <SelectItem key={productName} value={productName}>{productName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
            {loading ? (
              <p className="text-sm text-gray-500">Memuat dokumen...</p>
            ) : (
              <div className="space-y-3">
                {visibleDocuments.length > 0 && (
                  <p className="text-xs text-gray-500">{visibleDocuments.length} dokumen tersedia</p>
                )}
                {visibleDocuments.map(document => (
                  <Card key={document.id} className="border-gray-200 bg-white shadow-sm">
                    <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <div className="rounded-lg bg-blue-50 p-2"><FileText className="h-5 w-5 text-blue-600" /></div>
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-sm font-black text-gray-950">{document.title}</div>
                            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700">Published</Badge>
                          </div>
                          <div className="text-xs text-gray-500">{document.category} • {document.productName || 'Semua produk'} • {document.versionLabel || `V${document.version}`}</div>
                          <div className="break-all text-xs text-gray-500">{document.fileName}</div>
                          <div className="text-xs text-gray-400">Dipublikasikan {formatDate(document.approvedAt || document.uploadedAt)}</div>
                        </div>
                      </div>
                      <Button type="button" size="sm" variant="outline" disabled={Boolean(downloadingId)} onClick={() => void handleDownload(document)}>
                        <Download className="mr-2 h-4 w-4" />{downloadingId === document.id ? 'Mengunduh...' : 'Unduh'}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
                {visibleDocuments.length === 0 && !error && (
                  <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500">
                    {productFilter === 'ALL' && !search.trim()
                      ? 'Belum ada dokumen published.'
                      : 'Belum ada dokumen published yang sesuai pencarian.'}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default DokumenAdministrasiReaderPage;
