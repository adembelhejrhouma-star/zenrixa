-- ============================================================
-- 00007_fix_schema.sql
-- Align the live schema with what the app actually queries.
--
-- The app references these tables:
--   user_profiles  -> auth/session flow, profile sync (exists on live)
--   purchases      -> purchase records (exists, working)
--   profiles       -> dashboard: user list / role management   [was MISSING]
--   auth_logs      -> signup/login/logout audit trail          [was MISSING]
--
-- This migration:
--   1. Adds a `role` column to user_profiles (RBAC)
--   2. Creates the auth_logs table (with RLS)
--   3. Creates `profiles` as an updatable VIEW over user_profiles
--      (single source of truth; the dashboard keeps working unchanged)
--   4. Restores the RBAC helpers (get_user_role / is_provider)
--   5. Adds provider RLS policies on user_profiles + purchases
--   6. Grants API-role access (this project does not auto-expose new objects)
--   7. Backfills roles and any missing profile rows
--
-- NOTE: assumes the live schema where user_profiles is the real table.
-- ============================================================

-- ---------- 1. user_profiles.role (RBAC) ----------
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_role_check;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('user', 'provider'));

-- ---------- 2. RBAC helper functions ----------
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(auth.jwt() ->> 'user_role', ''),
    (SELECT role FROM public.user_profiles WHERE id = auth.uid()),
    'user'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_provider()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_user_role() = 'provider'
$$;

-- ---------- 3. auth_logs table ----------
CREATE TABLE IF NOT EXISTS public.auth_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (event_type IN ('signup', 'login', 'logout', 'google_auth')),
  email TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.auth_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert auth_logs" ON public.auth_logs;
CREATE POLICY "Anyone can insert auth_logs"
  ON public.auth_logs FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "auth_logs_select_provider_only" ON public.auth_logs;
CREATE POLICY "auth_logs_select_provider_only"
  ON public.auth_logs FOR SELECT
  USING (public.is_provider());

DROP POLICY IF EXISTS "auth_logs_delete_provider_only" ON public.auth_logs;
CREATE POLICY "auth_logs_delete_provider_only"
  ON public.auth_logs FOR DELETE
  USING (public.is_provider());

-- ---------- 4. profiles: updatable VIEW over user_profiles ----------
-- (safe to drop: on the live project `profiles` does not exist yet, and if a
--  previous attempt left a view behind this removes it)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'profiles' AND n.nspname = 'public' AND c.relkind = 'v'
  ) THEN
    DROP VIEW public.profiles;
  END IF;
END
$$;

CREATE VIEW public.profiles AS
  SELECT id, email, full_name, avatar_url, role, plan, created_at, updated_at
  FROM public.user_profiles;

-- ---------- 5. Provider policies on user_profiles ----------
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
CREATE POLICY "Users can view own profile"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = id OR public.is_provider());

DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
CREATE POLICY "Users can insert own profile"
  ON public.user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id OR public.is_provider());

DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Users can update own profile"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = id OR public.is_provider())
  WITH CHECK (auth.uid() = id OR public.is_provider());

-- Role changes are restricted by trigger instead of a WITH CHECK that
-- references NEW/OLD (the Supabase Management API rejects NEW/OLD as bare
-- SQL tokens, so keep them inside the function body).
CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND NOT public.is_provider()
     AND COALESCE(auth.role(), 'anon') <> 'service_role'
  THEN
    RAISE EXCEPTION 'Only providers can change role';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS prevent_role_escalation ON public.user_profiles;
CREATE TRIGGER prevent_role_escalation
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_role_escalation();

DROP POLICY IF EXISTS "profiles_delete_provider_only" ON public.user_profiles;
CREATE POLICY "profiles_delete_provider_only"
  ON public.user_profiles FOR DELETE
  USING (public.is_provider());

-- ---------- 6. Provider policy on purchases (dashboard list) ----------
DROP POLICY IF EXISTS "Providers can view all purchases" ON public.purchases;
CREATE POLICY "Providers can view all purchases"
  ON public.purchases FOR SELECT
  USING (public.is_provider());

-- ---------- 7. Grants (project does not auto-expose new objects) ----------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_profiles TO authenticated;
GRANT SELECT ON public.user_profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auth_logs TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.auth_logs_id_seq TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO anon, authenticated;

-- ---------- 8. Backfill ----------
UPDATE public.user_profiles
SET role = 'user'
WHERE role IS NULL OR role NOT IN ('user', 'provider');

INSERT INTO public.user_profiles (id, email, plan, role)
SELECT
  au.id,
  au.email,
  'free',
  COALESCE(au.raw_user_meta_data->>'role', 'user')
FROM auth.users au
LEFT JOIN public.user_profiles p ON p.id = au.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;