/**
 * Read-only aggressive compression trial for the receipt comparison page.
 * Separate from optimizeTandaTerimaPhoto: the production upload defaults
 * remain unchanged until users approve actual image legibility.
 */
const MAX_LONG_EDGE = 1800;
const TARGET_BYTES = 400 * 1024;
const QUALITIES = [0.7, 0.67, 0.65] as const;

export type AggressivePhotoResult = {
  file: File;
  quality: number | null;
  width: number | null;
  height: number | null;
};

const encodeJpeg = (
  canvas: HTMLCanvasElement,
  quality: number
): Promise<Blob | null> =>
  new Promise(resolve => {
    canvas.toBlob(blob => resolve(blob), "image/jpeg", quality);
  });

export async function optimizeTandaTerimaPhotoAggressive(
  file: File
): Promise<AggressivePhotoResult> {
  const unchanged = (): AggressivePhotoResult => ({
    file,
    quality: null,
    width: null,
    height: null,
  });

  if (file.type !== "image/jpeg" || typeof createImageBitmap !== "function") {
    return unchanged();
  }

  let bitmap: ImageBitmap | null = null;

  try {
    bitmap = await createImageBitmap(file);
    const longestEdge = Math.max(bitmap.width, bitmap.height);
    if (!longestEdge) return unchanged();

    const scale = Math.min(1, MAX_LONG_EDGE / longestEdge);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return unchanged();

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, width, height);

    let best: { blob: Blob; quality: number } | null = null;

    for (const quality of QUALITIES) {
      const blob = await encodeJpeg(canvas, quality);
      if (!blob || blob.size <= 0) continue;
      if (!best || blob.size < best.blob.size) {
        best = { blob, quality };
      }
      if (blob.size <= TARGET_BYTES) {
        best = { blob, quality };
        break;
      }
    }

    // Avoid keeping a degraded image that is as large as the original.
    if (!best || best.blob.size >= file.size) return unchanged();

    return {
      file: new File([best.blob], file.name, {
        type: "image/jpeg",
        lastModified: file.lastModified,
      }),
      quality: best.quality,
      width,
      height,
    };
  } catch {
    // Unsupported image decoding must not remove or alter source evidence.
    return unchanged();
  } finally {
    bitmap?.close();
  }
}
