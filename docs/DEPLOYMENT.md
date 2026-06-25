# Deployment (Netlify)

This app is a Create React App SPA with serverless API routes implemented as Netlify Functions.

## Build settings

Configured in `netlify.toml`:

| Setting | Value |
|---|---|
| Build command | `CI=false npm run build` |
| Publish directory | `build` |
| Functions directory | `netlify/functions` |
| Node version | `20` (pinned via `NODE_VERSION`) |

`CI=false` is required because Create React App treats ESLint warnings as errors when `CI=true` (Netlify's default). It is set in both `netlify.toml` and the `build` script so a dashboard command override can't reintroduce the failure.

## Function dependencies

Netlify does **not** auto-install dependencies declared in a function-level `package.json`. The functions need `firebase-admin` and `stripe` (see `netlify/functions/package.json`), so `netlify.toml` enables:

```toml
[[plugins]]
  package = "@netlify/plugin-functions-install-core"
```

Do **not** commit `netlify/functions/node_modules` — the plugin installs them at build time.

## Routing

- `/api/*` is rewritten to `/.netlify/functions/:splat` (see `netlify.toml` redirects).
- All other non-static routes fall back to `/index.html` (SPA routing).

## Deploy workflow

1. Push to the connected Git branch. Netlify builds automatically.
   - `main` → production
   - PRs → deploy previews
2. Set environment variables in the Netlify dashboard (see `docs/STRIPE.md` and `.env.example`). Changes require a redeploy.
3. Verify the deploy preview before merging.

## Environment variables

- Client variables must be prefixed `REACT_APP_` (baked into the build, publicly visible).
- Server-only secrets (e.g. `STRIPE_SECRET_KEY`, `FIREBASE_PRIVATE_KEY`, `GROQ_API_KEY`) must **not** use the `REACT_APP_` prefix and are set in the Netlify dashboard only.

See `.env.example` for the full list.
