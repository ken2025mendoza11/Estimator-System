# Estimator System

Construction cost estimator for request for cost estimates (RCE), cost estimates (CE), approvals, and the official summary. Signed-in staff prepare a document, a different person reviews it, and a final approver accepts it. Line amounts, contingency, and discount are rounded to cents before they are totaled.

## Run locally

```bash
npm install
cp .env.example .env
npm run dev
```

The dev server listens on port 8080. Sign in with a user from the Supabase project (Authentication → Users).

Checks:

```bash
npm run typecheck
npm run lint
npm test
```

## Environment variables

Copy `.env.example` to `.env`. Only these two belong in the browser:

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase publishable / anon key |

Do not put the service-role key in `.env` or in client code. Other server settings, such as the app database URL, are injected by the host on deploy.

## Deploy

```bash
npm run build
```

That builds the app and applies SQL files in `migrations/`. Estimator records live in Supabase. The scripts in `supabase/` are meant to be pasted in the Supabase SQL editor. They are safe to run again. Do not run `supabase/anon-access.sql` after `supabase/apply-secure-access.sql`; that file would open anonymous access again. `supabase/0003_document_safety.sql` adds per-document saves and the private `estimator-files` bucket.
