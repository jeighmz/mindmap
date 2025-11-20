# Stripe Webhook Setup Guide

## The Problem
If your webhook page is empty in Stripe Dashboard, it means:
1. **No webhook endpoint is configured**, OR
2. **The webhook endpoint URL is incorrect**, OR
3. **Webhooks haven't been sent yet** (if you just set it up)

## Setting Up Webhooks

### Step 1: Determine Your Webhook URL

**For Production (Netlify)**:
```
https://yourdomain.com/.netlify/functions/stripe-webhook
```

**For Local Development**:
```
http://localhost:8888/.netlify/functions/stripe-webhook
```

### Step 2: Create Webhook Endpoint in Stripe

1. **Go to Stripe Dashboard**:
   - Test mode: https://dashboard.stripe.com/test/webhooks
   - Live mode: https://dashboard.stripe.com/webhooks

2. **Click "Add endpoint"**

3. **Enter Endpoint URL**:
   - Production: `https://aimindmap.netlify.app/.netlify/functions/stripe-webhook`
   - Or your custom domain if you have one

4. **Select Events to Listen To**:
   - ✅ `checkout.session.completed` (REQUIRED - handles new subscriptions)
   - ✅ `customer.subscription.updated` (handles tier changes)
   - ✅ `customer.subscription.deleted` (handles cancellations)
   - ✅ `invoice.payment_succeeded` (optional - for payment confirmations)
   - ✅ `invoice.payment_failed` (optional - for failed payments)

5. **Click "Add endpoint"**

### Step 3: Get Webhook Signing Secret

After creating the endpoint:

1. **Click on the webhook endpoint** you just created
2. **Copy the "Signing secret"** (starts with `whsec_...`)
3. **Add to Netlify Environment Variables**:
   - Go to Netlify Dashboard → Site → Environment variables
   - Add: `STRIPE_WEBHOOK_SECRET` = `whsec_...`
   - **Redeploy your site** after adding

### Step 4: Test the Webhook

#### Option A: Use Stripe CLI (Recommended for Local Testing)

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:8888/.netlify/functions/stripe-webhook
```

This will give you a webhook signing secret for local testing.

#### Option B: Trigger a Test Event

1. In Stripe Dashboard → Webhooks → Your endpoint
2. Click "Send test webhook"
3. Select `checkout.session.completed`
4. Click "Send test webhook"
5. Check if it was delivered successfully

#### Option C: Make a Test Purchase

1. Use a test card: `4242 4242 4242 4242`
2. Complete checkout
3. Check webhook logs in Stripe Dashboard

## Troubleshooting Empty Webhook Page

### If Webhook Page Shows "No events":

1. **Check if webhook endpoint exists**:
   - Go to Stripe Dashboard → Webhooks
   - You should see your endpoint listed
   - If not, create one (see Step 2 above)

2. **Check webhook URL is correct**:
   - Must be: `https://yourdomain.com/.netlify/functions/stripe-webhook`
   - No trailing slash
   - Must use HTTPS (not HTTP) in production

3. **Check Netlify Function is deployed**:
   - Go to Netlify Dashboard → Functions
   - Verify `stripe-webhook` function exists
   - Check function logs for errors

4. **Test webhook manually**:
   - Use Stripe CLI (see Option A above)
   - Or send a test webhook from Stripe Dashboard

### If Webhook Shows "Failed" Events:

1. **Check Webhook Signing Secret**:
   - Verify `STRIPE_WEBHOOK_SECRET` in Netlify matches the webhook's signing secret
   - Each webhook endpoint has its own signing secret
   - Test mode and Live mode have different secrets

2. **Check Function Logs**:
   - Go to Netlify Dashboard → Functions → stripe-webhook → Logs
   - Look for error messages
   - Common errors:
     - "Webhook signature verification failed" → Wrong signing secret
     - "User not found" → User doesn't exist in Firestore
     - "Missing newTier" → Checkout session metadata issue

3. **Check Function Response**:
   - Webhook must return `200` status code
   - Any other status code is considered a failure

## Manual Webhook Retry

If a webhook failed, you can retry it:

1. **Go to Stripe Dashboard → Webhooks → Your endpoint**
2. **Click on a failed event**
3. **Click "Send again"**
4. **Check if it succeeds this time**

## Verifying Webhook is Working

After setting up, verify:

1. **Make a test purchase** with card `4242 4242 4242 4242`
2. **Check Stripe Dashboard → Webhooks**:
   - Should see `checkout.session.completed` event
   - Status should be "Succeeded" (green checkmark)
3. **Check Netlify Function Logs**:
   - Should see "Webhook received" log
   - Should see "Tier update confirmed" log
4. **Check Firestore**:
   - User's `tier` field should be updated
   - `stripeSubscriptionId` should be set

## Quick Fix: Use the Sync Button

If webhook failed and you need to fix the tier immediately:

1. **Go to Settings** in your app
2. **Click "🔄 Sync from Stripe"** button
3. This will manually check your Stripe subscription and update your tier

## Common Issues

### Issue: "Webhook signature verification failed"

**Solution**:
- Verify `STRIPE_WEBHOOK_SECRET` matches the webhook's signing secret
- Make sure you're using the correct secret (test vs live)
- Redeploy after updating environment variable

### Issue: "No events showing"

**Solution**:
- Make sure webhook endpoint is created
- Check webhook URL is correct
- Try sending a test webhook
- Make a test purchase to trigger an event

### Issue: "Webhook times out"

**Solution**:
- Check Netlify function timeout (default is 10 seconds)
- Optimize webhook handler code
- Check Firebase connection speed

### Issue: "Tier not updating even though webhook succeeded"

**Solution**:
- Check Firestore rules allow updates
- Check user document exists
- Use "Sync from Stripe" button as fallback
- Check webhook logs for errors

## Production Checklist

Before going live:

- [ ] Webhook endpoint created in **Live mode** (not test mode)
- [ ] Webhook URL points to production domain
- [ ] `STRIPE_WEBHOOK_SECRET` set in Netlify (live mode secret)
- [ ] All required events selected
- [ ] Test webhook sent and succeeded
- [ ] Test purchase made and webhook fired
- [ ] Tier updated correctly in Firestore
- [ ] Webhook monitoring/alerts set up

## Need Help?

- **Stripe Webhook Docs**: https://stripe.com/docs/webhooks
- **Stripe Webhook Testing**: https://stripe.com/docs/webhooks/test
- **Netlify Functions**: https://docs.netlify.com/functions/overview/

