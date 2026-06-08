-- ============================================================
-- Supabase Storage Buckets & RLS Policies
-- Run this in the Supabase SQL Editor (or as a migration)
-- ============================================================

-- 1. Create storage buckets (idempotent)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('listings', 'listings', true, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('avatars', 'avatars', true, 2097152, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- 2. listings bucket policies

-- Allow authenticated users to upload to their own folder only
CREATE POLICY "listings_insert_own_folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'listings' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to update/replace their own objects
CREATE POLICY "listings_update_own"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'listings' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to delete their own objects
CREATE POLICY "listings_delete_own"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'listings' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to view storage object records of own folders ONLY (removes broad public listing security warnings)
CREATE POLICY "listings_select_own"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'listings' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. avatars bucket policies

CREATE POLICY "avatars_insert_own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "avatars_update_own"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "avatars_delete_own"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to view storage object records of own folders ONLY (removes broad public listing security warnings)
CREATE POLICY "avatars_select_own"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);
