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

CREATE POLICY "Anyone can insert auth_logs"
  ON public.auth_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Providers can view auth_logs"
  ON public.auth_logs FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'provider')
  );
