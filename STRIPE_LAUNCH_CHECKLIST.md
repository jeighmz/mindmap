# Stripe Launch Checklist - Going Live

## Pre-Launch Preparation

### 1. Stripe Account Setup

- [ ] **Complete Stripe account verification**
  - Go to https://dashboard.stripe.com/account
  - Complete business information
  - Verify identity (if required)
  - Add bank account for payouts
  - Complete tax information

- [ ] **Review Stripe pricing**
  - Standard: 2.9% + $0.30 per successful card charge
  - Verify you understand all fees
  - Set up payout schedule

### 2. Switch to Live Mode Keys

- [ ] **Get Live API Keys**
  - Go to https://dashboard.stripe.com/apikeys
  - **Switch to Live mode** (toggle in top right)
  - Copy your **Live Publishable Key** (`pk_live_...`)
  - Copy your **Live Secret Key** (`sk_live_...`)

- [ ] **Update Environment Variables**

  **Netlify Environment Variables** (Production):
  ```
  STRIPE_SECRET_KEY=sk_live_...
  STRIPE_WEBHOOK_SECRET=whsec_... (from live webhook)
  ```

  **React App Environment Variables**:
  ```
  REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_live_...
  ```

  **How to set in Netlify**:
  1. Go to Netlify Dashboard → Site → Environment variables
  2. Add/update each variable
  3. Redeploy your site

### 3. Set Up Live Webhook

- [ ] **Create Live Webhook Endpoint**
  - Go to https://dashboard.stripe.com/webhooks (in Live mode)
  - Click "Add endpoint"
  - Endpoint URL: `https://yourdomain.com/.netlify/functions/stripe-webhook`
  - Select events to listen to:
    - `checkout.session.completed`
    - `customer.subscription.updated`
    - `customer.subscription.deleted`
    - `invoice.payment_succeeded`
    - `invoice.payment_failed`
  - Click "Add endpoint"

- [ ] **Get Webhook Signing Secret**
  - After creating webhook, click on it
  - Copy the "Signing secret" (starts with `whsec_`)
  - Add to Netlify environment variables as `STRIPE_WEBHOOK_SECRET`

### 4. Verify Product IDs

- [ ] **Check Product IDs Match**
  - Go to https://dashboard.stripe.com/products (Live mode)
  - Verify product IDs in `src/services/stripeService.js` match your live products:
    ```javascript
    const STRIPE_PRODUCT_IDS = {
      [USER_TIERS.STARTER]: 'prod_...', // Verify this matches
      [USER_TIERS.PRO]: 'prod_...',     // Verify this matches
      [USER_TIERS.CREATOR_AI]: 'prod_...', // Verify this matches
    };
    ```

- [ ] **Create Products if Needed**
  - If products don't exist in live mode, create them:
    - Starter: $9/month
    - Pro: $29/month
    - Creator AI: $59/month
  - Copy the product IDs and update your code

### 5. Test in Live Mode (with Real Card)

- [ ] **Do a Real Test Purchase**
  - Use a real credit card you control
  - Purchase the cheapest plan (Starter - $9)
  - Verify:
    - Payment succeeds
    - Webhook fires
    - User tier updates
    - Subscription created
  - **Cancel subscription immediately** after testing
  - Verify refund/credit (if applicable)

### 6. Security & Compliance

- [ ] **SSL Certificate**
  - Verify your site uses HTTPS
  - Netlify provides this automatically

- [ ] **PCI Compliance**
  - Stripe handles PCI compliance
  - Never store card details yourself
  - All card data goes directly to Stripe

- [ ] **Privacy Policy & Terms**
  - Add links to Privacy Policy and Terms of Service
  - Include Stripe's required disclosures

- [ ] **GDPR Compliance** (if applicable)
  - Add cookie consent if needed
  - Include data processing information

### 7. Monitoring & Alerts

- [ ] **Set Up Stripe Alerts**
  - Go to https://dashboard.stripe.com/settings/alerts
  - Enable email alerts for:
    - Failed payments
    - Disputed payments
    - Webhook failures
    - High-value payments

