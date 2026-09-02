function getPublicEnv(name) {
  const processEnv = (typeof process !== 'undefined' && process.env) ? process.env : {};
  if (processEnv[name] !== undefined && processEnv[name] !== '') return processEnv[name];

  const runtimeEnv = (typeof window !== 'undefined' && window.__ZENRIXA_ENV__) ? window.__ZENRIXA_ENV__ : {};
  if (runtimeEnv[name] !== undefined && runtimeEnv[name] !== '') return runtimeEnv[name];

  return '';
}

const STRIPE_PUBLISHABLE_KEY = getPublicEnv('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY');

if (!STRIPE_PUBLISHABLE_KEY) {
  console.warn('[stripe] NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not configured. Stripe checkout will be unavailable.');
}

function requireSupabaseClient() {
  if (!supabaseClient) {
    throw new Error('[stripe] Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local (see .env.example).');
  }
  return supabaseClient;
}

async function getAuthHeaders() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session?.access_token) {
    return null;
  }
  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json'
  };
}

async function invokeAuthenticated(functionName, body) {
  const headers = await getAuthHeaders();
  if (!headers) throw new Error('User not authenticated - please log in');

  const client = requireSupabaseClient();
  const { data, error, response } = await client.functions.invoke(functionName, {
    body,
    headers: { Authorization: headers.Authorization }
  });
  if (error) {
    let message = error.message;
    try {
      if (response) {
        const text = await response.clone().text();
        if (text) {
          try {
            const parsed = JSON.parse(text);
            if (parsed && typeof parsed.error === 'string' && parsed.error) message = parsed.error;
            else if (parsed && parsed.message) message = parsed.message;
          } catch {
            message = text;
          }
        }
      }
    } catch (_) {}
    console.error(`[${functionName}] invoke failed:`, error, message);
    throw new Error(message || 'Unknown error');
  }
  return data;
}

async function createCheckoutSession(planId, billing) {
  const user = await getCurrentUser();
  if (!user) throw new Error('User not authenticated');

  return invokeAuthenticated('create-checkout-session', {
    planId, billing, userId: user.id, email: user.email
  });
}

async function createPaymentIntent(planId, billing) {
  const user = await getCurrentUser();
  if (!user) throw new Error('User not authenticated');

  const data = await invokeAuthenticated('create-payment-intent', {
    planId, billing, userId: user.id, email: user.email
  });
  if (!data || typeof data.clientSecret !== 'string' || !data.clientSecret.includes('_secret_')) {
    throw new Error('create-payment-intent did not return a valid clientSecret');
  }
  return data;
}

async function createSubscription(planId, billing, paymentMethodId) {
  const user = await getCurrentUser();
  if (!user) throw new Error('User not authenticated');

  return invokeAuthenticated('create-subscription', {
    planId, billing, paymentMethodId, userId: user.id, email: user.email
  });
}

async function recordPurchase(stripeSessionId, planName, amount, currency, status) {
  const user = await getCurrentUser();
  if (!user) throw new Error('User not authenticated');

  const headers = await getAuthHeaders();
  if (!headers) throw new Error('User not authenticated - please log in');

  const client = requireSupabaseClient();
  const { data, error } = await client
    .from('purchases')
    .insert({
      user_id: user.id,
      stripe_session_id: stripeSessionId,
      plan_name: planName,
      amount: amount,
      currency: currency,
      status: status
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getPurchaseHistory() {
  const user = await getCurrentUser();
  if (!user) return [];

  const headers = await getAuthHeaders();
  if (!headers) throw new Error('User not authenticated - please log in');

  const client = requireSupabaseClient();
  const { data, error } = await client
    .from('purchases')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}