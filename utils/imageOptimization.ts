export interface ImageOptions {
  width?: number;
  height?: number;
  quality?: string | number;
  format?: 'auto' | 'webp' | 'jpeg' | 'png';
  crop?: string;
}

const FALLBACK_SVG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E";

/**
 * Returns an image URL, optionally with Supabase image transformation params
 * when the URL is from Supabase Storage. External URLs (Unsplash, ui-avatars, etc.)
 * are returned as-is. Falls back to a blank SVG for empty/null input.
 */
export function getOptimizedImageUrl(
  url: string | undefined | null,
  options: ImageOptions = {}
): string {
  if (!url) return FALLBACK_SVG;

  // For Supabase Storage public URLs, append transform query params
  if (url.includes('supabase.co/storage')) {
    try {
      const urlObj = new URL(url);
      if (options.width) urlObj.searchParams.set('width', String(options.width));
      if (options.height) urlObj.searchParams.set('height', String(options.height));
      return urlObj.toString();
    } catch {
      return url;
    }
  }

  // For all other URLs (Unsplash, ui-avatars, base64 data URIs, etc.) return as-is
  return url;
}
