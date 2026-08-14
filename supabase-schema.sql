-- Create purchases table
CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_session_id TEXT,
  plan_name TEXT NOT NULL,
  billing_cycle TEXT NOT NULL DEFAULT 'on_6_months',
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- If the purchases table already exists without billing_cycle, add the column:
-- (Applied to the live project grukxcyaedfmzazeuehc via: supabase db query --linked
--  "ALTER TABLE purchases ADD COLUMN IF NOT EXISTS billing_cycle TEXT NOT NULL DEFAULT 'on_6_months';"
--  Verified: column now present with NOT NULL DEFAULT 'on_6_months'.)
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS billing_cycle TEXT NOT NULL DEFAULT 'on_6_months';

-- Purchases only support two billing cycles: on_6_months and forever.
ALTER TABLE purchases ADD CONSTRAINT purchases_billing_cycle_check
  CHECK (billing_cycle IN ('on_6_months', 'forever'));

-- Enable Row Level Security
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

-- Users can only see their own purchases
CREATE POLICY "Users can view own purchases"
  ON purchases FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own purchases
CREATE POLICY "Users can insert own purchases"
  ON purchases FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_purchases_user_id ON purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_stripe_session ON purchases(stripe_session_id);
