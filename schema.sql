-- ============================================================
-- TYM2MUV PRODUCTION REFERENCE DATABASE SCHEMA (CANONICAL)
-- Target: Supabase PostgreSQL
-- ============================================================

-- Enable essential extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 1. ENUMS (Lifecycle States & Roles)
CREATE TYPE user_role AS ENUM ('tenant', 'agent', 'admin', 'super_admin');
CREATE TYPE property_lifecycle AS ENUM ('pending', 'approved', 'active', 'rejected', 'suspended', 'rented');
CREATE TYPE request_lifecycle AS ENUM ('pending', 'approved', 'active', 'completed', 'cancelled');
CREATE TYPE payment_lifecycle AS ENUM ('pending', 'paid', 'overdue');
CREATE TYPE report_status AS ENUM ('open', 'investigating', 'resolved', 'dismissed');

-- 2. TABLES

-- Profiles (Extends auth.users, applies to ALL users)
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
    rating NUMERIC(3,2) DEFAULT 0.00,
    review_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agents (Detailed profile for agents)
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

-- Properties
CREATE TABLE properties (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    agent_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    property_type TEXT NOT NULL, -- e.g., Apartment, House, Studio
    price NUMERIC(12, 2),
    currency TEXT DEFAULT 'USD',
    city TEXT,
    country TEXT,
    location TEXT,
    location_text TEXT DEFAULT 'Not specified',
    country_code TEXT,
    images TEXT[] DEFAULT '{}'::TEXT[],
    videos TEXT[] DEFAULT '{}'::TEXT[],
    category_id TEXT,
    subcategory_id TEXT,
    listing_type TEXT,
    is_premium BOOLEAN DEFAULT false,
    is_verified BOOLEAN DEFAULT false,
    is_featured BOOLEAN DEFAULT false,
    expiry_date TIMESTAMPTZ,
    pets_allowed BOOLEAN DEFAULT false,
    year_built INTEGER,
    sqft INTEGER,
    furnished BOOLEAN DEFAULT false,
    parking BOOLEAN DEFAULT false,
    security BOOLEAN DEFAULT false,
    virtual_tour_url TEXT,
    floor_plan_url TEXT,
    bedrooms INTEGER DEFAULT 0,
    bathrooms INTEGER DEFAULT 0,
    status property_lifecycle DEFAULT 'pending',
    amenities JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Property Images
CREATE TABLE property_images (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Saved Properties (Favorites)
CREATE TABLE saved_properties (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    tenant_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, property_id)
);

-- Rental Requests
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

-- Rental Agreements (Active Contracts)
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

-- Payment Plans (Monthly Rent Tracking)
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

-- Messages
CREATE TABLE messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chats (Real-time messaging threads)
CREATE TABLE chats (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  participants UUID[] NOT NULL,
  listing_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  last_message TEXT DEFAULT '',
  last_message_time TIMESTAMPTZ DEFAULT NOW(),
  unread_count INTEGER DEFAULT 0,
  lead_source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- View Requests (Book a property viewing)
CREATE TABLE view_requests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  listing_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  requested_date TIMESTAMPTZ,
  requested_time TEXT,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reviews (Agent ratings)
CREATE TABLE reviews (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  vendor_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  rating NUMERIC(2,1) NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vendor_id, customer_id)
);

-- Payment Attempts (Paystack Idempotency Tracking)
CREATE TABLE payment_attempts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    idempotency_key VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    listing_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, succeeded, failed
    reference_id VARCHAR(255),
    response JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CMS Pages (Static Pages)
CREATE TABLE cms_pages (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  published BOOLEAN DEFAULT true,
  meta_title TEXT,
  meta_description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Blog Posts (News and updates)
CREATE TABLE blog_posts (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT,
  content TEXT NOT NULL,
  published BOOLEAN DEFAULT true,
  cover_image TEXT,
  author_name TEXT DEFAULT 'tym2muv Team',
  category TEXT DEFAULT 'General',
  read_time TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rent Financing Applications
CREATE TABLE rent_financing_applications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  employment_status TEXT NOT NULL,
  monthly_income NUMERIC(12,2) NOT NULL,
  id_type TEXT NOT NULL,
  id_number TEXT NOT NULL,
  monthly_rent NUMERIC(12,2) NOT NULL,
  landlord_name TEXT NOT NULL,
  landlord_phone TEXT NOT NULL,
  move_in_date DATE NOT NULL,
  lease_duration INTEGER NOT NULL,
  street_address TEXT NOT NULL,
  city TEXT NOT NULL,
  state_region TEXT NOT NULL,
  country TEXT NOT NULL,
  postal_code TEXT,
  amount_required NUMERIC(12,2) NOT NULL,
  repayment_duration INTEGER NOT NULL CHECK (repayment_duration <= 36),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'under_review')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications (NEW cloud-persisted user notifications table!)
CREATE TABLE notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  text TEXT NOT NULL,
  link TEXT,
  read BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Reports (Abuse/Fraud)
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

-- Admin Logs (Audit Trail)
CREATE TABLE admin_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    admin_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL,
    target_entity TEXT NOT NULL,
    target_id UUID,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- System Settings
CREATE TABLE system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES profiles(id),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security Globally
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE view_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cms_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE rent_financing_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Security Helper Functions
CREATE OR REPLACE FUNCTION get_user_role() RETURNS user_role AS $$
    SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $$
    SELECT EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'));
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 2.1 PROFILES & AGENTS POLICIES
CREATE POLICY "Public can view profiles" ON profiles FOR SELECT USING (is_blocked = false OR is_admin());
CREATE POLICY "Users can edit profiles" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users insert profiles" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Public view agents" ON agents FOR SELECT USING (true);
CREATE POLICY "Agents edit agents" ON agents FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Agents insert agents" ON agents FOR INSERT WITH CHECK (auth.uid() = id);

-- 2.2 PROPERTIES & IMAGES POLICIES
CREATE POLICY "Public approved properties" ON properties FOR SELECT USING (status = 'approved' OR is_admin() OR auth.uid() = agent_id);
CREATE POLICY "Agents insert properties" ON properties FOR INSERT WITH CHECK (auth.uid() = agent_id AND get_user_role() = 'agent');
CREATE POLICY "Agents edit properties" ON properties FOR UPDATE USING (auth.uid() = agent_id OR is_admin());
CREATE POLICY "Agents delete properties" ON properties FOR DELETE USING (auth.uid() = agent_id OR is_admin());
CREATE POLICY "Public sees images" ON property_images FOR SELECT USING (true);
CREATE POLICY "Agents manage images" ON property_images FOR ALL USING (
    EXISTS (SELECT 1 FROM properties WHERE id = property_images.property_id AND agent_id = auth.uid()) OR is_admin()
);

-- 2.3 RENTALS, FAVORITES & PAYMENTS POLICIES
CREATE POLICY "Users managed saved fields" ON saved_properties FOR ALL USING (auth.uid() = tenant_id);
CREATE POLICY "Tenants post requests" ON rental_requests FOR INSERT WITH CHECK (auth.uid() = tenant_id);
CREATE POLICY "Tenants and Agents view requests" ON rental_requests FOR SELECT USING (
    auth.uid() = tenant_id OR EXISTS (SELECT 1 FROM properties WHERE id = property_id AND agent_id = auth.uid()) OR is_admin()
);
CREATE POLICY "Agents edit requests" ON rental_requests FOR UPDATE USING (
    EXISTS (SELECT 1 FROM properties WHERE id = property_id AND agent_id = auth.uid()) OR is_admin()
);
CREATE POLICY "Tenants and Agents view agreements" ON rental_agreements FOR SELECT USING (auth.uid() = tenant_id OR auth.uid() = agent_id OR is_admin());
CREATE POLICY "Tenants view payment_plans" ON payment_plans FOR SELECT USING (auth.uid() = tenant_id OR EXISTS (SELECT 1 FROM rental_agreements WHERE id = agreement_id AND agent_id = auth.uid()) OR is_admin());

-- 2.4 MESSAGING & CHATS POLICIES
CREATE POLICY "Users view messages" ON messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id OR is_admin());
CREATE POLICY "Users post messages" ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users read messages" ON messages FOR UPDATE USING (auth.uid() = receiver_id);
CREATE POLICY "Users view own chats" ON public.chats FOR SELECT USING (auth.uid() = ANY(participants));
CREATE POLICY "Users create chats" ON public.chats FOR INSERT WITH CHECK (auth.uid() = ANY(participants));
CREATE POLICY "Users update own chats" ON public.chats FOR UPDATE USING (auth.uid() = ANY(participants));
CREATE POLICY "Users delete own chats" ON public.chats FOR DELETE USING (auth.uid() = ANY(participants));

-- 2.5 VIEW REQUESTS, REVIEWS & ATTEMPTS POLICIES
CREATE POLICY "Tenants view view_requests" ON public.view_requests FOR SELECT USING (auth.uid() = tenant_id OR auth.uid() = agent_id OR public.is_admin());
CREATE POLICY "Tenants post view_requests" ON public.view_requests FOR INSERT WITH CHECK (auth.uid() = tenant_id);
CREATE POLICY "Agents update view_requests" ON public.view_requests FOR UPDATE USING (auth.uid() = agent_id OR public.is_admin());
CREATE POLICY "Anyone view reviews" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Customer post reviews" ON public.reviews FOR INSERT WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "Customer edit reviews" ON public.reviews FOR UPDATE USING (auth.uid() = customer_id);
CREATE POLICY "Users view own payment attempts" ON payment_attempts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users post own payment attempts" ON payment_attempts FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 2.6 CMS PAGES & BLOG POSTS POLICIES
CREATE POLICY "Public read cms_pages" ON public.cms_pages FOR SELECT USING (published = true OR public.is_admin());
CREATE POLICY "Admins manage cms_pages" ON public.cms_pages FOR ALL USING (public.is_admin());
CREATE POLICY "Public read blog_posts" ON public.blog_posts FOR SELECT USING (published = true OR public.is_admin());
CREATE POLICY "Admins manage blog_posts" ON public.blog_posts FOR ALL USING (public.is_admin());

-- 2.7 RENT FINANCING APPLICATIONS & NOTIFICATIONS POLICIES
CREATE POLICY "Users view financing applications" ON public.rent_financing_applications FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "Users submit financing applications" ON public.rent_financing_applications FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Admins manage financing applications" ON public.rent_financing_applications FOR ALL USING (public.is_admin());
CREATE POLICY "Users view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users edit own notifications" ON public.notifications FOR ALL USING (auth.uid() = user_id);

-- 2.8 REPORTS, ADMIN LOGS, SYSTEM SETTINGS POLICIES
CREATE POLICY "Users post reports" ON reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Users view reports" ON reports FOR SELECT USING (auth.uid() = reporter_id OR is_admin());
CREATE POLICY "Admins edit reports" ON reports FOR ALL USING (is_admin());
CREATE POLICY "Admins read admin_logs" ON admin_logs FOR SELECT USING (is_admin());
CREATE POLICY "Admins insert admin_logs" ON admin_logs FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admins read system_settings" ON system_settings FOR SELECT USING (is_admin());
CREATE POLICY "Admins edit system_settings" ON system_settings FOR ALL USING (is_admin());

-- 3. TRIGGERS (Auto Updated_At)
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

-- Auto-insert into profiles when auth.users is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, role)
  VALUES (
      NEW.id, 
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'email', 'Unknown'), 
      COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
      COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'tenant')
  );
  -- If role is agent, insert into agents table
  IF NEW.raw_user_meta_data->>'role' = 'agent' THEN
      INSERT INTO public.agents (id, company_name)
      VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'company_name', ''));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ONLY RUN ONCE IF NOT EXISTS
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4. PERFORMANCE OPTIMIZATION (INDEXES)
CREATE INDEX IF NOT EXISTS idx_props_agent ON properties (agent_id);
CREATE INDEX IF NOT EXISTS idx_props_status ON properties (status);
CREATE INDEX IF NOT EXISTS idx_props_price ON properties (price);
CREATE INDEX IF NOT EXISTS idx_props_city ON properties (city);
CREATE INDEX IF NOT EXISTS idx_props_type ON properties (property_type);
CREATE INDEX IF NOT EXISTS idx_props_search ON properties USING GIN (
  (title || ' ' || COALESCE(city, '') || ' ' || COALESCE(location_text, '')) gin_trgm_ops
);
CREATE INDEX IF NOT EXISTS idx_images_prop ON property_images (property_id);
CREATE INDEX IF NOT EXISTS idx_reqs_tenant ON rental_requests (tenant_id);
CREATE INDEX IF NOT EXISTS idx_reqs_prop ON rental_requests (property_id);
CREATE INDEX IF NOT EXISTS idx_agreements_tenant ON rental_agreements (tenant_id);
CREATE INDEX IF NOT EXISTS idx_agreements_agent ON rental_agreements (agent_id);
CREATE INDEX IF NOT EXISTS idx_pays_tenant ON payment_plans (tenant_id);
CREATE INDEX IF NOT EXISTS idx_msgs_participants ON messages (sender_id, receiver_id);
CREATE INDEX IF NOT EXISTS idx_chats_participants ON public.chats USING GIN (participants);
CREATE INDEX IF NOT EXISTS idx_view_requests_tenant ON public.view_requests (tenant_id);
CREATE INDEX IF NOT EXISTS idx_view_requests_agent ON public.view_requests (agent_id);
CREATE INDEX IF NOT EXISTS idx_reviews_vendor ON public.reviews (vendor_id);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_ik ON payment_attempts(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_ref ON payment_attempts(reference_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications (user_id);
