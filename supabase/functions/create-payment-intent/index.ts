import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    const { planId, billing } = await req.json()

    const user = await resolveUser(req)

    const plans = {
      basic: { on_6_months: 2000, forever: 8000, name: 'Basic' },
      standard: { on_6_months: 4000, forever: 16000, name: 'Standard' },
      pro: { on_6_months: 10000, forever: 40000, name: 'Pro' },
    }

    const plan = plans[planId as keyof typeof plans]
    if (!plan) throw new Error('Invalid plan')

    const forever = billing === 'forever'
    const unitAmount = plan[billing as 'on_6_months' | 'forever'] ?? plan.on_6_months
    const metadata = { userId: user.id, planId, billing, planName: plan.name }

    if (forever) {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: unitAmount,
        currency: 'usd',
        payment_method_types: ['card'],
        metadata,
        setup_future_usage: 'on_session',
      })
      return new Response(
        JSON.stringify({ clientSecret: paymentIntent.client_secret, mode: 'payment' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    const setupIntent = await stripe.setupIntents.create({
      usage: 'off_session',
      payment_method_types: ['card'],
      metadata,
    })
    return new Response(
      JSON.stringify({ clientSecret: setupIntent.client_secret, mode: 'setup' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (err) {
    console.error('[create-payment-intent] error:', err)
    const message = (err && (err.message || err.toString())) || 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
