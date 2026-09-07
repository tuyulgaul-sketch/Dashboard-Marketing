const PHOTO_MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  bmp: 'image/bmp',
  heic: 'image/heic',
  heif: 'image/heif',
};

const PHOTO_MIME_TYPES = new Set(Object.values(PHOTO_MIME_BY_EXTENSION));

/** Only render raster photos. Never turn arbitrary files or SVG into image previews. */
export const resolveHandoverPhotoMime = (
  mimeType: string | null | undefined,
  fileName: string
): string | null => {
  const mime = String(mimeType || '').split(';')[0].trim().toLowerCase();
  if (PHOTO_MIME_TYPES.has(mime)) return mime;
  if (mime && mime !== 'application/octet-stream' && mime !== 'image/*') return null;
  const extension = String(fileName || '').split('.').pop()?.toLowerCase() || '';
  return PHOTO_MIME_BY_EXTENSION[extension] || null;
};
