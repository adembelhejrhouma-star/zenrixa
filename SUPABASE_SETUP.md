# Supabase + Stripe - Setup Instructions

## 1. Create the purchases table

Go to your Supabase dashboard > SQL Editor and run the SQL in `supabase-schema.sql`

Or run via Supabase CLI:
```
supabase db execute --file supabase-schema.sql
```

## 2. Deploy Edge Functions (DONE 2026-07-31)

All four functions are deployed on `grukxcyaedfmzazeuehc` and verified end-to-end: the custom
card flow (`create-payment-intent` + `create-subscription`) was tested with real test cards —
a `forever` PaymentIntent confirmed and was recorded via webhook, and a `six` subscription was
created with `cancel_at` set and recorded.

```
supabase functions deploy create-checkout-session
supabase functions deploy stripe-webhook
supabase functions deploy create-payment-intent
supabase functions deploy create-subscription
```

Secrets (already set; `SUPABASE_*` vars are auto-managed by the platform, do NOT set them):
```
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set STRIPE_WEBHOOK_SECRET=<your-webhook-secret-here>
```

Notes for redeploys:
- JWT gateway config lives in `supabase/config.toml`. Functions called from the frontend with a
  user JWT (`create-checkout-session`, `create-payment-intent`, `create-subscription`,
  `send-email`) MUST have `verify_jwt = true`. Only `stripe-webhook` has `verify_jwt = false` —
  Stripe does not send a JWT, it signs with `STRIPE_WEBHOOK_SECRET`.
- `config.toml` uses the new CLI v2 format: root-level `project_id`, no `[project]` table.
- `[auth.external.google]` `client_id` must be non-empty or config fails to parse
  (use `env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)`).
- The Stripe SDK on Deno requires `stripe.webhooks.constructEventAsync(...)` — the sync
  `constructEvent` throws because WebCrypto can't run synchronously.
- `create-payment-intent` and `create-subscription` use `payment_method_types: ['card']` so no
  `return_url` is needed (redirect-based methods are disabled).

## 3. Stripe Webhook

Webhook already created in test mode (verified working 2026-07-31):
```
endpoint id: we_1TzIdIHmemY3mbrYC0duQmOr
url:         https://grukxcyaedfmzazeuehc.supabase.co/functions/v1/stripe-webhook
signing secret (for step 2): <your-webhook-secret-here>
```

Events enabled: `checkout.session.completed`, `customer.subscription.deleted`,
`customer.subscription.updated`, `payment_intent.succeeded`, `payment_intent.payment_failed`

## 4. Billing options

Each plan has three prices (in USD):

| Plan | Monthly (base) | On 6 months | Forever (one-time) |
|------|----------------|-------------|--------------------|
| Basic | 100 | 20/mo | 80 |
| Standard | 200 | 40/mo | 160 |
| Pro | 500 | 100/mo | 400 |

Checkout uses an in-page Stripe Elements card form (`checkout.html`), no Stripe-hosted redirect:

- **forever** = one-time. `create-payment-intent` returns a PaymentIntent
  (`mode: "payment"`); the page calls `stripe.confirmCardPayment(...)`, and the `payment_intent.succeeded`
  webhook records the purchase.
- **monthly** and **six** = Stripe subscription. `create-payment-intent` returns a SetupIntent
  (`mode: "setup"`); the page calls `stripe.confirmCardSetup(...)` then
  `create-subscription` which attaches the payment method, creates/links a customer, and creates
  the subscription. `six` auto-cancels after 6 months via `cancel_at` set in `create-subscription`.
- `create-subscription` uses the real Stripe Price IDs below (monthly + six only; forever never
  reaches it):

| Product | Monthly | On 6 months | Forever |
|---------|---------|-------------|---------|
| Basic (`prod_UzHA9F9j0VVXKG`) | `price_1TzId2HmemY3mbrYVpQfXBE3` | `price_1TzId4HmemY3mbrYBi6aZ7Ol` | `price_1TzId5HmemY3mbrYl8gslqSd` |
| Standard (`prod_UzHATuiCB2kqmp`) | `price_1TzId5HmemY3mbrYUqGv68zT` | `price_1TzId7HmemY3mbrY4XpYaoVq` | `price_1TzId8HmemY3mbrYtUst7pZ1` |
| Pro (`prod_UzHAFJet8m4agR`) | `price_1TzId9HmemY3mbrYn70mE0OH` | `price_1TzIdAHmemY3mbrYtgdCFWG6` | `price_1TzIdBHmemY3mbrYobtgghWw` |

