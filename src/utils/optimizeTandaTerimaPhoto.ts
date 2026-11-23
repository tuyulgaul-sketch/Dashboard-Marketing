/**
 * Reduce storage usage for photographic Tanda Terima evidence while retaining
 * enough detail to read text. This intentionally keeps PNG/screenshots and
 * small files untouched: they can contain sharp fine-grained text or diagrams.
 *
 * Runs in the browser before a new file is uploaded. No third-party service.
 */
const MIN_INPUT_BYTES = 600 * 1024;
const TARGET_BYTES = 850 * 1024;
const MAX_LONG_EDGE = 2560;
const MIN_SAVINGS_RATIO = 0.9;

const jpegQualities = [0.9, 0.87, 0.84] as const;

const encodeJpeg = (
  canvas: HTMLCanvasElement,
  quality: number
): Promise<Blob | null> =>
  new Promise(resolve => {
    canvas.toBlob(blob => resolve(blob), "image/jpeg", quality);
  });

export async function optimizeTandaTerimaPhoto(file: File): Promise<File> {
  // Only process photographic JPEGs. Leave PNG/HEIC/WebP and other
  // formats untouched instead of risking loss of text or orientation.
  if (
    file.size < MIN_INPUT_BYTES ||
    file.type !== "image/jpeg" ||
    typeof createImageBitmap !== "function"
  ) {
    return file;
  }

  let bitmap: ImageBitmap | null = null;
  try {
    // Browser image decoding applies the source EXIF orientation.
    bitmap = await createImageBitmap(file);

    const longestEdge = Math.max(bitmap.width, bitmap.height);
    if (!longestEdge) return file;

    const scale = Math.min(1, MAX_LONG_EDGE / longestEdge);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) return file;

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, width, height);

    let smallest: Blob | null = null;

    // Prefer the highest-quality image meeting the target. Do not lower
    // JPEG quality below 0.84 to chase a smaller storage figure.
    for (const quality of jpegQualities) {
      const candidate = await encodeJpeg(canvas, quality);
      if (!candidate || candidate.size <= 0) continue;
      if (!smallest || candidate.size < smallest.size) smallest = candidate;
      if (candidate.size <= TARGET_BYTES) {
        smallest = candidate;
        break;
      }
    }

    // Keep the original when optimization yields no meaningful saving.
    if (
      !smallest ||
      smallest.size >= file.size * MIN_SAVINGS_RATIO
    ) {
      return file;
    }

    return new File([smallest], file.name, {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } catch {
    // Decoding/encoding may fail on unusual camera files. Never discard
    // the original evidence just because optimization is unsupported.
    return file;
  } finally {
    bitmap?.close();
  }
}
