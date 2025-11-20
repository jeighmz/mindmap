# Stripe Checkout Testing Guide

## Prerequisites

1. **Stripe Test Mode**: Make sure you're using Stripe **test mode** keys (not live mode)
   - Test keys start with `pk_test_` (publishable) and `sk_test_` (secret)
   - Check your `.env` or Netlify environment variables

2. **Required Environment Variables**:
   - `REACT_APP_STRIPE_PUBLISHABLE_KEY` - Your Stripe test publishable key
   - `STRIPE_SECRET_KEY` - Your Stripe test secret key (in Netlify Functions)
   - `STRIPE_WEBHOOK_SECRET` - Your webhook signing secret (for webhook verification)

## Testing Steps

### 1. Test the Checkout Button Flow

1. **Start your app** (locally or on Netlify)
2. **Sign in** with a test user account
3. **Navigate to Pricing page** (`/pricing`)
4. **Click a plan button** (Starter, Pro, or Creator AI)
5. **Verify redirect**: You should be redirected to Stripe Checkout

### 2. Use Stripe Test Cards

In the Stripe Checkout form, use these **test card numbers**:

#### Successful Payment Cards:
- **Visa**: `4242 4242 4242 4242`
- **Visa (debit)**: `4000 0566 5566 5556`
- **Mastercard**: `5555 5555 5555 4444`
- **American Express**: `3782 822463 10005`

**For all test cards:**
- **Expiry**: Any future date (e.g., `12/34`)
- **CVC**: Any 3 digits (e.g., `123`)
- **ZIP**: Any 5 digits (e.g., `12345`)

#### Test Different Scenarios:

**Declined Card** (to test error handling):
- `4000 0000 0000 0002` - Card declined

**Requires Authentication (3D Secure)**:
- `4000 0025 0000 3155` - Requires authentication

**Insufficient Funds**:
- `4000 0000 0000 9995` - Insufficient funds

### 3. Verify the Complete Flow

After completing checkout:

1. **Check Stripe Dashboard**:
   - Go to https://dashboard.stripe.com/test/payments
   - You should see the payment with status "Succeeded"
   - Check the customer was created/updated

2. **Check Webhook Delivery**:
   - Go to https://dashboard.stripe.com/test/webhooks
   - Find your webhook endpoint
   - Check for `checkout.session.completed` event
   - Verify it was delivered successfully (green checkmark)

3. **Check Firestore Database**:
   - Go to Firebase Console → Firestore
   - Find your user document in the `users` collection
   - Verify:
     - `tier` field updated to the new tier (e.g., "STARTER", "PRO", "CREATOR_AI")
     - `stripeCustomerId` is set
     - `stripeSubscriptionId` is set
     - `updatedAt` timestamp is recent

4. **Check Your App**:
   - Refresh the page
   - Your tier should be updated
   - Features should reflect the new tier

## Testing Locally

### 1. Set Up Local Environment

Create a `.env` file in the root:
```env
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

For Netlify Functions (local testing), you'll need:
- `STRIPE_SECRET_KEY=sk_test_...`
- `STRIPE_WEBHOOK_SECRET=whsec_...`

### 2. Test Webhook Locally

To test webhooks locally, use **Stripe CLI**:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login to Stripe
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:8888/.netlify/functions/stripe-webhook
```

This will give you a webhook signing secret (starts with `whsec_`) - use this for local testing.

### 3. Run Your App

```bash
# Terminal 1: Run React app
npm start

# Terminal 2: Run Netlify Functions (if testing locally)
netlify dev
```

## Debugging

### Check Browser Console

Open browser DevTools → Console and look for:
- Any errors when clicking the button
- Network requests to `/api/create-checkout-session`
- Redirect to Stripe Checkout

### Check Netlify Function Logs

1. **Local**: Check terminal running `netlify dev`
2. **Production**: Go to Netlify Dashboard → Functions → View logs

Look for:
- `Checkout session creation:` log with tier information
- `Created checkout session:` log with session ID
- Any error messages

### Check Webhook Logs

In Stripe Dashboard → Webhooks → Your endpoint → Recent events:
- Click on an event to see request/response
- Check if webhook was successful
- Look for error messages in the response

### Common Issues

1. **"Stripe publishable key is not configured"**
   - Check `REACT_APP_STRIPE_PUBLISHABLE_KEY` is set
   - Restart your dev server after adding env vars

2. **"User not found"**
   - Make sure you're signed in
   - Check user exists in Firestore `users` collection

3. **Webhook not firing**
   - Verify webhook endpoint URL is correct in Stripe Dashboard
   - Check `STRIPE_WEBHOOK_SECRET` matches the webhook's signing secret
   - For local testing, use Stripe CLI to forward webhooks

4. **Tier not updating after payment**
   - Check webhook logs for errors
   - Verify `firebaseUserId` and `newTier` in webhook metadata
   - Check Firestore rules allow updates to `users` collection

5. **"Invalid subscription tier"**
   - Verify product IDs in `stripeService.js` match your Stripe products
   - Check tier names match exactly: `STARTER`, `PRO`, `CREATOR_AI`

## Verification Checklist

After a successful test purchase:

- [ ] Redirected to Stripe Checkout
- [ ] Payment succeeded in Stripe Dashboard
- [ ] Webhook event `checkout.session.completed` received
- [ ] User's `tier` field updated in Firestore
- [ ] `stripeCustomerId` set in user document
- [ ] `stripeSubscriptionId` set in user document
- [ ] App UI reflects new tier (refresh page)
- [ ] Features match new tier permissions

## Testing Different Scenarios

### Test Upgrade Flow
1. Start with FREE tier
2. Purchase STARTER tier
3. Verify tier updates
4. Purchase PRO tier (upgrade)
5. Verify tier updates and old subscription cancelled

### Test Downgrade Flow
1. Have PRO tier subscription
2. Purchase STARTER tier
3. Verify old subscription cancelled, new one created

### Test Error Handling
1. Use declined card (`4000 0000 0000 0002`)
2. Verify error message shown
3. Verify no tier change occurred

## Production Testing

Before going live:

1. **Switch to Live Mode Keys**:
   - Update `REACT_APP_STRIPE_PUBLISHABLE_KEY` to live key (`pk_live_...`)
   - Update `STRIPE_SECRET_KEY` to live key (`sk_live_...`)
   - Update webhook endpoint to use live webhook secret

2. **Test with Real Card** (use a real card with small amount):
   - Use a real card you control
   - Test with small amount first
   - Verify everything works
   - **Cancel subscription immediately** after testing

3. **Monitor Webhooks**:
   - Set up webhook monitoring/alerts
   - Check webhook delivery success rate
   - Monitor for errors

## Stripe Dashboard Links

- **Test Mode Dashboard**: https://dashboard.stripe.com/test
- **Payments**: https://dashboard.stripe.com/test/payments
- **Customers**: https://dashboard.stripe.com/test/customers
- **Subscriptions**: https://dashboard.stripe.com/test/subscriptions
- **Webhooks**: https://dashboard.stripe.com/test/webhooks
- **Events**: https://dashboard.stripe.com/test/events

## Need Help?

- **Stripe Documentation**: https://stripe.com/docs/testing
- **Stripe Test Cards**: https://stripe.com/docs/testing#cards
- **Webhook Testing**: https://stripe.com/docs/webhooks/test

