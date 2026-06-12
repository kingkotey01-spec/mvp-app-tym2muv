-- ============================================================
-- MIGRATION: Add missing tables
-- ============================================================

-- 1. CHATS (Real-time messaging threads)
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

-- Check if policy exists before creating
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'chats' AND policyname = 'Users see their own chats'
    ) THEN
        CREATE POLICY "Users see their own chats" ON public.chats
          FOR SELECT USING (auth.uid() = ANY(participants));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'chats' AND policyname = 'Users create chats they are part of'
    ) THEN
        CREATE POLICY "Users create chats they are part of" ON public.chats
          FOR INSERT WITH CHECK (auth.uid() = ANY(participants));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'chats' AND policyname = 'Users update chats they are part of'
    ) THEN
        CREATE POLICY "Users update chats they are part of" ON public.chats
          FOR UPDATE USING (auth.uid() = ANY(participants));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'chats' AND policyname = 'Users delete chats they are part of'
    ) THEN
        CREATE POLICY "Users delete chats they are part of" ON public.chats
          FOR DELETE USING (auth.uid() = ANY(participants));
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_chats_participants ON public.chats USING GIN (participants);

-- 2. VIEW REQUESTS (Book a property viewing)
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'view_requests' AND policyname = 'Tenants see own view requests'
    ) THEN
        CREATE POLICY "Tenants see own view requests" ON public.view_requests
          FOR SELECT USING (auth.uid() = tenant_id OR auth.uid() = agent_id OR public.is_admin());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'view_requests' AND policyname = 'Tenants create view requests'
    ) THEN
        CREATE POLICY "Tenants create view requests" ON public.view_requests
          FOR INSERT WITH CHECK (auth.uid() = tenant_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'view_requests' AND policyname = 'Agents update view request status'
    ) THEN
        CREATE POLICY "Agents update view request status" ON public.view_requests
          FOR UPDATE USING (auth.uid() = agent_id OR public.is_admin());
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_view_requests_tenant ON public.view_requests (tenant_id);
CREATE INDEX IF NOT EXISTS idx_view_requests_agent ON public.view_requests (agent_id);

-- 3. REVIEWS (Agent / vendor ratings)
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'reviews' AND policyname = 'Anyone can view reviews'
    ) THEN
        CREATE POLICY "Anyone can view reviews" ON public.reviews FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'reviews' AND policyname = 'Customers create their own reviews'
    ) THEN
        CREATE POLICY "Customers create their own reviews" ON public.reviews
          FOR INSERT WITH CHECK (auth.uid() = customer_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'reviews' AND policyname = 'Customers update their own reviews'
    ) THEN
        CREATE POLICY "Customers update their own reviews" ON public.reviews
          FOR UPDATE USING (auth.uid() = customer_id);
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_reviews_vendor ON public.reviews (vendor_id);

-- 4. RENT FINANCING APPLICATIONS
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'rent_financing_applications' AND policyname = 'Users view own applications'
    ) THEN
        CREATE POLICY "Users view own applications" ON public.rent_financing_applications
          FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'rent_financing_applications' AND policyname = 'Users create own applications'
    ) THEN
        CREATE POLICY "Users create own applications" ON public.rent_financing_applications
          FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'rent_financing_applications' AND policyname = 'Admins manage applications'
    ) THEN
        CREATE POLICY "Admins manage applications" ON public.rent_financing_applications
          FOR ALL USING (public.is_admin());
    END IF;
END
$$;
