import { optimizeTandaTerimaPhotoAggressive } from "./optimizeTandaTerimaPhotoAggressive";

/**
 * Default compression for newly uploaded Tanda Terima evidence.
 * Extreme preset was approved after visual comparison of a sample receipt.
 * Preserve tiny existing JPEGs and non-JPEG images (PNG screenshots etc.)
 * because aggressive JPEG re-encoding could destroy fine text.
 */
export async function optimizeTandaTerimaPhoto(file: File): Promise<File> {
  if (file.type !== "image/jpeg" || file.size < 200 * 1024) {
    return file;
  }

  const result = await optimizeTandaTerimaPhotoAggressive(file, "extreme");
  return result.file;
}
