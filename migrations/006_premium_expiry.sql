-- Add premium upgraded timestamp to properties table
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS premium_upgraded_at TIMESTAMPTZ;

-- If a listing is already premium but has no timestamp, set it to now to initialize
UPDATE public.properties 
SET premium_upgraded_at = NOW() 
WHERE is_premium = true AND premium_upgraded_at IS NULL;
