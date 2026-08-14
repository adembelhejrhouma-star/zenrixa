import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const prices: Record<string, Record<string, string>> = {
  basic: { on_6_months: 'price_1TzId4HmemY3mbrYBi6aZ7Ol' },
  standard: { on_6_months: 'price_1TzId7HmemY3mbrY4XpYaoVq' },
  pro: { on_6_months: 'price_1TzIdAHmemY3mbrYtgdCFWG6' },
}

const BILLING_CYCLE_MAP: Record<string, string> = {
  on_6_months: 'on_6_months',
  six: 'on_6_months',
  forever: 'forever',
}

function normalizeBillingCycle(billingCycle?: string): string {
  if (billingCycle && BILLING_CYCLE_MAP[billingCycle]) return BILLING_CYCLE_MAP[billingCycle]
  return 'on_6_months'
}

async function resolveUser(req: Request): Promise<{ id: string; email?: string }> {
  const authHeader = req.headers.get('Authorization')
  if (authHeader) {
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data, error } = await anonClient.auth.getUser()
    if (!error && data.user) {
      return { id: data.user.id, email: data.user.email ?? undefined }
    }
  }

  throw new Error('Unauthorized')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { planId, billing, paymentMethodId } = await req.json()

    const user = await resolveUser(req)

    const planNames: Record<string, string> = { basic: 'Basic', standard: 'Standard', pro: 'Pro' }
    const planName = planNames[planId]
    if (!planName) throw new Error('Invalid plan')

    const priceId = prices[planId]?.[billing]
    if (!priceId) throw new Error('Invalid billing')

    let customers = await stripe.customers.list({ email: user.email, limit: 1 })
    let customer = customers.data[0]
    if (!customer) {
      customer = await stripe.customers.create({ email: user.email, metadata: { userId: user.id } })
    }

    await stripe.paymentMethods.attach(paymentMethodId, { customer: customer.id })

    const cancelAt = billing === 'on_6_months'
      ? Math.floor(Date.now() / 1000) + 6 * 30 * 24 * 60 * 60
      : undefined

    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      default_payment_method: paymentMethodId,
      metadata: { userId: user.id, planId, billing, planName },
      ...(cancelAt ? { cancel_at: cancelAt } : {}),
    })

    const unitAmount = subscription.items?.data?.[0]?.price?.unit_amount ?? 0
    const { error: dbError } = await supabase.from('purchases').insert({
      user_id: user.id,
      stripe_session_id: subscription.id,
      plan_name: planName,
      billing_cycle: normalizeBillingCycle(billing),
      amount: Math.round(unitAmount / 100),
      currency: 'usd',
      status: 'active',
    })
    if (dbError) console.error('Failed to record subscription:', dbError)

    return new Response(
      JSON.stringify({ subscriptionId: subscription.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (err) {
    console.error('[create-subscription] error:', err)
    const message = (err && (err.message || err.toString())) || 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
