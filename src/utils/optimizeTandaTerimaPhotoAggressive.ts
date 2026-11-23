/**
 * Read-only comparison presets for an existing Tanda Terima evidence photo.
 * These trial settings are NOT used by the actual upload workflow.
 * No uploads, metadata updates, or storage replacements occur here.
 */
export type CompressionTrialMode = "ultra" | "extreme";

const SETTINGS: Record<CompressionTrialMode, {
  maxLongEdge: number;
  targetBytes: number;
  qualities: readonly number[];
}> = {
  ultra: {
    maxLongEdge: 1400,
    targetBytes: 250 * 1024,
    qualities: [0.58, 0.55, 0.52],
  },
  extreme: {
    maxLongEdge: 1200,
    targetBytes: 150 * 1024,
    qualities: [0.48, 0.45, 0.42],
  },
};

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
  new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", quality));

export async function optimizeTandaTerimaPhotoAggressive(
  file: File,
  mode: CompressionTrialMode
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

  const setting = SETTINGS[mode];
  let bitmap: ImageBitmap | null = null;

  try {
    bitmap = await createImageBitmap(file);
    const longestEdge = Math.max(bitmap.width, bitmap.height);
    if (!longestEdge) return unchanged();

    const scale = Math.min(1, setting.maxLongEdge / longestEdge);
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
    for (const quality of setting.qualities) {
      const blob = await encodeJpeg(canvas, quality);
      if (!blob || blob.size <= 0) continue;
      if (!best || blob.size < best.blob.size) best = { blob, quality };
      if (blob.size <= setting.targetBytes) {
        best = { blob, quality };
        break;
      }
    }

    // Never overwrite the original; use it unchanged on encoder failure.
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
    return unchanged();
  } finally {
    bitmap?.close();
  }
}
