-- Ensure all tables exist with correct schemas to pass RLS compliance audit
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    status VARCHAR(50) DEFAULT 'pending',
    purpose VARCHAR(50) DEFAULT 'listing_fee',
    reference_id VARCHAR(255),
    gateway VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    plan VARCHAR(50) DEFAULT 'free',
    status VARCHAR(50) DEFAULT 'active',
    current_period_start TIMESTAMPTZ DEFAULT NOW(),
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Re-assert Row Level Security on all core and requested tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Dynamic cleanup of conflicting old policies to avoid "already exists" errors
DROP POLICY IF EXISTS "users_can_view_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "public_view_non_blocked_profiles" ON public.profiles;
DROP POLICY IF EXISTS "users_insert_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON public.profiles;

DROP POLICY IF EXISTS "public_sees_approved_properties" ON public.properties;
DROP POLICY IF EXISTS "agents_insert_properties" ON public.properties;
DROP POLICY IF EXISTS "agents_modify_own_properties" ON public.properties;
DROP POLICY IF EXISTS "agents_delete_own_properties" ON public.properties;

DROP POLICY IF EXISTS "users_can_view_own_payments" ON public.payments;
DROP POLICY IF EXISTS "users_can_insert_own_payments" ON public.payments;

DROP POLICY IF EXISTS "users_can_view_own_subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "users_can_insert_own_subscriptions" ON public.subscriptions;

DROP POLICY IF EXISTS "users_view_participant_messages" ON public.messages;
DROP POLICY IF EXISTS "users_send_messages" ON public.messages;

DROP POLICY IF EXISTS "users_view_own_notifications" ON public.notifications;
DROP POLICY IF EXISTS "users_edit_own_notifications" ON public.notifications;


-- Define standard and high-security Row Level Security Policies

-- 1. Profiles Policies
CREATE POLICY "users_can_view_own_profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = id OR is_blocked = false OR is_admin());

CREATE POLICY "users_insert_own_profile" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = id);

CREATE POLICY "users_update_own_profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id);

-- 2. Properties Policies
CREATE POLICY "public_sees_approved_properties" 
ON public.properties FOR SELECT 
USING (status = 'approved' OR is_admin() OR auth.uid() = agent_id);

CREATE POLICY "agents_insert_properties" 
ON public.properties FOR INSERT 
WITH CHECK (auth.uid() = agent_id);

CREATE POLICY "agents_modify_own_properties" 
ON public.properties FOR UPDATE 
USING (auth.uid() = agent_id OR is_admin());

CREATE POLICY "agents_delete_own_properties" 
ON public.properties FOR DELETE 
USING (auth.uid() = agent_id OR is_admin());

-- 3. Payments Policies
CREATE POLICY "users_can_view_own_payments" 
ON public.payments FOR SELECT 
USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "users_can_insert_own_payments" 
ON public.payments FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- 4. Subscriptions Policies
CREATE POLICY "users_can_view_own_subscriptions" 
ON public.subscriptions FOR SELECT 
USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "users_can_insert_own_subscriptions" 
ON public.subscriptions FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- 5. Messages Policies
CREATE POLICY "users_view_participant_messages" 
ON public.messages FOR SELECT 
USING (auth.uid() = sender_id OR auth.uid() = receiver_id OR is_admin());

CREATE POLICY "users_send_messages" 
ON public.messages FOR INSERT 
WITH CHECK (auth.uid() = sender_id);

-- 6. Notifications Policies
CREATE POLICY "users_view_own_notifications" 
ON public.notifications FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "users_edit_own_notifications" 
ON public.notifications FOR ALL 
USING (auth.uid() = user_id);
