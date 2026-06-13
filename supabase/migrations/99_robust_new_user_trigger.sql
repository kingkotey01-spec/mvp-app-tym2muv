-- Robust override for handle_new_user to avoid cast errors on type user_role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role user_role;
BEGIN
  -- Safe conversion from string to user_role enum
  v_role := CASE LOWER(NEW.raw_user_meta_data->>'role')
              WHEN 'agent' THEN 'agent'::user_role
              WHEN 'admin' THEN 'admin'::user_role
              WHEN 'super_admin' THEN 'super_admin'::user_role
              ELSE 'tenant'::user_role
            END;

  INSERT INTO public.profiles (id, full_name, avatar_url, role, email)
  VALUES (
      NEW.id, 
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'email', 'Unknown'), 
      COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
      v_role,
      COALESCE(NEW.email, NEW.raw_user_meta_data->>'email')
  );

  -- If role is agent, insert into agents table
  IF v_role = 'agent'::user_role THEN
      INSERT INTO public.agents (id, company_name)
      VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'company_name', ''));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-allow execution of the trigger function to prevent GoTrue signUp failures under restricted session privileges
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO PUBLIC, anon, authenticated;
