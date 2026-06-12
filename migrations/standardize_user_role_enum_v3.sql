-- ============================================================
-- MIGRATION: Standardize user_role ENUM to ('tenant', 'agent', 'admin', 'super_admin') (V3 with Cascade dropping)
-- ============================================================

-- 1. Drop dependent policies and views to release locks on public.profiles.role / user_role type
DROP VIEW IF EXISTS public.admin_dashboard_metrics CASCADE;
DROP POLICY IF EXISTS "Agents insert properties" ON public.properties;

-- 2. Drop dependent function get_user_role() since it returns the user_role type
DROP FUNCTION IF EXISTS public.get_user_role() CASCADE;

-- 3. Drop existing defaults on profiles.role to prevent type conflicts
ALTER TABLE public.profiles ALTER COLUMN role DROP DEFAULT;

-- 4. Rename old type so we don't collide
ALTER TYPE public.user_role RENAME TO user_role_old;

-- 5. Create standardized ENUM type
CREATE TYPE public.user_role AS ENUM ('tenant', 'agent', 'admin', 'super_admin');

-- 6. Cast existing values in public.profiles to text, map/translate them to standard lowercase strings, & cast to the new ENUM
ALTER TABLE public.profiles 
  ALTER COLUMN role TYPE public.user_role 
  USING (
    CASE 
      WHEN role::text IN ('Admin', 'admin', 'super_admin') THEN 'admin'::public.user_role
      WHEN role::text IN ('Agent', 'agent', 'vendor') THEN 'agent'::public.user_role
      ELSE 'tenant'::public.user_role
    END
  );

-- 7. Restore the default value for public.profiles.role
ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'tenant'::public.user_role;

-- 8. Clean up old enum type
DROP TYPE public.user_role_old;

-- 9. Recreate dropped security helper function get_user_role() returning the new standardized user_role
CREATE OR REPLACE FUNCTION public.get_user_role() RETURNS public.user_role AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Set search path to solve linting issues as outlined in database_linter_fixes.sql
ALTER FUNCTION public.get_user_role() SET search_path = public, pg_temp;

-- 10. Recreate dropped security policy on public.properties
CREATE POLICY "Agents insert properties" ON public.properties 
  FOR INSERT WITH CHECK (auth.uid() = agent_id AND public.get_user_role() = 'agent'::public.user_role);

-- 11. Recreate the admin_dashboard_metrics view safely
CREATE OR REPLACE VIEW public.admin_dashboard_metrics WITH (security_invoker = true) AS
SELECT
    (SELECT COUNT(*) FROM public.profiles WHERE role::text IN ('tenant', 'user')) AS total_users,
    (SELECT COUNT(*) FROM public.profiles WHERE role::text = 'agent') AS total_agents,
    (SELECT COUNT(*) FROM public.properties) AS total_properties,
    (SELECT COUNT(*) FROM public.rental_requests) AS total_rental_requests,
    (SELECT COUNT(*) FROM public.reports WHERE status = 'open') AS open_reports;
