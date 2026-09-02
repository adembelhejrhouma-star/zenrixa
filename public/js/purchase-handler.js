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

async function recordPurchase(userId, plan, billingCycle, amount) {
  if (!userId) throw new Error('User not authenticated');
  const headers = await getAuthHeaders();
  if (!headers) throw new Error('User not authenticated - please log in');

  const cycle = billingCycle ? normalizeBillingCycle(billingCycle) : inferBillingCycle(plan, amount);
  const base = {
    user_id: userId,
    plan_name: plan,
    billing_cycle: cycle,
    amount: amount,
    currency: 'usd',
    status: 'active'
  };

  const res = await fetch('/api/purchases', {
    method: 'POST',
    headers,
    body: JSON.stringify(base)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to record purchase' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

async function getUserPurchases(userId) {
  if (!userId) return [];
  if (!supabaseClient) throw new Error('Supabase client not initialized');

  const { data: purchases, error } = await supabaseClient
    .from('purchases')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return purchases || [];
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
  const headers = await getAuthHeaders();
  if (!headers) throw new Error('User not authenticated - please log in');

  const baseUrl = (SUPABASE_URL || '').replace(/\/+$/, '');
  const res = await fetch(baseUrl + '/functions/v1/send-email', {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, subject, html })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to send email');
  return data;
}