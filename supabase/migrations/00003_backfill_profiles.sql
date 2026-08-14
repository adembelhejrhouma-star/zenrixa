-- Backfill profiles for existing auth users who signed up before the trigger was created
INSERT INTO public.profiles (id, email, role)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'role', 'user') AS role
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL;
