import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

// Service-role client: bypasses RLS so we can insert purchases on behalf of users
// from a server-side, unauthenticated webhook request.
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
);

const endpointSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';

type PurchaseRecord = {
  stripeId: string;
  userId?: string;
  planName: string;
  amount: number;
  currency: string;
  status: string;
  billingCycle?: string;
};

const BILLING_CYCLE_MAP: Record<string, string> = {
  on_6_months: 'on_6_months',
  six: 'on_6_months',
  forever: 'forever',
};

function normalizeBillingCycle(billingCycle?: string): string {
  if (billingCycle && BILLING_CYCLE_MAP[billingCycle]) return BILLING_CYCLE_MAP[billingCycle];
  return 'on_6_months';
}

async function recordPurchase(record: PurchaseRecord): Promise<void> {
  const { stripeId, userId, planName, amount, currency, status, billingCycle } = record;

  if (!userId) {
    console.error('[stripe-webhook] no user_id in metadata; cannot record purchase', {
      stripeId,
      planName,
    });
    return;
  }

  // Idempotency: if a purchase with the same Stripe id already exists, skip the
  // insert so Stripe retries don't create duplicate rows.
  const { data: existing, error: checkErr } = await supabase
    .from('purchases')
    .select('id')
    .eq('stripe_session_id', stripeId)
    .maybeSingle();

  if (checkErr) {
    console.error('[stripe-webhook] idempotency check failed:', checkErr);
  } else if (existing) {
    console.log('[stripe-webhook] purchase already recorded, skipping:', stripeId);
    return;
  }

  const { error } = await supabase.from('purchases').insert({
    user_id: userId,
    stripe_session_id: stripeId,
    plan_name: planName,
    billing_cycle: normalizeBillingCycle(billingCycle),
    amount,
    currency,
    status,
  });

  if (error) {
    console.error('[stripe-webhook] failed to record purchase:', error, {
      stripeId,
      userId,
      planName,
    });
  } else {
    console.log('[stripe-webhook] purchase recorded:', stripeId);
  }
}

serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return new Response('Missing stripe-signature', { status: 400 });
  }

  let event: Stripe.Event;
  try {
    // Read the raw request body first. Never JSON.parse before verification,
    // because constructEvent needs the exact bytes to check the signature.
    const body = await req.text();
    event = await stripe.webhooks.constructEventAsync(body, signature, endpointSecret);
  } catch (err) {
    // Signature verification failed -> this is a config problem or a spoofed
    // request. Return 400 so it is visible and Stripe stops retrying.
    console.error('[stripe-webhook] signature verification failed:', err);
    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // One-time purchases made through Stripe Checkout (create-checkout-session)
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId || session.client_reference_id || undefined;
      const planName = session.metadata?.planName || 'Unknown';

      await recordPurchase({
        stripeId: session.id,
        userId,
        planName,
        amount: session.amount_total ? Math.round(session.amount_total / 100) : 0,
        currency: session.currency || 'usd',
        status: 'active',
        billingCycle: session.metadata?.billing,
      });
    }

    // One-time purchases made through the in-page card form (create-payment-intent)
    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object as Stripe.PaymentIntent;
      // PIs created by our create-payment-intent function carry userId/planName
      // metadata. PIs created by Checkout do NOT inherit the session metadata,
      // so they are naturally skipped here (already handled above).
      if (pi.metadata?.userId) {
        await recordPurchase({
          stripeId: pi.id,
          userId: pi.metadata.userId,
          planName: pi.metadata.planName || 'Unknown',
          amount: pi.amount ? Math.round(pi.amount / 100) : 0,
          currency: pi.currency || 'usd',
          status: 'active',
          billingCycle: pi.metadata.billing,
        });
      }
    }
  } catch (err) {
    // Non-verification processing error. We still return 200 below so Stripe
    // doesn't retry forever; the console.error logs give us visibility.
    console.error('[stripe-webhook] processing error:', err);
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
