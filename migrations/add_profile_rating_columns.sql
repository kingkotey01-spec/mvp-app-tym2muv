-- ============================================================
-- MIGRATION: Add rating and review_count to profiles table
-- ============================================================

-- 1. Add missing columns with safe defaults
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;

-- 2. Sync from agents table where available
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'agents'
    ) THEN
        UPDATE public.profiles p
        SET rating = COALESCE(a.performance_rating, 0.00)
        FROM public.agents a
        WHERE p.id = a.id AND a.performance_rating IS NOT NULL;
    END IF;
END $$;
