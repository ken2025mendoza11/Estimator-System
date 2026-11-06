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
| `BETTER_AUTH_URL` | Server only | Public origin, e.g. `https://estimator-system.vercel.app` (no trailing slash). |
| `BETTER_AUTH_SECRET` | Server only | Long random string (`openssl rand -hex 32`). Required when deployed; without it sign-in is refused and /login shows a setup message. |
| `DATABASE_URL` | Server only | Postgres for sign-in users and sessions. Use a separate Neon or Vercel Postgres database, not Supabase. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Server only | Google OAuth client (Google Cloud Console → APIs & Services → Credentials → OAuth client ID → Web application). Authorized redirect URI: `https://estimator-system.vercel.app/api/auth/callback/google`. Used when the Grok auth vars (`GROK_AUTH_CLIENT_ID` / `GROK_AUTH_CLIENT_SECRET`) are not set. |
| `AUTH_MIGRATE_ON_BUILD` | Server only | Optional. `1` makes `npm run build` apply `migrations/` to `DATABASE_URL`. Unset: builds never touch a database. |
| `ESTIMATOR_ALLOWED_EMAILS` | Server only | Comma-separated emails and/or `@domain` entries allowed to get a database token (case-insensitive). Anyone else sees "Your account is not allowed". Empty allows every signed-in account and logs a server warning. |
| `ESTIMATOR_TEST_LOGIN` | Server only | Exactly `1` on a non-production test deployment. Otherwise the fake-user picker stays hidden. |
| `ESTIMATOR_TEST_SUPABASE_URL` | Server only | Must equal `VITE_SUPABASE_URL` or the test tools stay off. |
| `ESTIMATOR_TEST_PASSWORD` | Server only | Shared password for the four fake test users. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Seed script only. Never prefix with `VITE_`. |

Do not prefix `SUPABASE_JWT_SECRET` with `VITE_`. Do not put the service-role key in `.env` or in client code. If the two `VITE_` values are missing, the screen says so instead of going blank.

## Deploy

```bash
npm run build
```

That builds the app. It does not touch any database unless `AUTH_MIGRATE_ON_BUILD=1` is set. Estimator records live in Supabase.

### Sign-in database (one time)

The sign-in tables (`migrations/0001_auth.sql`, `migrations/0002_estimator.sql`) go into the `DATABASE_URL` Postgres (Neon / Vercel Postgres, not Supabase). Create them once, either way:

- From a computer: `DATABASE_URL="postgres://…" npm run db:migrate`
- Or on Vercel: set `AUTH_MIGRATE_ON_BUILD=1`, redeploy once, then remove it.

Safe to re-run: applied files are recorded in a `_migrations` table and skipped. Do not run `supabase/anon-access.sql` after access has been locked.

### Rollout

Deploy the code before changing the database. The current database keeps working once the server has `SUPABASE_JWT_SECRET`.

1. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET`, and `ESTIMATOR_ALLOWED_EMAILS` (server only, for example `ken@example.com,@yourcompany.com`) on the host, plus the sign-in settings `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and create the sign-in tables (see "Sign-in database"). Deploy this code. Do not run SQL yet.
2. Sign in with the app account. Open a record and confirm it loads. Saving stays blocked (the screen asks you to run `apply-v2.sql`) until step 3 is done; reads work. The browser token's role is `authenticated`, and `sub` is the stable user id. A missing secret shows an on-screen error, not a blank page.
3. In the Supabase SQL editor, paste and run `supabase/apply-v2.sql` as one query. It is safe to run again. It does not delete rows.
4. Read the result grid. Every row should say PASS. Check 31 must say that `workspace_docs` exists. Row counts on the backup checks must match.
5. Sign in again. Saving, files, and roles now use the locked database. To make Ken an admin, edit the commented email line at the bottom of `apply-v2.sql` and run that line by itself.

The undo block in that file is commented. Leave it commented unless the signed-in rules have to be reversed. It restores anonymous grants and the policies saved in `policy_backup_20261016`. It does not drop tables or delete rows.

## Test deployment

Do not open any Preview URL until it points at the test projects.

The fake-user picker (staff, lead, head, admin) and email/password sign-in exist only when all of these are true:

- `ESTIMATOR_TEST_LOGIN` is exactly `1`
- `VERCEL_ENV` is not `production`
- `ESTIMATOR_TEST_SUPABASE_URL` is set and equals `VITE_SUPABASE_URL`

Passwords come from `ESTIMATOR_TEST_PASSWORD`. Without those variables, `/login` matches production and `POST /api/auth/sign-in/email` returns 404.

Seed the test project (it refuses to run if the URL does not match, and it does not delete rows):

```bash
npm run seed:test
```

That writes users into `DATABASE_URL`, roles and sample documents into the test Supabase project, and refreshes `src/lib/estimator/__fixtures__/legacy-ce.json`.


<!-- Deployed to Vercel project estimator-system on 2026-10-17. -->
