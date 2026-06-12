-- ============================================================
-- MIGRATION: Fix location_text and price_per_month constraints
-- ============================================================

-- Sync location_text from location to prevent NOT NULL violations on insert
UPDATE public.properties
SET location_text = COALESCE(location_text, location, 'Not specified')
WHERE location_text IS NULL;

-- Make location_text use a default going forward
ALTER TABLE public.properties
ALTER COLUMN location_text SET DEFAULT 'Not specified';

-- Sync price_per_month from price to prevent NOT NULL violations
UPDATE public.properties
SET price_per_month = COALESCE(price_per_month, price, 0.00)
WHERE price_per_month IS NULL;

-- Standardize NOT NULL constraints on properties table to prevent frontend insertions from failing
ALTER TABLE public.properties ALTER COLUMN price_per_month DROP NOT NULL;
ALTER TABLE public.properties ALTER COLUMN city DROP NOT NULL;
ALTER TABLE public.properties ALTER COLUMN country DROP NOT NULL;
ALTER TABLE public.properties ALTER COLUMN location_text DROP NOT NULL;
