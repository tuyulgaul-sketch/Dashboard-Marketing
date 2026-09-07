import React, { useEffect, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AlertCircle, Eye, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getDocumentHandoverFile } from '@/services/documentHandoverFileStorage';
import { resolveHandoverPhotoMime } from '@/lib/handoverPhotoPreview';

type PhotoPreview = { url: string; fileName: string };

type Props = {
  fileId: string;
  fileName?: string;
  transactionId: string;
};

/** Reads the existing private evidence, without a public URL or new permission. */
const HandoverEvidencePreview: React.FC<Props> = ({ fileId, fileName, transactionId }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PhotoPreview | null>(null);

  useEffect(() => {
    if (!open) {
      setPreview(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    setLoading(true);
    setError(null);
    setPreview(null);

    void (async () => {
      try {
        const stored = await getDocumentHandoverFile(fileId);
        if (!stored) throw new Error('Foto tidak ditemukan di penyimpanan pusat.');
        // Do not allow a copied evidence ID to preview a different registry.
        if (stored.transactionId !== transactionId) {
          throw new Error('Foto ini tidak terkait dengan registry Tanda Terima yang dipilih.');
        }
        const name = stored.fileName || fileName || 'Foto bukti';
        const mime = resolveHandoverPhotoMime(stored.fileType || stored.blob.type, name);
        if (!mime) {
          throw new Error('Format file ini tidak didukung untuk preview foto. Gunakan Download Foto untuk membuka file aslinya.');
        }
        if (cancelled) return;
        // The URL exists only in this browser session and is revoked on close.
        objectUrl = URL.createObjectURL(new Blob([stored.blob], { type: mime }));
        setPreview({ url: objectUrl, fileName: name });
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : 'Foto bukti tidak dapat ditampilkan.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, fileId, fileName, transactionId]);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-8 gap-2 bg-white text-[11px]"
        aria-label={`Preview foto ${fileName || fileId}`}
      >
        <Eye className="h-3.5 w-3.5" />
        Preview Foto
      </Button>
      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[300] bg-black/85" />
          <DialogPrimitive.Content
            className="fixed inset-0 z-[301] flex h-screen h-[100dvh] w-screen flex-col overflow-hidden bg-slate-950 text-white shadow-2xl focus:outline-none"
            aria-describedby={undefined}
          >
            <header className="flex shrink-0 items-center justify-between gap-4 border-b border-white/15 px-4 py-3 pr-16 sm:px-6 sm:pr-20">
              <div className="min-w-0">
                <DialogPrimitive.Title className="text-sm font-semibold sm:text-base">Preview Foto Tanda Terima</DialogPrimitive.Title>
                <DialogPrimitive.Description className="mt-1 truncate text-xs text-slate-300">
                  {preview?.fileName || fileName || 'Foto bukti'}
                </DialogPrimitive.Description>
              </div>
            </header>
            <DialogPrimitive.Close
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-lg text-white hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label="Tutup preview foto"
            >
              <X className="h-5 w-5" />
            </DialogPrimitive.Close>
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3 sm:p-6" aria-live="polite">
              {loading ? (
                <div className="flex items-center gap-3 text-sm text-slate-200" role="status">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Memuat foto...
                </div>
              ) : error ? (
                <div className="flex max-w-md flex-col items-center gap-3 text-center text-sm text-slate-200" role="alert">
                  <AlertCircle className="h-8 w-8 text-amber-300" />
                  <p>{error}</p>
                </div>
              ) : preview ? (
                <img
                  src={preview.url}
                  alt={preview.fileName}
                  className="max-h-full max-w-full object-contain"
                  onError={() => {
                    setPreview(null);
                    setError('Browser tidak dapat menampilkan format foto ini. Silakan gunakan Download Foto untuk membuka file aslinya.');
                  }}
                />
              ) : null}
            </div>
            <footer className="flex shrink-0 justify-end border-t border-white/15 px-4 py-3 sm:px-6">
              <DialogPrimitive.Close asChild>
                <Button type="button" variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white">
                  Tutup
                </Button>
              </DialogPrimitive.Close>
            </footer>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
};

export default HandoverEvidencePreview;
