import React, { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ADMIN_DOCUMENT_CATEGORIES, getAdminDocumentCategoryLabel, type AdminDocumentCategory } from '@/lib/adminDocumentCategories';
import { canDownloadAdminDocument, getAdminDocumentBrowseView, type AdminDocumentBrowseSelection } from '@/lib/adminDocumentBrowse';
import { getAdminDocumentProductOptions } from '@/lib/adminDocumentReaderView';
import type { ManagedServiceDocument } from '@/services/store';
import type { ProductMaster } from '@/types';
import { Check, ChevronRight, Download, FileText, LockKeyhole, Search } from 'lucide-react';

interface Props {
  documents: readonly ManagedServiceDocument[];
  products: readonly ProductMaster[];
  onDownload: (document: ManagedServiceDocument) => Promise<unknown>;
  loading?: boolean;
}

const formatDate = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
};

/** Used only for browsing; publisher upload and approval workflows remain separate. */
export const AdminDocumentBrowser: React.FC<Props> = ({ documents, products, onDownload, loading = false }) => {
  const [selection, setSelection] = useState<AdminDocumentBrowseSelection>({
    product: 'ALL', category: null, search: '',
  });
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const productOptions = useMemo(() => getAdminDocumentProductOptions(products, documents), [products, documents]);
  const view = useMemo(() => getAdminDocumentBrowseView(documents, selection), [documents, selection]);

  useEffect(() => {
    if (loading) return;
    if (selection.product !== 'ALL' && !productOptions.includes(selection.product)) {
      setSelection({ product: 'ALL', category: null, search: '' });
    }
  }, [loading, productOptions, selection.product]);

  const changeProduct = (product: string) => {
    setSelection({ product, category: null, search: '' });
  };

  const changeCategory = (category: AdminDocumentCategory) => {
    if (!view.productSelected || loading || downloadingId) return;
    setSelection(previous => ({ ...previous, category, search: '' }));
  };

  const handleDownload = async (document: ManagedServiceDocument) => {
    if (loading || downloadingId || !canDownloadAdminDocument(documents, selection, document)) return;
    setDownloadingId(document.id);
    try {
      await onDownload(document);
    } catch (cause) {
      window.alert(cause instanceof Error ? cause.message : 'File tidak dapat diunduh.');
    } finally {
      setDownloadingId(null);
    }
  };

  const busy = loading || Boolean(downloadingId);
  const selectedCategoryLabel = view.category ? getAdminDocumentCategoryLabel(view.category) : '';

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <label className="block text-xs font-bold text-gray-700" id="admin-document-product-label">1. Pilih produk</label>
        <Select value={selection.product} onValueChange={changeProduct} disabled={busy}>
          <SelectTrigger className="w-full text-xs sm:max-w-md" aria-labelledby="admin-document-product-label">
            <SelectValue placeholder="Pilih Produk" />
          </SelectTrigger>
          <SelectContent className="z-[120] max-h-80">
            <SelectItem value="ALL">Semua Produk</SelectItem>
            {productOptions.map(productName => (
              <SelectItem key={productName} value={productName}>{productName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500">Pilih produk yang sesuai sebelum membuka dokumen. Pilihan Semua Produk hanya menampilkan jumlah dokumen.</p>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-bold text-gray-700">2. Pilih jenis dokumen</div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {ADMIN_DOCUMENT_CATEGORIES.map(category => {
            const selected = view.category === category.value;
            const disabled = !view.productSelected || busy;
            return (
              <Card key={category.value} className={`overflow-hidden ${selected ? 'border-blue-500 bg-blue-50/60' : 'border-blue-100 bg-blue-50/30'}`}>
                <CardContent className="p-0">
                  <button
                    type="button"
                    disabled={disabled}
                    aria-pressed={selected}
                    aria-label={`${category.label}, ${view.counts[category.value]} dokumen published${!view.productSelected ? '. Pilih produk terlebih dahulu.' : '. Lihat dokumen.'}`}
                    onClick={() => changeCategory(category.value)}
                    className={`flex w-full items-center justify-between gap-3 p-4 text-left transition-colors ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-600'}`}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-black text-gray-900">{category.label}</div>
                      <div className="mt-1 text-[10px] text-gray-500">{loading ? 'Memuat...' : `${view.counts[category.value]} dokumen published`}</div>
                      <div className="mt-2 text-[10px] font-medium text-blue-700">
                        {!view.productSelected ? 'Pilih produk terlebih dahulu' : selected ? 'Sedang ditampilkan' : 'Klik untuk melihat dokumen'}
                      </div>
                    </div>
                    {selected ? <Check className="h-5 w-5 shrink-0 text-blue-600" /> :
                      disabled ? <LockKeyhole className="h-4 w-4 shrink-0 text-gray-400" /> :
                        <ChevronRight className="h-5 w-5 shrink-0 text-blue-600" />}
                  </button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500" role="status">Memuat dokumen...</p>
      ) : !view.productSelected ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500" role="status">
          Pilih produk terlebih dahulu untuk mengaktifkan kartu SPAJ, SPAK, atau Fact Finding.
        </div>
      ) : !view.category ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500" role="status">
          Produk <span className="font-semibold text-gray-700">{selection.product}</span> dipilih. Klik salah satu kartu untuk melihat dokumen yang tersedia.
        </div>
      ) : (
        <section className="space-y-3" aria-label={`Dokumen ${selectedCategoryLabel} untuk ${selection.product}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-gray-900">{selectedCategoryLabel}</h2>
              <p className="text-xs text-gray-500">Produk: {selection.product}</p>
            </div>
            <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">{view.counts[view.category]} published</Badge>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input value={selection.search} onChange={event => setSelection(previous => ({ ...previous, search: event.target.value }))}
              placeholder="Cari judul, nama file, atau versi..." aria-label="Cari dokumen pada produk dan jenis terpilih" className="pl-9 text-xs" />
          </div>
          {view.visibleDocuments.length > 0 && <p className="text-xs text-gray-500">{view.visibleDocuments.length} dokumen tersedia</p>}
          {view.visibleDocuments.map(document => (
            <Card key={document.id} className="border-gray-200 bg-white shadow-sm">
              <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="rounded-lg bg-blue-50 p-2"><FileText className="h-5 w-5 text-blue-600" /></div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-black text-gray-950">{document.title}</div>
                      <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700">Published</Badge>
                    </div>
                    <div className="text-xs text-gray-500">{getAdminDocumentCategoryLabel(document.category)} • {document.productName} • {document.versionLabel || `V${document.version}`}</div>
                    <div className="break-all text-xs text-gray-500">{document.fileName}</div>
                    <div className="text-xs text-gray-400">Dipublikasikan {formatDate(document.approvedAt || document.uploadedAt)}</div>
                  </div>
                </div>
                <Button type="button" size="sm" variant="outline" disabled={busy || !canDownloadAdminDocument(documents, selection, document)} onClick={() => void handleDownload(document)}>
                  <Download className="mr-2 h-4 w-4" />{downloadingId === document.id ? 'Mengunduh...' : 'Unduh'}
                </Button>
              </CardContent>
            </Card>
          ))}
          {view.visibleDocuments.length === 0 && (
            <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500">
              {selection.search.trim() ? 'Tidak ada dokumen yang sesuai pencarian pada produk dan jenis ini.' : `Belum ada dokumen ${selectedCategoryLabel} published untuk produk ${selection.product}.`}
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default AdminDocumentBrowser;
