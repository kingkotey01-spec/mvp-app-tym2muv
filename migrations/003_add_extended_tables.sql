-- ==========================================
-- MIGRATION: 003_add_extended_tables.sql
-- Description: Brings in extended system features: real-time Chats, View Requests, reviews, cms pages, blog posts, payment attempts, and rent financing applications.
-- ==========================================

-- 1. Chats
CREATE TABLE IF NOT EXISTS public.chats (
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

ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see their own chats" ON public.chats FOR SELECT USING (auth.uid() = ANY(participants));
CREATE POLICY "Users create chats they are part of" ON public.chats FOR INSERT WITH CHECK (auth.uid() = ANY(participants));
CREATE POLICY "Users update chats they are part of" ON public.chats FOR UPDATE USING (auth.uid() = ANY(participants));
CREATE POLICY "Users delete chats they are part of" ON public.chats FOR DELETE USING (auth.uid() = ANY(participants));

CREATE INDEX IF NOT EXISTS idx_chats_participants ON public.chats USING GIN (participants);

-- 2. View Requests (Bookings)
CREATE TABLE IF NOT EXISTS public.view_requests (
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

ALTER TABLE public.view_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenants see own view requests" ON public.view_requests FOR SELECT USING (auth.uid() = tenant_id OR auth.uid() = agent_id OR public.is_admin());
CREATE POLICY "Tenants create view requests" ON public.view_requests FOR INSERT WITH CHECK (auth.uid() = tenant_id);
CREATE POLICY "Agents update view request status" ON public.view_requests FOR UPDATE USING (auth.uid() = agent_id OR public.is_admin());

CREATE INDEX IF NOT EXISTS idx_view_requests_tenant ON public.view_requests (tenant_id);
CREATE INDEX IF NOT EXISTS idx_view_requests_agent ON public.view_requests (agent_id);

-- 3. Reviews
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  vendor_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  rating NUMERIC(2,1) NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vendor_id, customer_id)
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view reviews" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Customers create their own reviews" ON public.reviews FOR INSERT WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "Customers update their own reviews" ON public.reviews FOR UPDATE USING (auth.uid() = customer_id);

CREATE INDEX IF NOT EXISTS idx_reviews_vendor ON public.reviews (vendor_id);

-- 4. Payment Attempts (Idempotency Tracking)
CREATE TABLE IF NOT EXISTS payment_attempts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    idempotency_key VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    listing_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    reference_id VARCHAR(255),
    response JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE payment_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own payment attempts" ON payment_attempts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own payment attempts" ON payment_attempts FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_payment_attempts_ik ON payment_attempts(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_ref ON payment_attempts(reference_id);

-- 5. CMS Pages
CREATE TABLE IF NOT EXISTS public.cms_pages (
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

ALTER TABLE public.cms_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read published pages" ON public.cms_pages FOR SELECT USING (published = true OR public.is_admin());
CREATE POLICY "Admins manage pages" ON public.cms_pages FOR ALL USING (public.is_admin());

-- 6. Blog Posts
CREATE TABLE IF NOT EXISTS public.blog_posts (
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

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read published posts" ON public.blog_posts FOR SELECT USING (published = true OR public.is_admin());
CREATE POLICY "Admins manage posts" ON public.blog_posts FOR ALL USING (public.is_admin());

-- 7. Rent Financing Applications
CREATE TABLE IF NOT EXISTS public.rent_financing_applications (
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

ALTER TABLE public.rent_financing_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own applications" ON public.rent_financing_applications FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "Users create own applications" ON public.rent_financing_applications FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Admins manage applications" ON public.rent_financing_applications FOR ALL USING (public.is_admin());
