# Local Webhook Testing Setup

## The Problem
When testing locally on `localhost:3000`, Stripe can't reach your local server directly. You need to use **Stripe CLI** to forward webhooks to your local development server.

## Step-by-Step Setup

### 1. Install Stripe CLI

**macOS (using Homebrew)**:
```bash
brew install stripe/stripe-cli/stripe
```

**Other platforms**: See https://stripe.com/docs/stripe-cli

### 2. Login to Stripe

```bash
stripe login
```

This will open your browser to authenticate with Stripe.

### 3. Start Your Local Server

Make sure your app is running:
```bash
# Terminal 1: Start React app
npm start
# Runs on http://localhost:3000

# Terminal 2: Start Netlify Functions
netlify dev
# Functions available at http://localhost:8888/.netlify/functions
```

### 4. Forward Webhooks to Local Server

In a **new terminal**, run:

```bash
stripe listen --forward-to localhost:8888/.netlify/functions/stripe-webhook
```

**Important**: Use port `8888` (Netlify Functions port), not `3000` (React app port).

### 5. Get the Webhook Signing Secret

When you run `stripe listen`, it will output something like:

```
> Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxx (^C to quit)
```

**Copy this secret** - it's different from your production webhook secret!

### 6. Set Local Environment Variable

Create or update your `.env` file in the project root:

```env
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

**Note**: The `STRIPE_WEBHOOK_SECRET` from `stripe listen` is ONLY for local testing. Don't use your production webhook secret locally.

### 7. Restart Your Server

After adding the environment variable:

```bash
# Stop netlify dev (Ctrl+C)
# Restart it
netlify dev
```

## Testing the Webhook Locally

### Option 1: Make a Test Purchase

1. Go to `http://localhost:3000/pricing`
2. Click a plan button
3. Use test card: `4242 4242 4242 4242`
4. Complete checkout
5. Check the `stripe listen` terminal - you should see webhook events
6. Check your app - tier should update

### Option 2: Trigger Test Event

In the terminal where `stripe listen` is running, you can trigger test events:

```bash
# In another terminal (while stripe listen is running)
stripe trigger checkout.session.completed
```

This will send a test webhook to your local server.

## Environment Variables Summary

### Local Development (`.env` file):
```env
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...  # From stripe listen command
```

### Production (Netlify Dashboard):
```
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_... (or pk_live_...)
STRIPE_SECRET_KEY=sk_test_... (or sk_live_...)
STRIPE_WEBHOOK_SECRET=whsec_...  # From Stripe Dashboard webhook endpoint
```

**Important**: 
- Local and production use **different** webhook secrets
- Local secret comes from `stripe listen`
- Production secret comes from Stripe Dashboard → Webhooks

## Troubleshooting

### "Webhook signature verification failed"

**Solution**:
- Make sure `STRIPE_WEBHOOK_SECRET` in `.env` matches the secret from `stripe listen`
- Restart `netlify dev` after updating `.env`
- Don't use the production webhook secret locally

### "No webhook events showing"

**Solution**:
- Make sure `stripe listen` is running
- Check the forward URL is correct: `localhost:8888/.netlify/functions/stripe-webhook`
- Make sure `netlify dev` is running
- Try triggering a test event: `stripe trigger checkout.session.completed`

### "Webhook not reaching local server"

**Solution**:
- Verify `netlify dev` is running on port 8888
- Check `stripe listen` shows "Ready!" message
- Check the forward URL matches exactly
- Look for errors in the `stripe listen` terminal

### "Environment variable not loading"

**Solution**:
- Make sure `.env` file is in the project root (same level as `package.json`)
- Restart `netlify dev` after changing `.env`
- Check `.env` file doesn't have quotes around values (unless needed)
- For React app variables, they must start with `REACT_APP_`

## Quick Reference

**Terminal 1** (React App):
```bash
npm start
```

**Terminal 2** (Netlify Functions):
```bash
netlify dev
```

**Terminal 3** (Stripe Webhook Forwarding):
```bash
stripe listen --forward-to localhost:8888/.netlify/functions/stripe-webhook
```

## Alternative: Use ngrok (Not Recommended)

You could also use ngrok to expose your local server, but Stripe CLI is much easier:

```bash
# Install ngrok
brew install ngrok

# Expose local server
ngrok http 8888

# Use the ngrok URL in Stripe Dashboard webhook endpoint
# But you'd need to update it every time ngrok restarts
```

**Stripe CLI is better** because:
- No need to update webhook URL
- Works automatically
- Easier to use
- Free

## Next Steps

Once local testing works:
1. Set up production webhook in Stripe Dashboard
2. Add production webhook secret to Netlify
3. Test with a real purchase (then cancel immediately)
4. Monitor webhook delivery in Stripe Dashboard

