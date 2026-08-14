-- ============================================
-- RBAC: Role-Based Access Control
-- ============================================

-- --------------------------------------------------
-- 1. Helper functions for role checks
-- --------------------------------------------------

-- Returns the current user's role from JWT claim (fast) or fallback to DB
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(auth.jwt() ->> 'user_role', ''),
    (SELECT role FROM public.profiles WHERE id = auth.uid()),
    'user'
  )
$$;

-- Quick check if current user is a provider
CREATE OR REPLACE FUNCTION public.is_provider()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT public.get_user_role() = 'provider'
$$;

-- Generic role check
CREATE OR REPLACE FUNCTION public.user_has_role(required_role TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT public.get_user_role() = required_role
$$;

-- --------------------------------------------------
-- 2. Sync role to JWT custom claim
-- --------------------------------------------------

CREATE OR REPLACE FUNCTION public.sync_role_to_jwt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Set the user_role claim in auth.users
  -- This makes auth.jwt() ->> 'user_role' available immediately
  PERFORM auth.set_claim(
    NEW.id,
    'user_role',
    to_jsonb(NEW.role)
  );
  RETURN NEW;
END;
$$;

-- Trigger: set JWT claim when profile is created or role changes
DROP TRIGGER IF EXISTS sync_role_jwt_on_insert ON public.profiles;
CREATE TRIGGER sync_role_jwt_on_insert
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_role_to_jwt();

DROP TRIGGER IF EXISTS sync_role_jwt_on_update ON public.profiles;
CREATE TRIGGER sync_role_jwt_on_update
  AFTER UPDATE OF role ON public.profiles
  FOR EACH ROW
  WHEN (OLD.role IS DISTINCT FROM NEW.role)
  EXECUTE FUNCTION public.sync_role_to_jwt();

-- --------------------------------------------------
-- 3. Auto-update updated_at on profiles
-- --------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- --------------------------------------------------
-- 4. Recreate RLS policies for all tables
-- --------------------------------------------------

-- ============ PROFILES ============
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Only providers can insert profiles" ON public.profiles;

CREATE POLICY "profiles_select_public"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "profiles_insert_own_or_provider"
  ON public.profiles FOR INSERT
  WITH CHECK (
    auth.uid() = id OR
    public.is_provider()
  );

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND
    -- Only providers can escalate their own role
    (NEW.role = OLD.role OR public.is_provider())
  );

CREATE POLICY "profiles_delete_provider_only"
  ON public.profiles FOR DELETE
  USING (public.is_provider());

-- ============ SUBSCRIBERS ============
ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert subscribers" ON public.subscribers;
DROP POLICY IF EXISTS "Only authenticated can view subscribers" ON public.subscribers;

CREATE POLICY "subscribers_insert_public"
  ON public.subscribers FOR INSERT
  WITH CHECK (true);

CREATE POLICY "subscribers_select_provider_only"
  ON public.subscribers FOR SELECT
  USING (public.is_provider());

CREATE POLICY "subscribers_update_provider_only"
  ON public.subscribers FOR UPDATE
  USING (public.is_provider());

CREATE POLICY "subscribers_delete_provider_only"
  ON public.subscribers FOR DELETE
  USING (public.is_provider());

-- ============ PURCHASES ============
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own purchases" ON public.purchases;
DROP POLICY IF EXISTS "Authenticated users can insert purchases" ON public.purchases;
DROP POLICY IF EXISTS "Providers can view all purchases" ON public.purchases;

CREATE POLICY "purchases_insert_own"
  ON public.purchases FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "purchases_select_own_or_provider"
  ON public.purchases FOR SELECT
  USING (
    auth.uid() = user_id OR
    public.is_provider()
  );

CREATE POLICY "purchases_update_provider_only"
  ON public.purchases FOR UPDATE
  USING (public.is_provider());

CREATE POLICY "purchases_delete_provider_only"
  ON public.purchases FOR DELETE
  USING (public.is_provider());

-- ============ AUTH LOGS ============
ALTER TABLE public.auth_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert auth_logs" ON public.auth_logs;
DROP POLICY IF EXISTS "Providers can view auth_logs" ON public.auth_logs;

CREATE POLICY "auth_logs_insert_public"
  ON public.auth_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "auth_logs_select_provider_only"
  ON public.auth_logs FOR SELECT
  USING (public.is_provider());

CREATE POLICY "auth_logs_delete_provider_only"
  ON public.auth_logs FOR DELETE
  USING (public.is_provider());

-- --------------------------------------------------
-- 5. Backfill JWT claims for existing users
-- --------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id, role FROM public.profiles
  LOOP
    PERFORM auth.set_claim(r.id, 'user_role', to_jsonb(r.role));
  END LOOP;
END;
$$;
