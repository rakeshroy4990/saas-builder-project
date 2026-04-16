const DEFAULT_CLOUDINARY_IMAGE_BASE_URL = 'https://res.cloudinary.com/dbke33vfd/image/upload';
const DEFAULT_CLOUDINARY_FALLBACK_PUBLIC_ID = 'v1776158879/sea_xgqlrq.jpg';

const CLOUDINARY_IMAGE_BASE_URL = String(
  import.meta.env.VITE_CLOUDINARY_IMAGE_BASE_URL ?? DEFAULT_CLOUDINARY_IMAGE_BASE_URL
).replace(/\/+$/, '');
const CLOUDINARY_FALLBACK_PUBLIC_ID = String(
  import.meta.env.VITE_CLOUDINARY_FALLBACK_PUBLIC_ID ?? DEFAULT_CLOUDINARY_FALLBACK_PUBLIC_ID
).replace(/^\/+/, '');

function fallbackCloudinaryImage(): string {
  return `${CLOUDINARY_IMAGE_BASE_URL}/${CLOUDINARY_FALLBACK_PUBLIC_ID}`;
}

/**
 * Resolves image source to a Cloudinary delivery URL.
 * - Absolute URLs are allowed only for Cloudinary delivery hosts.
 * - Relative/public IDs are prefixed with configured Cloudinary base URL.
 */
export function resolveImageSource(src?: string): string {
  if (!src) return fallbackCloudinaryImage();
  if (/^https?:\/\//i.test(src)) {
    try {
      const host = new URL(src).host.toLowerCase();
      if (host.endsWith('res.cloudinary.com')) return src;
      console.warn('Blocked non-Cloudinary image URL', src);
      return fallbackCloudinaryImage();
    } catch {
      return fallbackCloudinaryImage();
    }
  }
  return `${CLOUDINARY_IMAGE_BASE_URL}/${src.replace(/^\/+/, '')}`;
}

