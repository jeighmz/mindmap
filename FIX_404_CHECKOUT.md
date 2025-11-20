# Fix 404 Error on Checkout - Step by Step

If you're still getting a 404 error after redeploying, follow these steps:

## Step 1: Verify Function is Deployed

1. Go to **Netlify Dashboard** → Your Site → **Functions**
2. Look for `create-checkout-session` in the list
3. If it's **NOT there**, the function isn't being deployed

### If Function is Missing:

1. Check your `netlify.toml` file has:
   ```toml
   functions = "netlify/functions"
   ```

2. Verify the file exists:
   - `netlify/functions/create-checkout-session.js` should exist

3. Check build logs:
   - Netlify Dashboard → Deploys → Latest deploy → Build log
   - Look for errors about functions

4. **Redeploy**:
   - Netlify Dashboard → Deploys → Trigger deploy → Deploy site

## Step 2: Test Function Directly

Try accessing the function directly in your browser:

```
https://yourdomain.com/.netlify/functions/create-checkout-session
```

**Expected result**: You should get an error about "Method not allowed" or "POST required" (NOT a 404)

**If you get 404**: The function isn't deployed. Go back to Step 1.

## Step 3: Check Redirects

The redirect from `/api/*` to `/.netlify/functions/*` should be working.

1. Go to **Netlify Dashboard** → Your Site → **Redirects**
2. You should see a redirect rule for `/api/*`

If the redirect isn't there, your `netlify.toml` might not be deployed. Check that it's committed to Git and redeploy.

## Step 4: Verify Environment Variables

1. Go to **Netlify Dashboard** → Your Site → **Environment variables**
2. Make sure you're looking at **Production** (not Branch deploys)
3. Verify these exist:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `REACT_APP_STRIPE_PUBLISHABLE_KEY`
   - `REACT_APP_STRIPE_PRODUCT_ID_STARTER`
   - `REACT_APP_STRIPE_PRODUCT_ID_PRO`
   - `REACT_APP_STRIPE_PRODUCT_ID_CREATOR_AI`

## Step 5: Check Browser Console

Open browser DevTools → Console and look for:

```
[Stripe] Creating checkout session: { url: '/api/create-checkout-session', ... }
```

If you see this, the code is trying the right URL. The issue is that the endpoint doesn't exist.

## Step 6: Check Function Logs

1. Go to **Netlify Dashboard** → Functions → `create-checkout-session`
2. Click on **Logs** tab
3. Try creating a checkout session again
4. Check if any requests are showing up

**If no requests appear**: The function isn't being reached (404 confirms this)

**If requests appear but fail**: Check the error messages

## Step 7: Force Redeploy

Sometimes a simple redeploy isn't enough. Try:

1. **Clear build cache**:
   - Netlify Dashboard → Site settings → Build & deploy → Clear build cache
   - Then trigger a new deploy

2. **Or trigger deploy from Git**:
   - Make a small change (add a comment to a file)
   - Commit and push
   - This forces a fresh build

## Step 8: Verify netlify.toml is Correct

Check your `netlify.toml` file has these redirects:

```toml
[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200
  force = true
```

Make sure this file is:
- ✅ Committed to Git
- ✅ In the root directory
- ✅ Not ignored by `.gitignore`

## Step 9: Check Build Output

1. Go to **Netlify Dashboard** → Deploys → Latest deploy
2. Click on the deploy to see details
3. Check **Build log** for:
   - Function deployment messages
   - Any errors
   - Warnings about functions

Look for messages like:
```
Functions directory: netlify/functions
```

## Step 10: Manual Function Test

If the function is deployed, you can test it manually:

1. Go to **Netlify Dashboard** → Functions → `create-checkout-session`
2. Click **Invoke** tab
3. Use this test payload:
   ```json
   {
     "httpMethod": "POST",
     "body": "{\"userId\":\"test\",\"productId\":\"prod_test\",\"interval\":\"month\",\"customerEmail\":\"test@test.com\",\"currentTier\":\"FREE\",\"newTier\":\"STARTER\"}"
   }
   ```
4. Click **Invoke function**
5. Check the response

**If this works**: The function is deployed correctly, the issue is with the redirect or URL

**If this fails**: Check the error message in the response

## Common Issues & Solutions

### Issue: Function not in Functions list
**Solution**: 
- Check `netlify.toml` has `functions = "netlify/functions"`
- Verify the file exists at `netlify/functions/create-checkout-session.js`
- Redeploy

### Issue: Function exists but 404 on /api/*
**Solution**:
- Check redirect rules in Netlify Dashboard
- Verify `netlify.toml` redirects are correct
- Try the direct path: `/.netlify/functions/create-checkout-session`

### Issue: Build succeeds but function missing
**Solution**:
- Check build logs for function deployment
- Verify `netlify.toml` is in root directory
- Clear build cache and redeploy

### Issue: Works locally but not in production
**Solution**:
- Local uses `localhost:8888/.netlify/functions`
- Production should use `/api` (redirected)
- Make sure redirects are configured
- Redeploy after any changes

## Quick Checklist

- [ ] Function appears in Netlify Dashboard → Functions
- [ ] Function file exists: `netlify/functions/create-checkout-session.js`
- [ ] `netlify.toml` has `functions = "netlify/functions"`
- [ ] `netlify.toml` has redirect from `/api/*` to `/.netlify/functions/:splat`
- [ ] Environment variables are set (Production)
- [ ] Site has been redeployed after changes
- [ ] Build succeeded (no errors)
- [ ] Direct function path works: `/.netlify/functions/create-checkout-session`
- [ ] Browser console shows correct URL being called

## Still Not Working?

If you've tried everything above:

1. **Check Netlify Status**: https://www.netlifystatus.com/
2. **Contact Netlify Support**: They can check your function deployment
3. **Share these details**:
   - Function appears in Functions list? (Yes/No)
   - Direct function path works? (Yes/No/What error)
   - Build log shows function deployment? (Yes/No)
   - Redirect rules visible in Dashboard? (Yes/No)

---

**Most Common Fix**: Clear build cache + Redeploy! 🚀

