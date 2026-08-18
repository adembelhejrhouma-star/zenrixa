-- ============================================================
-- 00008_only_two_tables.sql
-- The app now stores profile data (role / plan) in auth user
-- metadata instead of dedicated tables. The database keeps only
-- two tables: `purchases` and `auth_logs`.
--
-- This migration:
--   1. Redefines is_provider() to read role from the JWT
--      (user_metadata claim) instead of user_profiles
--   2. Drops the now-unused RBAC helpers / triggers
--   3. Drops the `profiles` view and the `user_profiles` table
-- ============================================================

-- ---------- 1. is_provider() reads role from JWT user_metadata ----------
CREATE OR REPLACE FUNCTION public.is_provider()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', 'user') = 'provider'
$$;

-- ---------- 2. Drop now-unused objects ----------
DROP FUNCTION IF EXISTS public.get_user_role();

DROP TRIGGER IF EXISTS prevent_role_escalation ON public.user_profiles;
DROP FUNCTION IF EXISTS public.prevent_role_escalation();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- ---------- 3. Drop the profile tables ----------
DROP VIEW IF EXISTS public.profiles;
DROP TABLE IF EXISTS public.user_profiles CASCADE;