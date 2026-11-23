import React, { useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCentralBusinessFile } from "@/services/businessFileStorage";
import { optimizeTandaTerimaPhoto } from "@/utils/optimizeTandaTerimaPhoto";
import { ArrowLeft, Download, Image, Loader2, ShieldCheck } from "lucide-react";

// Read-only one-file experiment. Never write to Supabase or replace an object.
const FILE_ID = "TRM-SUBMIT-1794532913998-kegn";
const RECEIPT_ID = "TRM-2026-11-00006";

type Preview = {
  beforeUrl: string;
  afterUrl: string;
  originalBytes: number;
  optimizedBytes: number;
  compressed: boolean;
  fileName: string;
};

const mb = (bytes: number) => (bytes / (1024 * 1024)).toFixed(2) + " MiB";
const savedPercent = (before: number, after: number) =>
  before > 0 ? Math.max(0, (100 * (before - after)) / before).toFixed(1) : "0.0";

const TandaTerimaCompressionTestPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);

  // Revoke previous blob URLs on reload/unmount; these URLs only live in
  // the authenticated user's browser and are not uploaded anywhere.
  const urls = React.useRef<string[]>([]);
  React.useEffect(() => () => {
    urls.current.forEach(url => URL.revokeObjectURL(url));
    urls.current = [];
  }, []);

  const run = async () => {
    if (loading) return;
    setLoading(true);
    setError("");
    setPreview(null);
    urls.current.forEach(url => URL.revokeObjectURL(url));
    urls.current = [];

    try {
      const stored = await getCentralBusinessFile(FILE_ID);
      if (!stored) {
        throw new Error("File tidak ditemukan atau akun tidak berwenang mengaksesnya.");
      }
      const metadata = stored.metadata;
      if (
        metadata.module !== "TANDA_TERIMA" ||
        metadata.entity_id !== RECEIPT_ID ||
        metadata.mime_type !== "image/jpeg"
      ) {
        throw new Error("File terdaftar tidak sesuai dengan bukti Tanda Terima yang diminta.");
      }

      const original = new File([stored.blob], metadata.file_name || "image.jpg", {
        type: "image/jpeg",
      });
      const optimized = await optimizeTandaTerimaPhoto(original);

      const beforeUrl = URL.createObjectURL(original);
      const afterUrl = URL.createObjectURL(optimized);
      urls.current = [beforeUrl, afterUrl];

      setPreview({
        beforeUrl,
        afterUrl,
        originalBytes: original.size,
        optimizedBytes: optimized.size,
        compressed: optimized !== original,
        fileName: metadata.file_name || "image.jpg",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memproses foto.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-5">
        <Link to="/tanda-terima" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:underline">
          <ArrowLeft className="h-4 w-4" /> Kembali ke Tanda Terima
        </Link>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900">Tes Kompresi Foto Tanda Terima</h1>
          <p className="text-sm text-slate-600">
            Nomor <strong>{RECEIPT_ID}</strong>. Tes hanya membaca foto yang sudah ada di
            Supabase dan membuat salinan kompresi di browser. Foto asli, metadata,
            tautan, dan hak akses pengguna <strong>tidak berubah</strong>.
          </p>
        </div>

        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 pt-6">
            <Button onClick={run} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Image className="mr-2 h-4 w-4" />}
              {loading ? "Mengunduh & mengompres..." : "Muat & kompres foto contoh"}
            </Button>
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Tidak ada upload, update, atau delete
            </span>
          </CardContent>
        </Card>

        {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}. Pastikan login dengan akun yang memiliki akses Tanda Terima.
        </div>}

        {preview && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Card>
                <CardContent className="pt-5">
                  <p className="text-sm text-slate-500">Ukuran asli</p>
                  <p className="text-2xl font-bold">{mb(preview.originalBytes)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5">
                  <p className="text-sm text-slate-500">Hasil optimasi</p>
                  <p className="text-2xl font-bold">{mb(preview.optimizedBytes)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5">
                  <p className="text-sm text-slate-500">Penghematan</p>
                  <p className="text-2xl font-bold text-emerald-700">
                    {savedPercent(preview.originalBytes, preview.optimizedBytes)}%
                  </p>
                </CardContent>
              </Card>
            </div>

            {!preview.compressed && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Foto tidak diperkecil karena proses kompresi tidak memberi penghematan berarti.
                File asli tetap dipakai.
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Foto asli</CardTitle>
                  <p className="text-xs text-slate-500">File yang saat ini tersimpan di Supabase</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <a href={preview.beforeUrl} target="_blank" rel="noreferrer" title="Buka foto asli ukuran penuh">
                    <img src={preview.beforeUrl} alt="Foto asli Tanda Terima" className="max-h-[640px] w-full cursor-zoom-in rounded-md border bg-slate-100 object-contain" />
                  </a>
                  <p className="text-xs text-slate-500">Klik gambar untuk cek ketajaman pada ukuran penuh.</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Foto hasil kompresi</CardTitle>
                  <p className="text-xs text-slate-500">Kualitas JPEG minimal 84%, sisi terpanjang maksimal 2560 piksel</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <a href={preview.afterUrl} target="_blank" rel="noreferrer" title="Buka foto kompresi ukuran penuh">
                    <img src={preview.afterUrl} alt="Foto hasil kompresi Tanda Terima" className="max-h-[640px] w-full cursor-zoom-in rounded-md border bg-slate-100 object-contain" />
                  </a>
                  <Button asChild variant="outline">
                    <a href={preview.afterUrl} download={"KOMPRESI_" + RECEIPT_ID + "_" + preview.fileName}>
                      <Download className="mr-2 h-4 w-4" /> Download hasil kompresi
                    </a>
                  </Button>
                  <p className="text-xs text-slate-500">
                    Periksa nama, tanda tangan, cap, dan tulisan kecil sebelum memutuskan
                    apakah kualitasnya memadai.
                  </p>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default TandaTerimaCompressionTestPage;
