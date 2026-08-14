import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@13.10.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { planId, billing } = await req.json()

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) throw new Error('Unauthorized')

    const plans = {
      basic: { on_6_months: 2000, forever: 8000, name: 'Basic' },
      standard: { on_6_months: 4000, forever: 16000, name: 'Standard' },
      pro: { on_6_months: 10000, forever: 40000, name: 'Pro' },
    }

    const plan = plans[planId as keyof typeof plans]
    if (!plan) throw new Error('Invalid plan')

    const forever = billing === 'forever'
    const unitAmount = plan[billing as 'on_6_months' | 'forever'] ?? plan.on_6_months

    const lineItem: any = {
      price_data: {
        currency: 'usd',
        product_data: { name: `${plan.name} Plan` },
        unit_amount: unitAmount,
      },
      quantity: 1,
    }
    if (!forever) {
      lineItem.price_data.recurring = { interval: 'month', interval_count: 6 }
    }

    const sessionParams: any = {
      customer_email: user.email,
      payment_method_types: ['card'],
      line_items: [lineItem],
      mode: forever ? 'payment' : 'subscription',
      success_url: `${req.headers.get('origin') || 'http://localhost:5500'}/account.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get('origin') || 'http://localhost:5500'}/`,
      metadata: { userId: user.id, planId, billing, planName: plan.name },
    }

    const session = await stripe.checkout.sessions.create(sessionParams)

    return new Response(
      JSON.stringify({ sessionId: session.id, url: session.url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
