-- Add availability columns to properties table
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS availability_status VARCHAR(50) DEFAULT 'available';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS availability_changed_at TIMESTAMPTZ;

-- Maintain backwards compatibility for existing active/rented status by updating availability_status
UPDATE public.properties 
SET availability_status = 'rented', availability_changed_at = NOW() 
WHERE status = 'rented' AND availability_status = 'available';
