# Troubleshooting

## 404 on checkout / API routes

The client calls `/api/create-checkout-session`, which Netlify rewrites to `/.netlify/functions/create-checkout-session`. A 404 usually means the function isn't reachable.

Checklist:

1. **Redeploy after env var changes.** Netlify env var changes only take effect on a new deploy.
2. **Confirm the function deployed.** Netlify Dashboard → Functions should list `create-checkout-session`.
3. **Test the function directly:** visit `https://your-domain/.netlify/functions/create-checkout-session`. A "Method not allowed" / 405 (not a 404) means it's deployed and the issue is the redirect or URL.
4. **Verify the redirect** in `netlify.toml`:
   ```toml
   [[redirects]]
     from = "/api/*"
     to = "/.netlify/functions/:splat"
     status = 200
     force = true
   ```
5. **Verify env vars** exist in the **Production** scope (not Branch deploys): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `REACT_APP_STRIPE_PUBLISHABLE_KEY`, `REACT_APP_STRIPE_PRODUCT_ID_*`.
6. **Check logs:** browser console for the called URL; Netlify → Functions → logs for runtime errors; Netlify → Deploys → build log for bundling errors.
7. **Clear build cache + redeploy** if a function is missing despite correct config.

## Build fails: "A Netlify Function is using X but that dependency has not been installed"

Netlify does not auto-install function-level `package.json` deps. Ensure `netlify.toml` includes:

```toml
[[plugins]]
  package = "@netlify/plugin-functions-install-core"
```

Do not vendor `netlify/functions/node_modules` into Git.

## Build fails with ESLint warnings (exit code 2 / "Treating warnings as errors")

CRA treats warnings as errors when `CI=true` (Netlify's default). The `build` script and `netlify.toml` both set `CI=false`; confirm neither was overridden in the Netlify dashboard build command.

## Webhook signature verification failed

- Ensure `STRIPE_WEBHOOK_SECRET` matches the current environment's secret (local `stripe listen` vs dashboard endpoint — they differ).
- Restart `netlify dev` after changing `.env`.

## Webhook events not arriving (local)

- `stripe listen` must be running and show "Ready!".
- Forward URL must be `localhost:8888/.netlify/functions/stripe-webhook` (port 8888).
- `netlify dev` must be running.
- Trigger a test: `stripe trigger checkout.session.completed`.

## Works locally but not in production

- Local uses `http://localhost:8888/.netlify/functions`; production uses `/api/*` (redirected).
- Confirm redirects are deployed and the site was redeployed after changes.

See `docs/STRIPE.md` for Stripe specifics and `docs/DEPLOYMENT.md` for build/deploy details.
