import React, { useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { isTandaTerimaCompressionOperator } from "@/lib/accessControl";
import { supabase } from "@/lib/supabase";
import { optimizeTandaTerimaPhotoAggressive } from "@/utils/optimizeTandaTerimaPhotoAggressive";
import { ArrowLeft, HardDriveDownload, ShieldCheck, Square, Loader2 } from "lucide-react";

type StoredRow = {
  file_id: string;
  entity_id: string | null;
  storage_path: string;
  file_name: string;
  file_size: number;
  mime_type: string | null;
  metadata: Record<string, unknown> | null;
};

type WritableFile = {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
};
type LocalFileHandle = {
  createWritable(): Promise<WritableFile>;
  getFile(): Promise<File>;
};
type LocalDirectory = {
  getDirectoryHandle(name: string, options: { create: boolean }): Promise<LocalDirectory>;
  getFileHandle(name: string, options: { create: boolean }): Promise<LocalFileHandle>;
};
type PickerWindow = Window & {
  showDirectoryPicker?: (options?: { mode: "readwrite" }) => Promise<LocalDirectory>;
};

type LogEntry = { fileId: string; outcome: string };
type ManifestEntry = {
  fileId: string;
  entityId: string | null;
  backupFile: string;
  originalBytes: number;
  originalSha256: string;
  compressedBytes?: number;
  migrated: boolean;
  error?: string;
};

const MIN_BYTES = 200 * 1024;
const supported = (row: StoredRow) =>
  row.mime_type === "image/jpeg" &&
  row.storage_path.startsWith("TANDA_TERIMA/") &&
  row.file_size >= MIN_BYTES &&
  (row.metadata as { compression?: { mode?: string } } | null)
    ?.compression?.mode !== "EXTREME_V1";

function safeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 170);
}
function hex(bytes: Uint8Array): string {
  return [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
}
async function digest(blob: Blob): Promise<string> {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer())));
}
async function writeAndCheck(directory: LocalDirectory, name: string, blob: Blob, hash: string) {
  const handle = await directory.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  try {
    await writable.write(blob);
  } finally {
    await writable.close();
  }
  const copy = await handle.getFile();
  if (copy.size !== blob.size || await digest(copy) !== hash) {
    throw new Error("Backup lokal tidak lolos verifikasi; original cloud tidak diubah");
  }
}
const mib = (n: number) => (n / 1048576).toFixed(2) + " MiB";

