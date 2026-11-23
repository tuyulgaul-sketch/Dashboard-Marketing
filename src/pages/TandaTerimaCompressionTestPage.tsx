import React, { useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCentralBusinessFile } from "@/services/businessFileStorage";
import {
  CompressionTrialMode,
  optimizeTandaTerimaPhotoAggressive,
} from "@/utils/optimizeTandaTerimaPhotoAggressive";
import { ArrowLeft, Download, Image, Loader2, ShieldCheck } from "lucide-react";

// Authenticated read-only experiment. Original production storage is untouched.
const FILE_ID = "TRM-SUBMIT-1794532913998-kegn";
const RECEIPT_ID = "TRM-2026-11-00006";

type Trial = {
  mode: CompressionTrialMode;
  label: string;
  description: string;
  url: string;
  bytes: number;
  quality: number | null;
  width: number | null;
  height: number | null;
  compressed: boolean;
};

type Preview = {
  originalUrl: string;
  originalBytes: number;
  fileName: string;
  trials: Trial[];
};

const formatBytes = (bytes: number) =>
  bytes >= 1024 * 1024
    ? (bytes / (1024 * 1024)).toFixed(2) + " MiB"
    : (bytes / 1024).toFixed(0) + " KB";

const savedPercent = (before: number, after: number) =>
  before > 0 ? ((100 * (before - after)) / before).toFixed(1) : "0.0";

const OPTIONS: Array<{
  mode: CompressionTrialMode;
  label: string;
  description: string;
}> = [
  {
    mode: "ultra",
    label: "Ultra Hemat",
    description: "Maks. 1.400 px · JPEG 52–58% · target sekitar 250 KB",
  },
  {
    mode: "extreme",
    label: "Ekstrem",
    description: "Maks. 1.200 px · JPEG 42–48% · target sekitar 150 KB",
  },
];

const TandaTerimaCompressionTestPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);

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
        throw new Error("File terdaftar tidak sesuai dengan foto Tanda Terima yang diminta.");
      }

      const original = new File(
        [stored.blob],
        metadata.file_name || "image.jpg",
        { type: "image/jpeg" }
      );
      const originalUrl = URL.createObjectURL(original);
      urls.current.push(originalUrl);

      const trials: Trial[] = [];
      for (const option of OPTIONS) {
        const result = await optimizeTandaTerimaPhotoAggressive(
          original,
          option.mode
        );
        const url = URL.createObjectURL(result.file);
        urls.current.push(url);
        trials.push({
          ...option,
          url,
          bytes: result.file.size,
          quality: result.quality,
          width: result.width,
          height: result.height,
          compressed: result.file !== original,
        });
      }

      setPreview({
        originalUrl,
        originalBytes: original.size,
        fileName: metadata.file_name || "image.jpg",
        trials,
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
        <Link
          to="/tanda-terima"
          className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali ke Tanda Terima
        </Link>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900">
            Tes Kompresi Ultra Hemat & Ekstrem
          </h1>
          <p className="text-sm text-slate-600">
            Foto <strong>{RECEIPT_ID}</strong>. Bandingkan foto asli dengan dua
            hasil kompresi. Hanya membaca foto dari Supabase dan memprosesnya
            di browser; file asli, metadata, dan akses pengguna tidak berubah.
          </p>
        </div>

        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 pt-6">
            <Button onClick={run} disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Image className="mr-2 h-4 w-4" />
              )}
              {loading
                ? "Mengunduh & membuat dua versi..."
                : "Muat foto & bandingkan 2 mode"}
            </Button>
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Tidak ada upload, update, atau delete di Supabase
            </span>
          </CardContent>
        </Card>

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}. Pastikan login dengan akun yang memiliki akses Tanda Terima.
          </div>
        )}

        {preview && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-white px-4 py-3 text-sm text-slate-700">
              Ukuran asli: <strong>{formatBytes(preview.originalBytes)}</strong>.
              Klik gambar untuk melihat ukuran penuh; cek tulisan kecil, cap,
              dan tanda tangan sebelum memilih tingkat kompresi.
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Foto Asli</CardTitle>
                  <p className="text-sm font-semibold text-slate-700">
                    {formatBytes(preview.originalBytes)}
                  </p>
                  <p className="text-xs text-slate-500">Belum dikompres</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <a
                    href={preview.originalUrl}
                    target="_blank"
                    rel="noreferrer"
                    title="Buka foto asli ukuran penuh"
                  >
                    <img
                      src={preview.originalUrl}
                      alt="Foto asli Tanda Terima"
                      className="max-h-[630px] w-full cursor-zoom-in rounded-md border bg-slate-100 object-contain"
                    />
                  </a>
                </CardContent>
              </Card>

              {preview.trials.map(trial => (
                <Card key={trial.mode}>
                  <CardHeader>
                    <CardTitle>{trial.label}</CardTitle>
                    <p className="text-xs text-slate-500">{trial.description}</p>
                    <p className="text-sm font-semibold text-slate-800">
                      {formatBytes(trial.bytes)}
                      {" · hemat "}
                      {savedPercent(preview.originalBytes, trial.bytes)}%
                    </p>
                    {trial.quality !== null && (
                      <p className="text-xs text-slate-600">
                        Aktual: JPEG {Math.round(trial.quality * 100)}%
                        {" · "}{trial.width} × {trial.height} px
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <a
                      href={trial.url}
                      target="_blank"
                      rel="noreferrer"
                      title={"Buka " + trial.label + " ukuran penuh"}
                    >
                      <img
                        src={trial.url}
                        alt={"Foto Tanda Terima " + trial.label}
                        className="max-h-[630px] w-full cursor-zoom-in rounded-md border bg-slate-100 object-contain"
                      />
                    </a>
                    {trial.compressed ? (
                      <Button asChild variant="outline" className="w-full">
                        <a
                          href={trial.url}
                          download={
                            trial.mode.toUpperCase() +
                            "_" + RECEIPT_ID + "_" + preview.fileName
                          }
                        >
                          <Download className="mr-2 h-4 w-4" /> Unduh versi {trial.label}
                        </a>
                      </Button>
                    ) : (
                      <p className="text-xs text-amber-700">
                        Tidak menghasilkan versi lebih kecil; foto asli digunakan.
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
            <p className="text-xs text-slate-500">
              Angka target bersifat perkiraan, bukan batas ukuran wajib.
              Hasil yang terlihat kecil pada layar belum tentu cukup jelas
              saat dizoom; cek detail sebelum dipakai untuk dokumen bukti.
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default TandaTerimaCompressionTestPage;
