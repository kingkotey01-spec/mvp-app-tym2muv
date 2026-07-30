-- Ensure all tables exist with correct schemas to pass RLS compliance audit
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    status VARCHAR(50) DEFAULT 'pending',
    purpose VARCHAR(50) DEFAULT 'listing_fee',
    reference_id VARCHAR(255) UNIQUE,
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

CREATE TABLE IF NOT EXISTS public.chats (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    participants UUID[] NOT NULL,
    listing_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
    last_message TEXT DEFAULT '',
    last_message_time TIMESTAMPTZ DEFAULT NOW(),
    unread_count INT DEFAULT 0,
    last_sender_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS chat_id UUID REFERENCES public.chats(id) ON DELETE CASCADE;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS ai_fraud_score INT DEFAULT 0;

-- Re-assert Row Level Security on all core and requested tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

-- Dynamic cleanup of conflicting old policies across all schema/migration files to avoid any permissive policy overlap
DROP POLICY IF EXISTS "users_can_view_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "public_view_non_blocked_profiles" ON public.profiles;
DROP POLICY IF EXISTS "users_insert_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "Public can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can edit profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public can view non-blocked profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public can view valid profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "users_insert_own_profile_safe_role" ON public.profiles;
DROP POLICY IF EXISTS "users_update_own_profile_safe_role" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;

DROP POLICY IF EXISTS "public_sees_approved_properties" ON public.properties;
DROP POLICY IF EXISTS "agents_insert_properties" ON public.properties;
DROP POLICY IF EXISTS "agents_modify_own_properties" ON public.properties;
DROP POLICY IF EXISTS "agents_delete_own_properties" ON public.properties;
DROP POLICY IF EXISTS "Public sees approved properties" ON public.properties;
DROP POLICY IF EXISTS "Public approved properties" ON public.properties;
DROP POLICY IF EXISTS "Agents insert properties" ON public.properties;
DROP POLICY IF EXISTS "Agents modify own properties" ON public.properties;
DROP POLICY IF EXISTS "Agents edit properties" ON public.properties;
DROP POLICY IF EXISTS "Agents delete own properties" ON public.properties;
DROP POLICY IF EXISTS "Agents delete properties" ON public.properties;

DROP POLICY IF EXISTS "users_can_view_own_payments" ON public.payments;
DROP POLICY IF EXISTS "users_can_insert_own_payments" ON public.payments;
DROP POLICY IF EXISTS "Tenants view own payments" ON public.payments;

DROP POLICY IF EXISTS "users_can_view_own_subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "users_can_insert_own_subscriptions" ON public.subscriptions;

DROP POLICY IF EXISTS "users_view_participant_messages" ON public.messages;
DROP POLICY IF EXISTS "users_send_messages" ON public.messages;
DROP POLICY IF EXISTS "Users view participant messages" ON public.messages;
DROP POLICY IF EXISTS "Users view their messages" ON public.messages;
DROP POLICY IF EXISTS "Users send messages" ON public.messages;
DROP POLICY IF EXISTS "Users mark messages as read" ON public.messages;
DROP POLICY IF EXISTS "Users mark messages read" ON public.messages;
DROP POLICY IF EXISTS "users_delete_messages" ON public.messages;

DROP POLICY IF EXISTS "users_view_own_chats" ON public.chats;
DROP POLICY IF EXISTS "users_insert_own_chats" ON public.chats;
DROP POLICY IF EXISTS "users_update_own_chats" ON public.chats;
DROP POLICY IF EXISTS "users_delete_own_chats" ON public.chats;

DROP POLICY IF EXISTS "users_view_own_notifications" ON public.notifications;
DROP POLICY IF EXISTS "users_edit_own_notifications" ON public.notifications;


-- Define standard and high-security Row Level Security Policies

-- 1. Profiles Policies
CREATE POLICY "users_can_view_own_profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = id OR is_blocked = false OR is_admin());

CREATE POLICY "users_insert_own_profile" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = id AND role IN ('tenant', 'agent'));

