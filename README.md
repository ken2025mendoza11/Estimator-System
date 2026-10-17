# Estimator System

Construction cost estimator for requests for cost estimates (RCE), cost estimates (CE), approvals, and the official summary. Signed-in staff prepare a document, a different person reviews it, and a final approver accepts it. Line amounts, contingency, and discount are rounded to cents before they are totaled.

People sign in with the app account (better-auth). They do not sign in with a Supabase user. After sign-in, the server mints a short-lived Supabase JWT so the database sees an authenticated user. The signing secret stays on the server.

## Run locally

```bash
npm install
cp .env.example .env
npm run dev
```

The dev server listens on port 8080. Sign in with the app account.

Checks:

```bash
npm run typecheck
npm run lint
npm test
```

## Environment variables

Copy `.env.example` to `.env`.

| Variable | Where it lives | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Browser | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Browser | Supabase publishable / anon key |
| `SUPABASE_JWT_SECRET` | Server only | Legacy JWT secret from Supabase → Project Settings → JWT Keys. Used to mint the signed-in token. |
| `ESTIMATOR_ALLOWED_EMAILS` | Server only | Comma-separated emails and/or `@domain` entries allowed to get a database token (case-insensitive). Anyone else sees "Your account is not allowed". Empty allows every signed-in account and logs a server warning. |

Do not prefix `SUPABASE_JWT_SECRET` with `VITE_`. Do not put the service-role key in `.env` or in client code. If the two `VITE_` values are missing, the screen says so instead of going blank.

## Deploy

```bash
npm run build
```

That builds the app and applies SQL files in `migrations/`. Estimator records live in Supabase. Do not run `supabase/anon-access.sql` after access has been locked.

### Rollout

Deploy the code before changing the database. The current database keeps working once the server has `SUPABASE_JWT_SECRET`.

1. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET`, and `ESTIMATOR_ALLOWED_EMAILS` (server only, for example `ken@example.com,@yourcompany.com`) on the host. Deploy this code. Do not run SQL yet.
2. Sign in with the app account. Open a record and confirm it loads. Saving stays blocked (the screen asks you to run `apply-v2.sql`) until step 3 is done; reads work. The browser token's role is `authenticated`, and `sub` is the stable user id. A missing secret shows an on-screen error, not a blank page.
3. In the Supabase SQL editor, paste and run `supabase/apply-v2.sql` as one query. It is safe to run again. It does not delete rows.
4. Read the result grid. Every row should say PASS. Check 31 must say that `workspace_docs` exists. Row counts on the backup checks must match.
5. Sign in again. Saving, files, and roles now use the locked database. To make Ken an admin, edit the commented email line at the bottom of `apply-v2.sql` and run that line by itself.

The undo block in that file is commented. Leave it commented unless the signed-in rules have to be reversed. It restores anonymous grants and the policies saved in `policy_backup_20261016`. It does not drop tables or delete rows.