const TandaTerimaStorageOptimizationPage: React.FC = () => {
  const { profile } = useAuth();
  const [rows, setRows] = useState<StoredRow[]>([]);
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [processed, setProcessed] = useState(0);
  const [savedBytes, setSavedBytes] = useState(0);
  const [migrated, setMigrated] = useState(0);
  const [failed, setFailed] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [message, setMessage] = useState("");
  const cancel = useRef(false);

  const scan = async () => {
    setLoading(true);
    setMessage("");
    try {
      const { data, error } = await supabase
        .from("central_business_files")
        .select("file_id,entity_id,storage_path,file_name,file_size,mime_type,metadata")
        .eq("module", "TANDA_TERIMA")
        .eq("storage_key", "pertalife_document_handovers")
        .order("file_id", { ascending: true })
        .range(0, 499);
      if (error) throw error;
      const candidates = ((data || []) as StoredRow[]).filter(supported);
      setRows(candidates);
      setScanned(true);
      setMessage(`Ada ${candidates.length} foto JPEG lama yang belum dikompres Extreme. Foto tanpa metadata registrasi tidak ikut.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal membaca daftar foto");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (!isTandaTerimaCompressionOperator(profile)) return;
    void scan();
  }, [profile?.auth_user_id]);

  const start = async () => {
    if (running) return;
    setMessage("");
    const picker = (window as PickerWindow).showDirectoryPicker;
    if (!picker) {
      setMessage("Fitur backup folder membutuhkan browser Microsoft Edge/Chrome terbaru di desktop, melalui HTTPS.");
      return;
    }

    let folder: LocalDirectory;
    try {
      // Must run inside the user's direct click gesture.
      const chosen = await picker.call(window, { mode: "readwrite" });
      folder = await chosen.getDirectoryHandle(
        "PertaLife_TandaTerima_Backup_" + new Date().toISOString().replace(/[:.]/g, "-"),
        { create: true }
      );
    } catch {
      setMessage("Folder backup tidak dipilih. Tidak ada file yang diubah.");
      return;
    }

    setRunning(true);
    cancel.current = false;
    setProcessed(0);
    setSavedBytes(0);
    setMigrated(0);
    setFailed(0);
    setLogs([]);
    let candidates: StoredRow[] = [];
    try {
      // Re-scan within the same button flow so the user does not have to
      // manually scan first. Ignore files with no registry and previously
      // optimized files.
      const { data, error } = await supabase
        .from("central_business_files")
        .select("file_id,entity_id,storage_path,file_name,file_size,mime_type,metadata")
        .eq("module", "TANDA_TERIMA")
        .eq("storage_key", "pertalife_document_handovers")
        .order("file_id", { ascending: true })
        .range(0, 499);
      if (error) throw error;
      candidates = ((data || []) as StoredRow[]).filter(supported);
      setRows(candidates);
      setScanned(true);
      if (candidates.length === 0) {
        setRunning(false);
        setMessage("Semua foto terdaftar sudah menggunakan Extreme atau tidak memerlukan kompresi. Tidak ada file yang diubah.");
        return;
      }
    } catch (err) {
      setRunning(false);
      setMessage(err instanceof Error ? err.message : "Gagal mengambil daftar foto");
      return;
    }

    const manifest: ManifestEntry[] = [];
    let success = 0, failures = 0, saved = 0, completed = 0;

    for (const row of candidates) {
      if (cancel.current) break;
      const entry: ManifestEntry = {
        fileId: row.file_id,
        entityId: row.entity_id,
        backupFile: safeFileName(row.file_id + "__" + row.file_name),
        originalBytes: 0,
        originalSha256: "",
        migrated: false,
      };

      try {
        const { data: blob, error: readError } = await supabase.storage
          .from("business-files").download(row.storage_path);
        if (readError || !blob) throw new Error("Gagal mengunduh foto asli");

        entry.originalBytes = blob.size;
        entry.originalSha256 = await digest(blob);
        await writeAndCheck(folder, entry.backupFile, blob, entry.originalSha256);

        const originalFile = new File([blob], row.file_name, { type: "image/jpeg" });
        const result = await optimizeTandaTerimaPhotoAggressive(originalFile, "extreme");
        if (result.file.size >= originalFile.size * 0.9) {
          throw new Error("Penghematan kurang dari 10%; file lama dipertahankan");
        }

        // Decode the compressed photo in the browser to catch broken output.
        const bitmap = await createImageBitmap(result.file);
        const dimensionOk = Math.max(bitmap.width, bitmap.height) <= 1200;
        bitmap.close();
        if (!dimensionOk) throw new Error("Resolusi hasil tidak sesuai preset Extreme");

        const body = new FormData();
        body.append("fileId", row.file_id);
        body.append("originalBytes", String(blob.size));
        body.append("originalSha256", entry.originalSha256);
        body.append("compressedPhoto", result.file, row.file_name);
        const { data: outcome, error: migrationError } = await supabase.functions.invoke(
          "compress-tanda-terima-evidence",
          { body }
        );
        if (migrationError || !outcome?.ok) {
          throw new Error(migrationError?.message || outcome?.error || "Server menolak migrasi");
        }

        success += 1;
        saved += Math.max(0, blob.size - Number(outcome.optimizedBytes || result.file.size));
        entry.compressedBytes = Number(outcome.optimizedBytes || result.file.size);
        entry.migrated = true;
        setLogs(prev => [{ fileId: row.file_id, outcome: outcome.warning || "Sukses" }, ...prev].slice(0, 30));
      } catch (error) {
        failures += 1;
        entry.error = error instanceof Error ? error.message : "Gagal";
        setLogs(prev => [{ fileId: row.file_id, outcome: "Gagal: " + entry.error }, ...prev].slice(0, 30));
      }

      manifest.push(entry);
      // Persist the index after every file so interrupted runs remain auditable.
      try {
        const manifestBlob = new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" });
        const handle = await folder.getFileHandle("manifest.json", { create: true });
        const writer = await handle.createWritable();
        await writer.write(manifestBlob);
        await writer.close();
      } catch {
        cancel.current = true;
        setMessage("Penulisan manifest backup gagal. Proses dihentikan untuk keamanan.");
      }

      completed += 1;
      setProcessed(completed);
      setMigrated(success);
      setFailed(failures);
      setSavedBytes(saved);
    }

    setRunning(false);
    const finishedMessage = cancel.current
      ? "Proses dihentikan. Foto yang sudah diproses tetap online, backup lokal tersimpan."
      : "Proses selesai. Simpan folder backup perusahaan sesuai kebijakan retensi.";
    // Refresh the remaining candidates without hiding the migration outcome.
    await scan();
    setMessage(finishedMessage);
  };

  // This single-account check is UI-only; Edge Function independently
  // validates the verified Supabase Auth user ID and active profile.
  if (!isTandaTerimaCompressionOperator(profile)) {
    return <Navigate to="/tanda-terima" replace />;
  }

  return (
    <AppLayout>
      <div className="space-y-5">
        <Link to="/tanda-terima" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:underline">
          <ArrowLeft className="h-4 w-4" /> Kembali ke Tanda Terima
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Kompres Semua Foto Tanda Terima</h1>
          <p className="mt-2 text-sm text-slate-600">
            Mode Extreme: JPEG 42–48%, maksimal 1.200 piksel. Bukti tetap bisa
            dibuka dari dashboard karena registry file diperbarui hanya setelah
            salinan kompresi terverifikasi.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Satu tombol kompresi massal — khusus akun Banjar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              Klik satu tombol di bawah, lalu <strong>izinkan pemilihan folder backup perusahaan</strong>
              ketika browser memintanya. Setelah folder dipilih, seluruh foto lama yang
              memenuhi kriteria akan otomatis di-backup, dikompres, dan diverifikasi
              satu per satu tanpa tindakan tambahan. Foto hasil kompresi tetap online di
              Supabase sehingga pengguna lain tetap bisa membukanya.
            </p>
            <p className="font-semibold text-amber-800">
              Simpan backup di folder perusahaan yang aman, bukan folder publik atau sinkronisasi pribadi.
              Biarkan halaman ini tetap terbuka hingga proses selesai.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={start} disabled={running || loading} className="bg-blue-700 text-white hover:bg-blue-800">
                {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <HardDriveDownload className="mr-2 h-4 w-4" />}
                {running ? "Sedang mengompres semua foto..." : "Kompres Semua Foto Tanda Terima"}
              </Button>
              {running && (
                <Button variant="destructive" onClick={() => { cancel.current = true; }}>
                  <Square className="mr-2 h-4 w-4" /> Stop setelah file saat ini
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="h-4 w-4 text-emerald-700" />
              Tombol hanya tersedia di akun Banjar. Akses server memverifikasi identitas login sebelum perubahan file.
            </div>
          </CardContent>
        </Card>

        {(scanned || running) && (
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              ["Foto perlu optimasi", String(rows.length)],
              ["Diproses", String(processed)],
              ["Berhasil", String(migrated)],
              ["Gagal / dilewati", String(failed)],
            ].map(([label, value]) => (
              <Card key={label}><CardContent className="pt-5">
                <p className="text-xs text-slate-500">{label}</p>
                <p className="text-xl font-bold">{value}</p>
              </CardContent></Card>
            ))}
          </div>
        )}
        {(scanned || running) && (
          <p className="text-sm font-semibold text-emerald-800">
            Estimasi penghematan terverifikasi dari proses ini: {mib(savedBytes)}
          </p>
        )}
        {message && <div role="status" className="rounded-lg border bg-white p-3 text-sm">{message}</div>}
        {logs.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Log proses terbaru</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-xs">
              {logs.map((log, i) => (
                <div key={log.fileId + ":" + i} className="border-b py-1">
                  <strong>{log.fileId}</strong>: {log.outcome}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
};

export default TandaTerimaStorageOptimizationPage;
