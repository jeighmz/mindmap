# How to Fix Product ID Mismatch

## The Problem
Your code has hardcoded product IDs that don't exist in your Stripe account. You need to either:
1. **Create products in Stripe** and use those IDs, OR
2. **Get existing product IDs** from Stripe and update the code

## Option 1: Create Products in Stripe (Recommended)

### Step 1: Go to Stripe Dashboard
- **Test mode**: https://dashboard.stripe.com/test/products
- **Live mode**: https://dashboard.stripe.com/products

### Step 2: Create Three Products

Create these products with monthly recurring prices:

1. **Starter** - $9/month
   - Name: "Starter"
   - Description: "Starter plan"
   - Pricing: Recurring, $9.00 USD, Monthly

2. **Pro** - $29/month
   - Name: "Pro"
   - Description: "Pro plan"
   - Pricing: Recurring, $29.00 USD, Monthly

3. **Creator AI** - $59/month
   - Name: "Creator AI"
   - Description: "Creator AI plan"
   - Pricing: Recurring, $59.00 USD, Monthly

### Step 3: Copy Product IDs

After creating each product:
1. Click on the product
2. Copy the **Product ID** (starts with `prod_...`)
3. Note which tier it corresponds to

### Step 4: Update Code

Update `src/services/stripeService.js`:

```javascript
const STRIPE_PRODUCT_IDS = {
  [USER_TIERS.STARTER]: 'prod_YOUR_STARTER_ID',
  [USER_TIERS.PRO]: 'prod_YOUR_PRO_ID',
  [USER_TIERS.CREATOR_AI]: 'prod_YOUR_CREATOR_AI_ID',
};
```

Also update `netlify/functions/sync-subscription.js`:

```javascript
const PRODUCT_TO_TIER = {
  'prod_YOUR_STARTER_ID': 'STARTER',
  'prod_YOUR_PRO_ID': 'PRO',
  'prod_YOUR_CREATOR_AI_ID': 'CREATOR_AI',
};
```

## Option 2: Use Existing Products

If you already have products in Stripe:

1. Go to Stripe Dashboard → Products
2. Click on each product
3. Copy the Product ID
4. Update the code as shown above

## Quick Fix Script

I can help you update the code once you have the product IDs. Just provide:
- Starter product ID: `prod_...`
- Pro product ID: `prod_...`
- Creator AI product ID: `prod_...`

## Important Notes

- **Test mode and Live mode have different product IDs**
- Make sure you're creating products in the same mode as your API keys
- If using test mode, create products in test mode
- If using live mode, create products in live mode

## After Updating

1. Restart your dev server (`netlify dev`)
2. Try checkout again
3. Should work now!

