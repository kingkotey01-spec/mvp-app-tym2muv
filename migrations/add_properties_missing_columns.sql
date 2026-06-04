-- Migration to add missing columns to the properties table for frontend compatibility
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS price NUMERIC(12, 2),
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS country_code TEXT,
ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}'::TEXT[],
ADD COLUMN IF NOT EXISTS videos TEXT[] DEFAULT '{}'::TEXT[],
ADD COLUMN IF NOT EXISTS category_id TEXT,
ADD COLUMN IF NOT EXISTS subcategory_id TEXT,
ADD COLUMN IF NOT EXISTS listing_type TEXT,
ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS expiry_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS pets_allowed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS year_built INTEGER,
ADD COLUMN IF NOT EXISTS sqft INTEGER,
ADD COLUMN IF NOT EXISTS furnished BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS parking BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS security BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS virtual_tour_url TEXT;

-- For backward compatibility with any queries, let's sync data from legacy columns to new columns if needed,
-- or make sure existing columns are mapped gracefully.
UPDATE public.properties 
SET 
  price = COALESCE(price, price_per_month),
  location = COALESCE(location, location_text),
  country_code = COALESCE(country_code, country)
WHERE price IS NULL OR location IS NULL OR country_code IS NULL;

-- Let's also build indexes for the newly introduced columns for high performance queries
CREATE INDEX IF NOT EXISTS idx_properties_price_new ON public.properties (price);
CREATE INDEX IF NOT EXISTS idx_properties_location_new ON public.properties (location);
CREATE INDEX IF NOT EXISTS idx_properties_country_code_new ON public.properties (country_code);
CREATE INDEX IF NOT EXISTS idx_properties_category_id_new ON public.properties (category_id);
