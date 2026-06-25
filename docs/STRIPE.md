# Stripe Setup

Covers local and production Stripe configuration: keys, product IDs, and webhooks.

## Environments at a glance

| Setting | Local (`.env`) | Production (Netlify dashboard) |
|---|---|---|
| Publishable key | `pk_test_...` | `pk_live_...` |
| Secret key | `sk_test_...` | `sk_live_...` |
| Webhook secret | from `stripe listen` | from Stripe Dashboard → Webhooks |
| Product IDs | test IDs (hardcoded fallback) | live IDs via env vars |

Local and production must **not** share keys or webhook secrets.

## How mode is detected

The code checks `REACT_APP_STRIPE_PUBLISHABLE_KEY`:

- Starts with `pk_live_` → production: uses `REACT_APP_STRIPE_PRODUCT_ID_*` env vars (falls back to test IDs with a warning if unset).
- Otherwise → test: uses hardcoded test product IDs.

## Product IDs

Product → tier mapping lives in:

- `src/services/stripeService.js` (client, `getStripeProductIds()`)
- `netlify/functions/create-checkout-session.js` and `netlify/functions/stripe-webhook.js` (server)

If you change products in Stripe, update those locations. (There is no `sync-subscription.js`.)

| Tier | Test product ID | Live product ID | Price |
|---|---|---|---|
| Starter | `prod_TSG73qEwSrGdpr` | `prod_TNlcRbyRR0NBAU` | $9/mo |
| Pro | `prod_TSG8miwSS3czd7` | `prod_TNlcHMU8qci7qi` | $29/mo |
| Creator AI | `prod_TSG8Fh0h21SEhc` | `prod_TNlcORK76OVe4q` | $59/mo |

Product IDs are not secrets, but keep live values in env vars rather than source where practical.

## Environment variables

### Local `.env` (test mode)

```env
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...        # from `stripe listen`
# Product IDs optional locally — test IDs are the default
```

### Production (Netlify dashboard)

```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_live_...
REACT_APP_STRIPE_PRODUCT_ID_STARTER=prod_TNlcRbyRR0NBAU
REACT_APP_STRIPE_PRODUCT_ID_PRO=prod_TNlcHMU8qci7qi
REACT_APP_STRIPE_PRODUCT_ID_CREATOR_AI=prod_TNlcORK76OVe4q
SITE_URL=https://your-domain
```

Get keys at https://dashboard.stripe.com/apikeys (toggle Test/Live in the top right). Redeploy after changing any variable.

## Webhooks

### Local

```bash
stripe login
stripe listen --forward-to localhost:8888/.netlify/functions/stripe-webhook
```

Use port `8888` (Netlify Functions), not `3000`. Copy the printed `whsec_...` into your `.env` as `STRIPE_WEBHOOK_SECRET`, then restart `netlify dev`.

Trigger a test event:

```bash
stripe trigger checkout.session.completed
```

### Production

1. Stripe Dashboard → Webhooks (Live mode) → Add endpoint.
2. URL: `https://your-domain/.netlify/functions/stripe-webhook`
3. Subscribe to: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`.
4. Copy the signing secret (`whsec_...`) into Netlify as `STRIPE_WEBHOOK_SECRET`.

## Testing

- Test card: `4242 4242 4242 4242`, any future expiry/CVC.
- Verify in Stripe Dashboard → Webhooks → Recent events that events deliver and return 200.
- Confirm the user's tier updates in-app after checkout.

## Launch checklist

- [ ] Live keys set in Netlify (Production scope): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `REACT_APP_STRIPE_PUBLISHABLE_KEY`
- [ ] Live product IDs set: `REACT_APP_STRIPE_PRODUCT_ID_{STARTER,PRO,CREATOR_AI}`
- [ ] `SITE_URL` set to the production domain
- [ ] Live webhook endpoint created and secret copied to Netlify
- [ ] Site redeployed after setting variables
- [ ] One real low-cost purchase tested end-to-end, then cancelled

## Security

- Never commit `.env` or live keys.
- Server secrets must not use the `REACT_APP_` prefix.
- Rotate any key that is ever exposed.
