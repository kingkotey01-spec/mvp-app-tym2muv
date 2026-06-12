-- ============================================================
-- MIGRATION: Create cms_pages and blog_posts tables
-- ============================================================

-- 1. CMS Pages Table
CREATE TABLE IF NOT EXISTS public.cms_pages (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  published BOOLEAN DEFAULT true,
  meta_title TEXT,
  meta_description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS and setup policies
ALTER TABLE public.cms_pages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'cms_pages' AND policyname = 'Public can read published pages'
    ) THEN
        CREATE POLICY "Public can read published pages" ON public.cms_pages 
          FOR SELECT USING (published = true OR public.is_admin());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'cms_pages' AND policyname = 'Admins manage pages'
    ) THEN
        CREATE POLICY "Admins manage pages" ON public.cms_pages 
          FOR ALL USING (public.is_admin());
    END IF;
END
$$;

-- 2. Blog Posts Table
CREATE TABLE IF NOT EXISTS public.blog_posts (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT,
  content TEXT NOT NULL,
  published BOOLEAN DEFAULT true,
  cover_image TEXT,
  author_name TEXT DEFAULT 'tym2muv Team',
  category TEXT DEFAULT 'General',
  read_time TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS and setup policies
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'blog_posts' AND policyname = 'Public can read published posts'
    ) THEN
        CREATE POLICY "Public can read published posts" ON public.blog_posts 
          FOR SELECT USING (published = true OR public.is_admin());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'blog_posts' AND policyname = 'Admins manage posts'
    ) THEN
        CREATE POLICY "Admins manage posts" ON public.blog_posts 
          FOR ALL USING (public.is_admin());
    END IF;
END
$$;