CREATE POLICY "users_update_own_profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id OR is_admin())
WITH CHECK (
  (auth.uid() = id AND role IN ('tenant', 'agent'))  -- self-service: tenant/agent only
  OR is_admin()                                      -- admins can set any role for anyone
);

-- 2. Properties Policies
CREATE POLICY "public_sees_approved_properties" 
ON public.properties FOR SELECT 
USING (status = 'approved' OR is_admin() OR auth.uid() = agent_id);

CREATE POLICY "agents_insert_properties" 
ON public.properties FOR INSERT 
WITH CHECK (
  auth.uid() = agent_id AND 
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('agent', 'admin', 'super_admin')
);

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

-- 5. Chats & Messages Policies
CREATE POLICY "users_view_own_chats" 
ON public.chats FOR SELECT 
USING (auth.uid() = ANY(participants) OR is_admin());

CREATE POLICY "users_insert_own_chats" 
ON public.chats FOR INSERT 
WITH CHECK (auth.uid() = ANY(participants) OR is_admin());

CREATE POLICY "users_update_own_chats" 
ON public.chats FOR UPDATE 
USING (auth.uid() = ANY(participants) OR is_admin());

CREATE POLICY "users_delete_own_chats" 
ON public.chats FOR DELETE 
USING (auth.uid() = ANY(participants) OR is_admin());

-- Refined Messages RLS Policies
CREATE POLICY "users_view_participant_messages" 
ON public.messages FOR SELECT 
USING (
  auth.uid() = sender_id 
  OR auth.uid() = receiver_id 
  OR is_admin() 
  OR (chat_id IS NOT NULL AND auth.uid() = ANY(SELECT participants FROM public.chats WHERE id = chat_id))
);

CREATE POLICY "users_send_messages" 
ON public.messages FOR INSERT 
WITH CHECK (
  auth.uid() = sender_id 
  AND (chat_id IS NULL OR auth.uid() = ANY(SELECT participants FROM public.chats WHERE id = chat_id))
);

CREATE POLICY "users_delete_messages" 
ON public.messages FOR DELETE 
USING (
  auth.uid() = sender_id 
  OR is_admin() 
  OR (chat_id IS NOT NULL AND auth.uid() = ANY(SELECT participants FROM public.chats WHERE id = chat_id))
);

-- 6. Notifications Policies
CREATE POLICY "users_view_own_notifications" 
ON public.notifications FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "users_edit_own_notifications" 
ON public.notifications FOR ALL 
USING (auth.uid() = user_id);

-- Redesigned Secure admin action logger supporting both auth.uid() and edge functions (service_role + p_admin_id)
CREATE OR REPLACE FUNCTION public.log_admin_action(
    p_action_type TEXT,
    p_target_table TEXT,
    p_target_id UUID,
    p_description TEXT,
    p_metadata JSONB DEFAULT '{}'::jsonb,
    p_admin_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_admin_id UUID;
BEGIN
    v_admin_id := COALESCE(p_admin_id, auth.uid());

    IF v_admin_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: No agent authenticated.';
    ELSIF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Only admins can perform logging of admin actions.';
    ELSIF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_admin_id AND role::text IN ('admin', 'super_admin')) THEN
        RAISE EXCEPTION 'Unauthorized: Provided ID is not an admin.';
    END IF;

    INSERT INTO public.admin_logs (
        admin_id,
        action_type,
        target_table,
        target_id,
        description,
        metadata
    ) VALUES (
        v_admin_id,
        p_action_type,
        p_target_table,
        p_target_id,
        p_description,
        p_metadata
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Fix P0/P1 pay-to-promote bypass: Restrict insertion/updates of is_premium and premium_upgraded_at
REVOKE INSERT (is_premium, premium_upgraded_at), UPDATE (is_premium, premium_upgraded_at) 
ON public.properties 
FROM authenticated, anon, PUBLIC;

-- Re-grant full privileges to service_role to ensure backend processes can still promote listings
GRANT ALL (is_premium, premium_upgraded_at) ON public.properties TO service_role;

-- Fix self-reviews bypass: enforce check constraint where vendor_id != customer_id
ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_no_self_review;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_no_self_review CHECK (vendor_id <> customer_id);


