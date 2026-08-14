// Supabase Configuration
function getPublicEnv(name) {
  const processEnv = (typeof process !== 'undefined' && process.env) ? process.env : {};
  if (processEnv[name] !== undefined && processEnv[name] !== '') return processEnv[name];

  const runtimeEnv = (typeof window !== 'undefined' && window.__ZENRIXA_ENV__) ? window.__ZENRIXA_ENV__ : {};
  if (runtimeEnv[name] !== undefined && runtimeEnv[name] !== '') return runtimeEnv[name];

  return '';
}

(function loadPublicEnv() {
  if (typeof window === 'undefined' || window.__ZENRIXA_ENV__) return;
  try {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/config', false);
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.send(null);
    if (xhr.status >= 200 && xhr.status < 300) {
      const data = JSON.parse(xhr.responseText || '{}');
      window.__ZENRIXA_ENV__ = data && typeof data === 'object' ? data : {};
      return;
    }
  } catch (_) {}
  window.__ZENRIXA_ENV__ = {};
  console.warn('Unable to load public config from /api/config.');
})();

const SUPABASE_URL = getPublicEnv('NEXT_PUBLIC_SUPABASE_URL');
const SUPABASE_ANON_KEY = getPublicEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

// Helper to clean up URL if it contains /rest/v1/ suffix
const getCleanSupabaseUrl = (url) => {
  return url.trim().replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
};

const cleanUrl = SUPABASE_URL ? getCleanSupabaseUrl(SUPABASE_URL) : '';

// Declare the initialized client as supabaseClient to avoid collision with the global 'supabase' library namespace
let supabaseClient = null;

if (typeof window !== 'undefined' && window.supabase && cleanUrl && SUPABASE_ANON_KEY) {
  // Create client using the global supabase object from the CDN script
  supabaseClient = window.supabase.createClient(cleanUrl, SUPABASE_ANON_KEY);
  console.log("Supabase Client initialized successfully.");
} else {
  console.error("Supabase client library (CDN) not loaded or configuration missing. Please make sure the CDN script is loaded and NEXT_PUBLIC_* vars are set in .env.local (see .env.example).");
}
