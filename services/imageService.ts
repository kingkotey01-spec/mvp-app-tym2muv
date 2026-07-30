import { supabase } from '../supabaseClient';

const STORAGE_BUCKET = 'listings';

/**
 * Uploads an image to Supabase Storage.
 * Returns the public URL of the uploaded image.
 */
export async function uploadImageToSupabase(
  file: File,
  path: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Only JPEG, PNG, and WebP images are allowed.');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Image must be smaller than 5MB.');
  }

  onProgress?.(10);

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type,
    });

  if (error) throw error;

  onProgress?.(100);

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Uploads an avatar image to Supabase Storage (avatars bucket).
 */
export async function uploadAvatarToSupabase(
  file: File,
  path: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Only JPEG, PNG, and WebP images are allowed.');
  }
  if (file.size > 2 * 1024 * 1024) {
    throw new Error('Avatar must be smaller than 2MB.');
  }

  onProgress?.(10);

  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type,
    });

  if (error) throw error;

  onProgress?.(100);

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Returns a URL with optional width/height query params for basic resizing.
 * Supabase Storage supports width/height transform via the `transform` option.
 */
export function getSupabaseImageUrl(
  url: string | undefined | null,
  options: { width?: number; height?: number } = {}
): string {
  const fallback =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E";

  if (!url) return fallback;

  // Already an external URL (Unsplash, etc.) — return as-is
  if (!url.includes('supabase.co/storage')) return url;

  try {
    const urlObj = new URL(url);
    if (options.width) urlObj.searchParams.set('width', String(options.width));
    if (options.height) urlObj.searchParams.set('height', String(options.height));
    return urlObj.toString();
  } catch {
    return url;
  }
}

/**
 * Uploads a document (image or PDF) to Supabase Storage.
 * Returns the public URL of the uploaded document.
 */
export async function uploadDocumentToSupabase(
  file: File,
  path: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Only JPEG, PNG, WebP images, and PDF documents are allowed.');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('File must be smaller than 5MB.');
  }

  onProgress?.(10);

  const { error } = await supabase.storage
    .from('listings')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type,
    });

  if (error) throw error;

  onProgress?.(100);

  const { data } = supabase.storage.from('listings').getPublicUrl(path);
  return data.publicUrl;
}
