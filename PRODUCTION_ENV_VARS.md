# Production Environment Variables - Quick Reference

Copy these exact values into your Netlify Dashboard → Site → Environment variables → Production

## Required Environment Variables

```
STRIPE_SECRET_KEY=sk_live_YOUR_SECRET_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET_HERE
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_PUBLISHABLE_KEY_HERE
REACT_APP_STRIPE_PRODUCT_ID_STARTER=prod_TNlcRbyRR0NBAU
REACT_APP_STRIPE_PRODUCT_ID_PRO=prod_TNlcHMU8qci7qi
REACT_APP_STRIPE_PRODUCT_ID_CREATOR_AI=prod_TNlcORK76OVe4q
```

## Product IDs (Already Set Above)

- **Starter**: `prod_TNlcRbyRR0NBAU` ($9/month)
- **Pro**: `prod_TNlcHMU8qci7qi` ($29/month)
- **Creator AI**: `prod_TNlcORK76OVe4q` ($59/month)

## How to Get Your Stripe Keys

1. **Live Secret Key** (`STRIPE_SECRET_KEY`):
   - Go to https://dashboard.stripe.com/apikeys
   - Switch to **Live mode** (toggle in top right)
   - Copy the **Secret key** (starts with `sk_live_`)

2. **Live Publishable Key** (`REACT_APP_STRIPE_PUBLISHABLE_KEY`):
   - Same page as above
   - Copy the **Publishable key** (starts with `pk_live_`)

3. **Webhook Secret** (`STRIPE_WEBHOOK_SECRET`):
   - Go to https://dashboard.stripe.com/webhooks
   - Switch to **Live mode**
   - Click on your webhook endpoint
   - Copy the **Signing secret** (starts with `whsec_`)

## After Setting Variables

1. **Redeploy your site** on Netlify (required for environment variable changes)
2. Check browser console in production - you should see:
   ```
   [Stripe] Using PRODUCTION product IDs: { ... }
   ```

## Verification Checklist

- [ ] All 6 environment variables are set in Netlify
- [ ] All keys start with correct prefixes (`sk_live_`, `pk_live_`, `whsec_`)
- [ ] Product IDs match exactly (no extra spaces or quotes)
- [ ] Site has been redeployed after setting variables
- [ ] Browser console shows "PRODUCTION" mode (not "TEST")

---

**Note**: Never commit these values to Git. They should only exist in Netlify environment variables.

