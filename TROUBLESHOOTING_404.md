# Troubleshooting: 404 Error on Checkout Session Creation

If you're seeing a "Page not found" (404) error when trying to create a checkout session, follow these steps:

## Quick Fix: Redeploy Your Site

**The most common cause**: After changing Netlify environment variables, you **must redeploy** your site for the changes to take effect.

1. Go to Netlify Dashboard → Your Site → Deploys
2. Click "Trigger deploy" → "Deploy site"
3. Wait for the deployment to complete
4. Try the checkout again

## Verify Environment Variables Are Set

1. Go to Netlify Dashboard → Your Site → Environment variables
2. Make sure you're looking at **Production** environment (not Branch deploys)
3. Verify these variables exist:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `REACT_APP_STRIPE_PUBLISHABLE_KEY`
   - `REACT_APP_STRIPE_PRODUCT_ID_STARTER`
   - `REACT_APP_STRIPE_PRODUCT_ID_PRO`
   - `REACT_APP_STRIPE_PRODUCT_ID_CREATOR_AI`

## Check API Endpoint

The code should be calling: `/api/create-checkout-session`

This gets redirected by Netlify to: `/.netlify/functions/create-checkout-session`

### Verify the Function Exists

1. Check that `netlify/functions/create-checkout-session.js` exists in your codebase
2. Verify it's being deployed:
   - Go to Netlify Dashboard → Functions
   - You should see `create-checkout-session` listed

### Check Browser Console

Open browser DevTools → Console and look for:
```
[Stripe] Creating checkout session: { url: '/api/create-checkout-session', ... }
```

If you see a 404 error, check:
- What URL is being called
- Whether the site has been redeployed

## Verify Netlify Redirects

Check your `netlify.toml` file has these redirects:

```toml
[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200
  force = true
```

## Common Issues

### Issue 1: Environment Variables Not Applied
**Symptom**: 404 error after changing variables
**Solution**: Redeploy the site

### Issue 2: Wrong Environment
**Symptom**: Variables set in "Branch deploys" but not "Production"
**Solution**: Make sure variables are set for "Production" environment

### Issue 3: Function Not Deployed
**Symptom**: Function doesn't appear in Netlify Functions list
**Solution**: 
- Check `netlify.toml` has `functions = "netlify/functions"`
- Redeploy the site
- Check build logs for errors

### Issue 4: Build Failed
**Symptom**: Latest deploy shows "Failed" status
**Solution**: 
- Check build logs for errors
- Fix any build errors
- Redeploy

## Testing Steps

1. **Check the URL being called**:
   - Open browser DevTools → Network tab
   - Try to create a checkout session
   - Look for the request to `/api/create-checkout-session`
   - Check the response status

2. **Verify function is accessible**:
   - Try visiting: `https://yourdomain.com/.netlify/functions/create-checkout-session`
   - You should get an error about missing POST method (not 404)
   - If you get 404, the function isn't deployed

3. **Check Netlify Functions dashboard**:
   - Go to Netlify Dashboard → Functions
   - Verify `create-checkout-session` is listed
   - Check recent invocations for errors

## Still Not Working?

1. **Check build logs**:
   - Netlify Dashboard → Deploys → Latest deploy → Build log
   - Look for any errors during build

2. **Check function logs**:
   - Netlify Dashboard → Functions → create-checkout-session → Logs
   - Look for any runtime errors

3. **Verify file structure**:
   ```
   netlify/
     functions/
       create-checkout-session.js  ← Should exist
   ```

4. **Test locally**:
   ```bash
   netlify dev
   ```
   - Try creating a checkout session locally
   - If it works locally but not in production, it's a deployment issue

## Quick Checklist

- [ ] Environment variables are set in Netlify (Production)
- [ ] Site has been redeployed after setting variables
- [ ] `netlify/functions/create-checkout-session.js` exists
- [ ] Function appears in Netlify Dashboard → Functions
- [ ] `netlify.toml` has correct redirects
- [ ] Build succeeded (check Deploys)
- [ ] No errors in browser console
- [ ] No errors in Netlify function logs

---

**Most likely fix**: Redeploy your site! 🚀