- [ ] **Set Up Monitoring**
  - Monitor webhook delivery success rate
  - Set up error tracking (Sentry, etc.)
  - Monitor failed payments

### 8. Final Code Checks

- [ ] **Remove Test Mode Indicators** (if any)
  - Remove any "TEST MODE" banners
  - Remove test card hints

- [ ] **Verify Environment Detection**
  - Ensure code uses correct keys based on environment
  - Test mode keys should NOT be in production

- [ ] **Check Error Handling**
  - Payment failures show user-friendly messages
  - Webhook failures are logged
  - Failed payments don't break the app

### 9. Documentation

- [ ] **Update Documentation**
  - Document live webhook URL
  - Document product IDs
  - Document any manual processes

- [ ] **Team Training**
  - Train team on Stripe Dashboard
  - Show how to handle refunds
  - Show how to cancel subscriptions
  - Show how to view customer data

## Launch Day

### Morning of Launch

- [ ] **Final Test**
  - Do one more test purchase in live mode
  - Verify everything works

- [ ] **Switch to Live Keys**
  - Update all environment variables
  - Redeploy application
  - Verify live keys are active

- [ ] **Monitor Dashboard**
  - Keep Stripe Dashboard open
  - Watch for first real payment
  - Verify webhook fires

### After Launch

- [ ] **Monitor First 24 Hours**
  - Check for failed payments
  - Check webhook delivery
  - Monitor error logs
  - Check customer support (if any issues)

- [ ] **Verify Payouts**
  - Check Stripe Dashboard → Balance
  - Verify funds are accumulating
  - Check payout schedule

## Important Reminders

### ⚠️ Never Mix Test and Live Keys

- **Test keys** (`pk_test_`, `sk_test_`) should ONLY be used in development
- **Live keys** (`pk_live_`, `sk_live_`) should ONLY be used in production
- Mixing them will cause errors and failed payments

### 🔒 Keep Keys Secure

- Never commit keys to Git
- Use environment variables only
- Rotate keys if exposed
- Use different keys for different environments

### 📊 Monitor Regularly

- Check Stripe Dashboard daily (at first)
- Monitor webhook success rate
- Watch for failed payments
- Review customer feedback

### 💰 Understand Fees

- Stripe charges 2.9% + $0.30 per transaction
- International cards may have additional fees
- Refunds: fees are not refunded
- Chargebacks: $15 fee + potential loss of funds

### 🆘 Support Resources

- **Stripe Support**: https://support.stripe.com
- **Stripe Status**: https://status.stripe.com
- **Stripe Docs**: https://stripe.com/docs
- **Stripe Dashboard**: https://dashboard.stripe.com

## Quick Reference

### Environment Variables Needed

**Production (Netlify)**:
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

**React App**:
```
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

### Webhook Endpoint URL

```
https://yourdomain.com/.netlify/functions/stripe-webhook
```

### Required Webhook Events

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

### Product IDs Location

File: `src/services/stripeService.js`
```javascript
const STRIPE_PRODUCT_IDS = {
  [USER_TIERS.STARTER]: 'prod_...',
  [USER_TIERS.PRO]: 'prod_...',
  [USER_TIERS.CREATOR_AI]: 'prod_...',
};
```

## Rollback Plan

If something goes wrong:

1. **Switch back to test keys** (temporarily)
2. **Disable payment buttons** (add maintenance mode)
3. **Check webhook logs** for errors
4. **Contact Stripe Support** if needed
5. **Fix issues** before re-enabling

## Post-Launch Checklist

- [ ] First real payment received
- [ ] Webhook delivered successfully
- [ ] User tier updated correctly
- [ ] Subscription created in Stripe
- [ ] Customer can access paid features
- [ ] No errors in logs
- [ ] Team notified of successful launch

---

**Remember**: Test thoroughly in test mode first, then do one real test purchase before going fully live. Better safe than sorry! 🚀

