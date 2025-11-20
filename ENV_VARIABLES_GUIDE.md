# Environment Variables: Local vs Production

**Important**: Your local `.env` file should **NOT** match production. They use different Stripe keys and product IDs.

## Local Development (`.env` file)

Use **TEST mode** keys and test product IDs:

```env
# Stripe Test Keys (for local development)
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...  # From `stripe listen` command

# Product IDs (optional - code uses test IDs by default)
# Only set these if you want to override the default test product IDs
# REACT_APP_STRIPE_PRODUCT_ID_STARTER=prod_TSG73qEwSrGdpr
# REACT_APP_STRIPE_PRODUCT_ID_PRO=prod_TSG8miwSS3czd7
# REACT_APP_STRIPE_PRODUCT_ID_CREATOR_AI=prod_TSG8Fh0h21SEhc
```

### How to Get Test Keys

1. Go to https://dashboard.stripe.com/apikeys
2. Make sure you're in **Test mode** (toggle in top right)
3. Copy the **Test publishable key** (`pk_test_...`)
4. Copy the **Test secret key** (`sk_test_...`)

### Local Webhook Secret

For local development, use Stripe CLI:

```bash
stripe listen --forward-to localhost:8888/.netlify/functions/stripe-webhook
```

Copy the webhook secret it outputs (starts with `whsec_`) and add it to your `.env` file.

## Production (Netlify Dashboard)

Use **LIVE mode** keys and production product IDs:

```
# Stripe Live Keys (for production)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...  # From Stripe Dashboard webhook
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_live_...

# Production Product IDs (REQUIRED)
REACT_APP_STRIPE_PRODUCT_ID_STARTER=prod_TNlcRbyRR0NBAU
REACT_APP_STRIPE_PRODUCT_ID_PRO=prod_TNlcHMU8qci7qi
REACT_APP_STRIPE_PRODUCT_ID_CREATOR_AI=prod_TNlcORK76OVe4q
```

### How to Get Live Keys

1. Go to https://dashboard.stripe.com/apikeys
2. Switch to **Live mode** (toggle in top right)
3. Copy the **Live publishable key** (`pk_live_...`)
4. Copy the **Live secret key** (`sk_live_...`)

### Production Webhook Secret

1. Go to https://dashboard.stripe.com/webhooks (Live mode)
2. Click on your webhook endpoint
3. Copy the **Signing secret** (`whsec_...`)

## Key Differences

| Setting | Local (`.env`) | Production (Netlify) |
|---------|---------------|---------------------|
| **Stripe Keys** | `pk_test_...` / `sk_test_...` | `pk_live_...` / `sk_live_...` |
| **Webhook Secret** | From `stripe listen` | From Stripe Dashboard |
| **Product IDs** | Test IDs (hardcoded) | Production IDs (env vars) |
| **Mode** | Test/Local | Live/Production |

## How the Code Works

The code automatically detects which mode you're in:

- **Test Mode**: When `REACT_APP_STRIPE_PUBLISHABLE_KEY` starts with `pk_test_`
  - Uses test product IDs (hardcoded)
  - No environment variables needed for product IDs

- **Production Mode**: When `REACT_APP_STRIPE_PUBLISHABLE_KEY` starts with `pk_live_`
  - Uses production product IDs from environment variables
  - Falls back to test IDs if not set (with warning)

## Quick Checklist

### Local Development Setup

- [ ] `.env` file exists in project root
- [ ] `REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_...`
- [ ] `STRIPE_SECRET_KEY=sk_test_...`
- [ ] `STRIPE_WEBHOOK_SECRET=whsec_...` (from `stripe listen`)
- [ ] Product IDs NOT set (uses defaults)

### Production Setup

- [ ] Netlify environment variables set (Production)
- [ ] `REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_live_...`
- [ ] `STRIPE_SECRET_KEY=sk_live_...`
- [ ] `STRIPE_WEBHOOK_SECRET=whsec_...` (from Dashboard)
- [ ] `REACT_APP_STRIPE_PRODUCT_ID_STARTER=prod_TNlcRbyRR0NBAU`
- [ ] `REACT_APP_STRIPE_PRODUCT_ID_PRO=prod_TNlcHMU8qci7qi`
- [ ] `REACT_APP_STRIPE_PRODUCT_ID_CREATOR_AI=prod_TNlcORK76OVe4q`
- [ ] Site redeployed after setting variables

## Common Mistakes

### ❌ Don't Do This

- Use live keys in local `.env` file
- Use test keys in production
- Use production webhook secret locally
- Use local webhook secret in production
- Set production product IDs in local `.env`

### ✅ Do This

- Keep test keys for local development
- Keep live keys for production only
- Use different webhook secrets for each environment
- Let the code auto-detect the mode based on key prefix

## Why They're Different

- **Test mode**: Safe for development, uses test cards, no real charges
- **Live mode**: Real payments, real customers, real money
- **Product IDs**: Different between test and live modes in Stripe
- **Webhook secrets**: Different endpoints = different secrets

## Security Reminders

- ✅ Never commit `.env` file to Git (should be in `.gitignore`)
- ✅ Never commit production keys to Git
- ✅ Use different keys for test and production
- ✅ Rotate keys if they're ever exposed

---

**TL;DR**: Local uses test keys, production uses live keys. They should **NOT** match! 🎯

