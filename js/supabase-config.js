function getPublicEnv(name) {
  const processEnv = (typeof process !== 'undefined' && process.env) ? process.env : {};
  if (processEnv[name] !== undefined && processEnv[name] !== '') return processEnv[name];

  const runtimeEnv = (typeof window !== 'undefined' && window.__ZENRIXA_ENV__) ? window.__ZENRIXA_ENV__ : {};
  if (runtimeEnv[name] !== undefined && runtimeEnv[name] !== '') return runtimeEnv[name];

  return '';
}

const SUPABASE_URL = getPublicEnv('NEXT_PUBLIC_SUPABASE_URL');
const SUPABASE_ANON_KEY = getPublicEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

const { createClient } = supabase;
const supabaseClient = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

if (!supabaseClient) {
  console.error('[supabase-config] Supabase client is unavailable: NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY are missing. Supabase-backed features will not work.');
}
