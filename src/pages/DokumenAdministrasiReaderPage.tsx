import React, { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { canAccessFeature, isCrossSupportAdminDocumentReader } from "@/lib/accessControl";
import { listCentralBusinessEntities } from "@/services/centralBusinessService";
import { downloadMarketingSupportFile } from "@/services/marketingSupportFileStorage";
import type { ManagedServiceDocument } from "@/services/store";
import { Download, FileText, RefreshCw } from "lucide-react";

const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
};

/** A separate reader avoids granting legacy operator/approval privileges to other departments. */
export const DokumenAdministrasiReaderPage: React.FC = () => {
  const { profile } = useAuth();
  const [documents, setDocuments] = useState<ManagedServiceDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const allowed = canAccessFeature(profile, "DOCUMENT_ADMIN") && isCrossSupportAdminDocumentReader(profile);

  const loadDocuments = async () => {
    if (!allowed) return;
    setLoading(true);
    setError("");
    try {
      const rows = await listCentralBusinessEntities(["pertalife_service_documents"]);
      setDocuments(rows.map(row => row.payload as unknown as ManagedServiceDocument).filter(document =>
        document.ownerArea === "MARKETING_ADMINISTRATION" &&
        document.status === "PUBLISHED" &&
        (document.category === "SPAJ" || document.category === "SPAK")
      ));
    } catch (cause) {
      setDocuments([]);
      setError(cause instanceof Error ? cause.message : "Dokumen belum dapat dimuat. Hubungi System Admin.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (allowed) void loadDocuments();
    // Re-fetch when the authenticated profile changes, never reuse another user's list.
  }, [profile?.id, allowed]);

  const visibleDocuments = useMemo(() => {
    const query = search.trim().toLowerCase();
    return documents.filter(document =>
      !query || [document.title, document.category, document.productName, document.versionLabel, document.fileName]
        .filter(Boolean).join(" ").toLowerCase().includes(query)
    ).sort((a, b) => (b.approvedAt || b.uploadedAt).localeCompare(a.approvedAt || a.uploadedAt));
  }, [documents, search]);

  const handleDownload = async (document: ManagedServiceDocument) => {
    if (!allowed || downloadingId) return;
    setDownloadingId(document.id);
    try {
      // Existing private-storage service enforces the server's file visibility policy.
      await downloadMarketingSupportFile(document.id, document.fileName);
    } catch (cause) {
      window.alert(cause instanceof Error ? cause.message : "File tidak dapat diunduh.");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Dokumen Administrasi</h1>
            <p className="mt-1 text-sm text-slate-500">Katalog SPAJ dan SPAK yang telah dipublikasikan oleh Marketing Administration.</p>
          </div>
          <Button type="button" variant="outline" onClick={() => void loadDocuments()} disabled={loading || !allowed}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>
        {!allowed ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Akses Dokumen Administrasi tidak tersedia untuk akun ini.</div>
        ) : (
          <>
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
              Akses baca: melihat dan mengunduh dokumen published. Upload, perubahan status, approval, dan penghapusan tetap menjadi kewenangan Marketing Administration sesuai workflow yang berlaku.
            </div>
            <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Cari judul, produk, kategori, atau versi..." aria-label="Cari dokumen administrasi" />
            {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
            {loading ? <p className="text-sm text-slate-500">Memuat dokumen...</p> : (
              <div className="space-y-3">
                <p className="text-xs text-slate-500">{visibleDocuments.length} dokumen tersedia</p>
                {visibleDocuments.map(document => (
                  <div key={document.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div className="rounded-lg bg-slate-100 p-2"><FileText className="h-5 w-5 text-slate-600" /></div>
                      <div className="min-w-0 space-y-1">
                        <div className="font-semibold text-slate-900">{document.title}</div>
                        <div className="text-xs text-slate-500">{document.category} • {document.productName || "Semua produk"} • {document.versionLabel || `V${document.version}`}</div>
                        <div className="break-all text-xs text-slate-500">{document.fileName}</div>
                        <div className="text-xs text-slate-400">Dipublikasikan {formatDate(document.approvedAt || document.uploadedAt)}</div>
                      </div>
                    </div>
                    <Button type="button" variant="outline" disabled={Boolean(downloadingId)} onClick={() => void handleDownload(document)}>
                      <Download className="mr-2 h-4 w-4" />{downloadingId === document.id ? "Mengunduh..." : "Unduh"}
                    </Button>
                  </div>
                ))}
                {visibleDocuments.length === 0 && !error && <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">Belum ada dokumen published yang sesuai pencarian.</div>}
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default DokumenAdministrasiReaderPage;
