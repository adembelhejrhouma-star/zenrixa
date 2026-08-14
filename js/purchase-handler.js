const PLAN_PRICES = {
  basic: { name: 'Basic', on_6_months: 20, forever: 80 },
  standard: { name: 'Standard', on_6_months: 40, forever: 160 },
  pro: { name: 'Pro', on_6_months: 100, forever: 400 }
};

const BILLING_CYCLE_MAP = {
  on_6_months: 'on_6_months',
  six: 'on_6_months',
  forever: 'forever'
};

function normalizeBillingCycle(billingCycle) {
  if (billingCycle && BILLING_CYCLE_MAP[billingCycle]) return BILLING_CYCLE_MAP[billingCycle];
  return 'on_6_months';
}

function inferBillingCycle(planName, amount) {
  for (const planId in PLAN_PRICES) {
    const plan = PLAN_PRICES[planId];
    if (plan.name !== planName) continue;
    if (plan.forever === amount) return 'forever';
    return 'on_6_months';
  }
  return 'on_6_months';
}

async function ensureBrowserSession() {
  try {
    const res = await fetch('/api/auth/token', { credentials: 'same-origin' });
    const data = await res.json();
    if (res.ok && data.access_token && data.refresh_token) {
      const { error } = await supabaseClient.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token
      });
      if (!error) return true;
    }
  } catch (_) {}
  return false;
}

async function recordPurchase(userId, plan, billingCycle, amount) {
  if (!userId) throw new Error('User not authenticated');
  const sessionSet = await ensureBrowserSession();
  if (!sessionSet) throw new Error('Unable to establish authenticated session');
  const cycle = billingCycle ? normalizeBillingCycle(billingCycle) : inferBillingCycle(plan, amount);
  const base = {
    user_id: userId,
    plan_name: plan,
    billing_cycle: cycle,
    amount: amount,
    currency: 'usd',
    status: 'active'
  };
  let { data, error } = await supabaseClient
    .from('purchases')
    .insert(base)
    .select()
    .single();
  if (error && /billing_cycle/i.test(error.message)) {
    const { billing_cycle, ...withoutCycle } = base;
    const fallback = await supabaseClient
      .from('purchases')
      .insert(withoutCycle)
      .select()
      .single();
    data = fallback.data;
    error = fallback.error;
  }
  if (error) throw error;
  return data;
}

async function getUserPurchases(userId) {
  if (!userId) return [];
  const sessionSet = await ensureBrowserSession();
  if (!sessionSet) throw new Error('Unable to establish authenticated session');
  const { data, error } = await supabaseClient
    .from('purchases')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function recordSignupPurchase(userId) {
  if (!userId) throw new Error('User not authenticated');
  const planId = localStorage.getItem('pendingPlan');
  const requestedBilling = localStorage.getItem('pendingBilling') || 'on_6_months';
  const hasPendingPlan = !!planId && !!PLAN_PRICES[planId];
  if (!hasPendingPlan) return;
  const plan = PLAN_PRICES[planId];
  const billing = requestedBilling;
  const amount = plan[billing];
  if (amount == null) return;
  try {
    await recordPurchase(userId, plan.name, billing, amount);
    localStorage.removeItem('pendingPlan');
    localStorage.removeItem('pendingBilling');
  } catch (err) {
    console.error('Failed to record purchase:', err.message);
  }
}

async function sendEmail(email, subject, html) {
  if (!email || !subject || !html) throw new Error('Email, subject, and html are required');
  const baseUrl = (SUPABASE_URL || '').replace(/\/+$/, '');
  const res = await fetch(baseUrl + '/functions/v1/send-email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
    },
    body: JSON.stringify({ email, subject, html })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to send email');
  return data;
}
