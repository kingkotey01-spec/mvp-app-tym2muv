-- ==========================================
-- MIGRATION: 002_add_missing_columns.sql
-- Description: Adds advanced metadata fields (rating, review_count, bedrooms, bathrooms, and missing property details) for frontend compatibility.
-- ==========================================

-- 1. Profiles rating additions
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;

-- 2. Properties advanced columns additions
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS status property_lifecycle DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS country_code TEXT,
ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}'::TEXT[],
ADD COLUMN IF NOT EXISTS videos TEXT[] DEFAULT '{}'::TEXT[],
ADD COLUMN IF NOT EXISTS category_id TEXT,
ADD COLUMN IF NOT EXISTS subcategory_id TEXT,
ADD COLUMN IF NOT EXISTS listing_type TEXT,
ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS expiry_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS pets_allowed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS year_built INTEGER,
ADD COLUMN IF NOT EXISTS sqft INTEGER,
ADD COLUMN IF NOT EXISTS furnished BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS parking BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS security BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS virtual_tour_url TEXT,
ADD COLUMN IF NOT EXISTS floor_plan_url TEXT,
ADD COLUMN IF NOT EXISTS bedrooms INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS bathrooms INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS amenities JSONB DEFAULT '[]'::jsonb;

-- 3. Optimization Indexes For Advanced Columns
CREATE INDEX IF NOT EXISTS idx_properties_price_new ON public.properties (price);
CREATE INDEX IF NOT EXISTS idx_properties_location_new ON public.properties (location);
CREATE INDEX IF NOT EXISTS idx_properties_country_code_new ON public.properties (country_code);
CREATE INDEX IF NOT EXISTS idx_properties_category_id_new ON public.properties (category_id);
CREATE INDEX IF NOT EXISTS idx_properties_type_new ON public.properties (property_type);

CREATE INDEX IF NOT EXISTS idx_props_search ON properties USING GIN (
  (title || ' ' || COALESCE(city, '') || ' ' || COALESCE(location_text, '')) gin_trgm_ops
);
