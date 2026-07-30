-- ==========================================
-- MIGRATION: 001_initial.sql
-- Description: Bootstraps the initial schema, enums, core tables, triggers, indexes, and RLS policies.
-- ==========================================

-- Enable essential extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 1. ENUMS
CREATE TYPE user_role AS ENUM ('tenant', 'agent', 'admin', 'super_admin');
CREATE TYPE property_lifecycle AS ENUM ('pending', 'approved', 'active', 'rejected', 'suspended', 'rented');
CREATE TYPE request_lifecycle AS ENUM ('pending', 'approved', 'active', 'completed', 'cancelled');
CREATE TYPE payment_lifecycle AS ENUM ('pending', 'paid', 'overdue');
CREATE TYPE report_status AS ENUM ('open', 'investigating', 'resolved', 'dismissed');

-- 2. CORE TABLES

CREATE TABLE profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    role user_role NOT NULL DEFAULT 'tenant',
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    phone_number TEXT,
    is_blocked BOOLEAN DEFAULT false,
    bio TEXT,
    agency_name TEXT,
    location TEXT,
    socials JSONB DEFAULT '{}',
    email TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE agents (
    id UUID REFERENCES profiles(id) ON DELETE CASCADE PRIMARY KEY,
    company_name TEXT,
    company_registration TEXT,
    verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
    performance_rating NUMERIC(3, 2) DEFAULT 0.00,
    total_listings INTEGER DEFAULT 0,
    bio TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE properties (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    agent_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    property_type TEXT NOT NULL,
    price NUMERIC(12, 2),
    currency TEXT DEFAULT 'USD',
    city TEXT,
    country TEXT,
    location_text TEXT DEFAULT 'Not specified',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE property_images (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE saved_properties (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    tenant_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, property_id)
);

CREATE TABLE rental_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    status request_lifecycle DEFAULT 'pending',
    proposed_move_in DATE,
    message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE rental_agreements (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    request_id UUID REFERENCES rental_requests(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE,
    agreed_price_per_month NUMERIC(10, 2) NOT NULL,
    status request_lifecycle DEFAULT 'active',
    contract_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE payment_plans (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    agreement_id UUID REFERENCES rental_agreements(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    amount_due NUMERIC(10, 2) NOT NULL,
    due_date DATE NOT NULL,
    status payment_lifecycle DEFAULT 'pending',
    paid_at TIMESTAMPTZ,
    transaction_ref TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE reports (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    reporter_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL CHECK (target_type IN ('property', 'user', 'message')),
    target_id UUID NOT NULL,
    reason TEXT NOT NULL,
    status report_status DEFAULT 'open',
    resolved_by UUID REFERENCES profiles(id),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE admin_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    admin_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL,
    target_entity TEXT NOT NULL,
    target_id UUID,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES profiles(id),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TRIGGERS
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_prof_modtime BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER update_agent_modtime BEFORE UPDATE ON agents FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER update_prop_modtime BEFORE UPDATE ON properties FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER update_req_modtime BEFORE UPDATE ON rental_requests FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER update_agr_modtime BEFORE UPDATE ON rental_agreements FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER update_pay_modtime BEFORE UPDATE ON payment_plans FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER update_sys_modtime BEFORE UPDATE ON system_settings FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role user_role;
BEGIN
  -- SECURITY: raw_user_meta_data is client-controlled. Only 'agent' is a legitimate
  -- self-service choice; everything else (including admin/super_admin requests)
  -- silently becomes 'tenant'. Admin elevation must happen out-of-band.
  v_role := CASE LOWER(NEW.raw_user_meta_data->>'role')
              WHEN 'agent' THEN 'agent'::user_role
              ELSE 'tenant'::user_role
            END;

  INSERT INTO public.profiles (id, full_name, avatar_url, role)
  VALUES (
      NEW.id, 
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'email', 'Unknown'), 
      COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
      v_role
  );
  IF v_role = 'agent'::user_role THEN
      INSERT INTO public.agents (id, company_name)
      VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'company_name', ''));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4. INDEXES
CREATE INDEX idx_props_agent ON properties (agent_id);
CREATE INDEX idx_props_status ON properties (status);
CREATE INDEX idx_props_price ON properties (price);
CREATE INDEX idx_props_city ON properties (city);
CREATE INDEX idx_images_prop ON property_images (property_id);
CREATE INDEX idx_reqs_tenant ON rental_requests (tenant_id);
CREATE INDEX idx_reqs_prop ON rental_requests (property_id);
CREATE INDEX idx_agreements_tenant ON rental_agreements (tenant_id);
CREATE INDEX idx_agreements_agent ON rental_agreements (agent_id);
CREATE INDEX idx_pays_tenant ON payment_plans (tenant_id);
CREATE INDEX idx_msgs_participants ON messages (sender_id, receiver_id);

-- 5. Row Level Security Globally
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION get_user_role() RETURNS user_role AS $$
    SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $$
    SELECT EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'));
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE POLICY "Public can view non-blocked profiles" ON profiles FOR SELECT USING (is_blocked = false OR is_admin());
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "users_insert_own_profile_safe_role" ON profiles;
DROP POLICY IF EXISTS "users_update_own_profile_safe_role" ON profiles;

CREATE POLICY "users_insert_own_profile_safe_role"
ON profiles FOR INSERT
WITH CHECK (auth.uid() = id AND role IN ('tenant', 'agent'));

CREATE POLICY "users_update_own_profile_safe_role"
ON profiles FOR UPDATE
USING (auth.uid() = id OR is_admin())
WITH CHECK (
  (auth.uid() = id AND role IN ('tenant', 'agent'))  -- self-service: tenant/agent only
  OR is_admin()                                      -- admins can set any role for anyone
);
CREATE POLICY "Public can view agents" ON agents FOR SELECT USING (true);
CREATE POLICY "Agents can update own profile" ON agents FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own agent profile" ON agents FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Public sees approved properties" ON properties FOR SELECT USING (status = 'approved' OR is_admin() OR auth.uid() = agent_id);
CREATE POLICY "Agents insert properties" ON properties FOR INSERT WITH CHECK (auth.uid() = agent_id AND get_user_role() = 'agent');
CREATE POLICY "Agents modify own properties" ON properties FOR UPDATE USING (auth.uid() = agent_id OR is_admin());
CREATE POLICY "Agents delete own properties" ON properties FOR DELETE USING (auth.uid() = agent_id OR is_admin());
CREATE POLICY "Public sees property images" ON property_images FOR SELECT USING (true);
CREATE POLICY "Agents manage images of own properties" ON property_images FOR ALL USING (
    EXISTS (SELECT 1 FROM properties WHERE id = property_images.property_id AND agent_id = auth.uid()) OR is_admin()
);
CREATE POLICY "Users see own saved props" ON saved_properties FOR ALL USING (auth.uid() = tenant_id);
CREATE POLICY "Tenants create requests" ON rental_requests FOR INSERT WITH CHECK (auth.uid() = tenant_id);
CREATE POLICY "Tenants and Agents view requests" ON rental_requests FOR SELECT USING (
    auth.uid() = tenant_id OR EXISTS (SELECT 1 FROM properties WHERE id = property_id AND agent_id = auth.uid()) OR is_admin()
);
CREATE POLICY "Agents update requests" ON rental_requests FOR UPDATE USING (
    EXISTS (SELECT 1 FROM properties WHERE id = property_id AND agent_id = auth.uid()) OR is_admin()
);
CREATE POLICY "Tenants and Agents view agreements" ON rental_agreements FOR SELECT USING (auth.uid() = tenant_id OR auth.uid() = agent_id OR is_admin());
CREATE POLICY "Tenants view own payments" ON payment_plans FOR SELECT USING (auth.uid() = tenant_id OR EXISTS (SELECT 1 FROM rental_agreements WHERE id = agreement_id AND agent_id = auth.uid()) OR is_admin());
CREATE POLICY "Users view participant messages" ON messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id OR is_admin());
CREATE POLICY "Users send messages" ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users mark messages as read" ON messages FOR UPDATE USING (auth.uid() = receiver_id);
CREATE POLICY "Users insert reports" ON reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Users see own reports" ON reports FOR SELECT USING (auth.uid() = reporter_id OR is_admin());
CREATE POLICY "Admins manage reports" ON reports FOR ALL USING (is_admin());
CREATE POLICY "Admins read logs" ON admin_logs FOR SELECT USING (is_admin());
CREATE POLICY "Admins insert logs" ON admin_logs FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admins read settings" ON system_settings FOR SELECT USING (is_admin());
CREATE POLICY "Admins write settings" ON system_settings FOR ALL USING (is_admin());
