# Production Environment Setup Guide

This guide walks you through setting up your production environment with live Stripe product IDs and keys.

## Overview

The application now supports environment-aware product IDs:
- **Test Mode**: Uses test product IDs (hardcoded fallback)
- **Production Mode**: Uses production product IDs from environment variables

The system automatically detects production mode by checking if `REACT_APP_STRIPE_PUBLISHABLE_KEY` starts with `pk_live_`.

## Step 1: Verify Products in Stripe (Live Mode)

Your production product IDs are already created:

- **Starter**: `prod_TNlcRbyRR0NBAU` ($9/month)
- **Pro**: `prod_TNlcHMU8qci7qi` ($29/month)
- **Creator AI**: `prod_TNlcORK76OVe4q` ($59/month)

To verify or view these products:
1. Go to [Stripe Dashboard - Products (Live Mode)](https://dashboard.stripe.com/products)
2. **Switch to Live mode** (toggle in top right)
3. Verify each product exists and has both monthly and annual prices configured

## Step 2: Get Live Stripe Keys

1. Go to [Stripe Dashboard - API Keys (Live Mode)](https://dashboard.stripe.com/apikeys)
2. **Switch to Live mode** (toggle in top right)
3. Copy your **Live Publishable Key** (`pk_live_...`)
4. Copy your **Live Secret Key** (`sk_live_...`)

## Step 3: Set Up Live Webhook

1. Go to [Stripe Dashboard - Webhooks (Live Mode)](https://dashboard.stripe.com/webhooks)
2. Click "Add endpoint"
3. Endpoint URL: `https://yourdomain.com/.netlify/functions/stripe-webhook`
   - Replace `yourdomain.com` with your actual domain
4. Select events to listen to:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Click "Add endpoint"
6. Copy the **Signing secret** (starts with `whsec_`)

## Step 4: Configure Netlify Environment Variables

Go to your Netlify Dashboard → Site → Environment variables → Production

Add/update these variables:

### Required Variables:

```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_live_...
REACT_APP_STRIPE_PRODUCT_ID_STARTER=prod_TNlcRbyRR0NBAU
REACT_APP_STRIPE_PRODUCT_ID_PRO=prod_TNlcHMU8qci7qi
REACT_APP_STRIPE_PRODUCT_ID_CREATOR_AI=prod_TNlcORK76OVe4q
```

### Variable Descriptions:

- **STRIPE_SECRET_KEY**: Your live Stripe secret key (`sk_live_...`)
- **STRIPE_WEBHOOK_SECRET**: Your live webhook signing secret (`whsec_...`)
- **REACT_APP_STRIPE_PUBLISHABLE_KEY**: Your live Stripe publishable key (`pk_live_...`)
- **REACT_APP_STRIPE_PRODUCT_ID_STARTER**: Live product ID for Starter tier (`prod_...`)
- **REACT_APP_STRIPE_PRODUCT_ID_PRO**: Live product ID for Pro tier (`prod_...`)
- **REACT_APP_STRIPE_PRODUCT_ID_CREATOR_AI**: Live product ID for Creator AI tier (`prod_...`)

## Step 5: Verify Configuration

After setting environment variables:

1. **Redeploy your site** on Netlify
2. Check the browser console (in production) - you should see:
   ```
   [Stripe] Using PRODUCTION product IDs: { ... }
   ```
3. If you see a warning about using test product IDs in production, check that all `REACT_APP_STRIPE_PRODUCT_ID_*` variables are set correctly

## Step 6: Test in Production (Optional but Recommended)

Before going fully live, do a real test purchase:

1. Use a real credit card you control
2. Purchase the cheapest plan (Starter - $9)
3. Verify:
   - Payment succeeds
   - Webhook fires (check Stripe Dashboard → Webhooks → Recent events)
   - User tier updates in your app
   - Subscription created in Stripe
4. **Cancel the subscription immediately** after testing
5. Verify refund/credit (if applicable)

## Environment Detection

The system automatically detects production mode:

- **Production Mode**: When `REACT_APP_STRIPE_PUBLISHABLE_KEY` starts with `pk_live_`
- **Test Mode**: When `REACT_APP_STRIPE_PUBLISHABLE_KEY` starts with `pk_test_` or is not set

In production mode:
- Uses product IDs from `REACT_APP_STRIPE_PRODUCT_ID_*` environment variables
- Falls back to test product IDs if variables are not set (with warning)

In test mode:
- Always uses hardcoded test product IDs

## Troubleshooting

### Product IDs Not Working

1. **Check environment variables are set**: Go to Netlify Dashboard → Environment variables
2. **Verify product IDs match**: Compare your Stripe Dashboard product IDs with the environment variables
3. **Check key mode matches**: Ensure `REACT_APP_STRIPE_PUBLISHABLE_KEY` is `pk_live_...` and `STRIPE_SECRET_KEY` is `sk_live_...`
4. **Redeploy**: Environment variable changes require a redeploy

### Webhook Not Firing

1. **Check webhook URL**: Ensure it matches your production domain
2. **Verify webhook secret**: Check `STRIPE_WEBHOOK_SECRET` matches the webhook's signing secret
3. **Check webhook events**: Ensure all required events are selected
4. **Check webhook logs**: Go to Stripe Dashboard → Webhooks → Your endpoint → Recent events

### Wrong Product IDs Being Used

1. **Check console logs**: Look for `[Stripe] Using PRODUCTION product IDs` message
2. **Verify environment variables**: Ensure all `REACT_APP_STRIPE_PRODUCT_ID_*` variables are set
3. **Check for warnings**: If you see a warning about test IDs in production, fix the environment variables

## Quick Reference

### Environment Variables Checklist

- [ ] `STRIPE_SECRET_KEY` = `sk_live_...`
- [ ] `STRIPE_WEBHOOK_SECRET` = `whsec_...`
- [ ] `REACT_APP_STRIPE_PUBLISHABLE_KEY` = `pk_live_...`
- [ ] `REACT_APP_STRIPE_PRODUCT_ID_STARTER` = `prod_TNlcRbyRR0NBAU`
- [ ] `REACT_APP_STRIPE_PRODUCT_ID_PRO` = `prod_TNlcHMU8qci7qi`
- [ ] `REACT_APP_STRIPE_PRODUCT_ID_CREATOR_AI` = `prod_TNlcORK76OVe4q`

### Stripe Dashboard Links

- [Products (Live)](https://dashboard.stripe.com/products)
- [API Keys (Live)](https://dashboard.stripe.com/apikeys)
- [Webhooks (Live)](https://dashboard.stripe.com/webhooks)
- [Test Mode Toggle](https://dashboard.stripe.com/test/switch)

## Security Notes

⚠️ **Never commit these values to Git!**

- All Stripe keys and product IDs should be in environment variables only
- Never hardcode production keys in source code
- Use different keys for test and production environments
- Rotate keys if they are ever exposed

## Support

If you encounter issues:

1. Check the browser console for error messages
2. Check Netlify function logs
3. Check Stripe Dashboard → Webhooks → Recent events
4. Verify all environment variables are set correctly
5. Ensure you've redeployed after setting environment variables

---

**Remember**: Test thoroughly in test mode first, then do one real test purchase before going fully live! 🚀

