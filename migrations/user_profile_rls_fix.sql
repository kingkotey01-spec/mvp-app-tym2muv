-- RLS Policies and Trigger Fixes for Profiles and Agents
-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "Public can view valid profiles" ON public.profiles;
CREATE POLICY "Public can view valid profiles" ON public.profiles FOR SELECT USING (is_blocked = false OR public.is_admin());

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Agents Policies
DROP POLICY IF EXISTS "Public can view agents" ON public.agents;
CREATE POLICY "Public can view agents" ON public.agents FOR SELECT USING (true);

DROP POLICY IF EXISTS "Agents update own profile" ON public.agents;
CREATE POLICY "Agents update own profile" ON public.agents FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own agent profile" ON public.agents;
CREATE POLICY "Users can insert own agent profile" ON public.agents FOR INSERT WITH CHECK (auth.uid() = id);

-- Auth Trigger Function for New Users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, role)
  VALUES (
      NEW.id, 
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'email', 'Unknown'), 
      COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
      COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'user'::public.user_role)
  ) ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create Trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
