-- Migration for payment idempotency table

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

-- Index for quick lookups by idempotency key and reference ID
CREATE INDEX idx_payment_attempts_ik ON payment_attempts(idempotency_key);
CREATE INDEX idx_payment_attempts_ref ON payment_attempts(reference_id);

-- Apply RLS so users can only access their own payment attempts
ALTER TABLE payment_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payment attempts" ON payment_attempts
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own payment attempts" ON payment_attempts
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Note: Edge Functions utilize the service_role secret key which inherently
-- bypasses Row Level Security. Therefore, no permissive "always true" check is needed.
