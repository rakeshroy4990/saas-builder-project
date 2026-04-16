const DEFAULT_CLOUDINARY_IMAGE_BASE_URL = 'https://res.cloudinary.com/dbke33vfd/image/upload';

const CLOUDINARY_IMAGE_BASE_URL = String(
  import.meta.env.VITE_CLOUDINARY_IMAGE_BASE_URL ?? DEFAULT_CLOUDINARY_IMAGE_BASE_URL
).replace(/\/+$/, '');

/**
 * Resolves image source to a Cloudinary delivery URL.
 * - Absolute URLs are returned as-is.
 * - Relative/public IDs are prefixed with configured Cloudinary base URL.
 */
export function resolveImageSource(src?: string): string {
  if (!src) return '';
  if (/^https?:\/\//i.test(src)) return src;
  return `${CLOUDINARY_IMAGE_BASE_URL}/${src.replace(/^\/+/, '')}`;
}