`create-checkout-session` (legacy redirect flow) still uses `price_data.unit_amount` and remains
deployed, but is no longer called by the checkout page.

## 5. Stripe MCP server (optional, for agent-managed Stripe)

Add a Stripe API key, then restart opencode (MCP config is loaded at startup):

```
setx STRIPE_SECRET_KEY sk_test_...
```

The Stripe MCP server is configured in `opencode.json` (`@stripe/mcp`). After a restart,
the agent can create products/prices, inspect payments, and manage the account via MCP tools.

## 6. Security architecture (secret handling)

**Rule: no secret key ever touches the browser or a committed file.**

| Secret | Lives where? |
|--------|--------------|
| `STRIPE_SECRET_KEY` | Supabase secret (`supabase secrets set`) — read via `Deno.env.get` in edge functions |
| `STRIPE_WEBHOOK_SECRET` | Supabase secret — read by `stripe-webhook` |
| `RESEND_API_KEY` | Supabase secret — read by `send-email` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase secret — read by `stripe-webhook` / `create-subscription` |
| TestSprite `sk-user-...` (opencode MCP) | Local OS env var only; `opencode.json` reads it via `{env:TESTSPRITE_API_KEY}` |

What the frontend is allowed to ship (these are public by design):
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Stripe publishable key `pk_test_...`

Frontend → backend flow (already implemented in `js/stripe.js`):
1. The client fetches its session token from `/api/auth/token` (server route, same-origin).
2. It calls the edge function with `Authorization: Bearer <user JWT>` via
   `supabaseClient.functions.invoke(...)`.
3. The edge function verifies the JWT (gateway `verify_jwt = true`) and uses the **authenticated
   user's identity** — it never trusts a `userId`/`email` sent in the request body.

Deploy the hardened functions after changing `config.toml`:
```
supabase functions deploy create-payment-intent
supabase functions deploy create-subscription
supabase functions deploy send-email
```

## 7. Vercel environment variables (production)

The Next.js app only needs the two **public** Supabase values. Set them at
**Vercel → Project → Settings → Environment Variables** for Production, Preview, and Development:

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://grukxcyaedfmzazeuehc.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon key (from `.env.local`) |

Do **not** add `STRIPE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` to Vercel —
those belong only to Supabase Edge Functions. If you add them there, any Vercel serverless code
that logs or returns `process.env.*` could expose them.

Local `.env.local`:
- Copy `.env.example` → `.env.local`, fill in the two public values.
- `.env.local` is gitignored; commit only `.env.example` (placeholders only).

## 8. Local opencode / TestSprite

- `opencode.json` now references the TestSprite key via `{env:TESTSPRITE_API_KEY}` — it is safe
  to commit (no literal secrets).
- The value must exist in the **process environment** when opencode starts — opencode does NOT
  auto-load `.env` files. On Windows, set it once (persists for future sessions), then restart
  opencode:
  ```
  setx TESTSPRITE_API_KEY sk-user-...
  ```
- `.env.local` / `.env.example` list `TESTSPRITE_API_KEY=your_testsprite_api_key_here` as a
  placeholder for reference only.

## Files

| File | Purpose |
|------|---------|
| `js/supabase-config.js` | Supabase client init |
| `js/auth.js` | Auth helpers |
| `js/stripe.js` | Stripe helpers: `createPaymentIntent`, `createSubscription`, `recordPurchase` (legacy `createCheckoutSession` kept) |
| `checkout.html` | In-page card checkout (reads `plan` + `billing` params, Stripe Elements) |
| `account.html` | Account page with purchase history |
| `landing.html` | Landing page with 3-billing pricing |
| `supabase-schema.sql` | SQL to create purchases table |
| `supabase/functions/create-payment-intent/` | Edge function: PaymentIntent (forever) / SetupIntent (monthly, six) |
| `supabase/functions/create-subscription/` | Edge function: create Stripe subscription + record purchase |
| `supabase/functions/create-checkout-session/` | Legacy redirect-checkout edge function (kept, unused) |
| `supabase/functions/stripe-webhook/` | Edge function for Stripe webhook |
