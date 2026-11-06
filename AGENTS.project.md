# Estimator-System safety rules

These rules override the generic "ship a demo" advice in `AGENTS.md`. Sandbox rules still apply (Node, port 8080, `startup.sh`).

1. One branch per step: `grok/phase-<ID>`. One draft PR. Base it on `main`. Never push to `main`, merge, force-push, rebase pushed commits, or use `--no-verify`.
2. Before the first edit in a step, record `npm test`, `npm run build`, `tsc --noEmit`, and `eslint`. End at 0 test failures, a green build, 0 tsc errors, and 0 eslint errors. Do not add warnings beyond the baseline plus new files.
3. From Step 2 on, golden totals are locked. A changed legacy total stops the step.
4. `ce.pricing.model` missing means `legacy` (today's maths). Only `direct-v1` cost estimates get new totals. Non-draft estimates stay legacy. A draft switches only by an explicit owner action after a banner.
5. Additive only. Do not delete, rename, or retype stored tables, columns, functions, policies, buckets, JSON keys, doc kinds, status values, routes, or exports. Do not rewrite stored data.
6. Do not touch auth server wiring, the Supabase JWT mint (`stableUserUuid`, namespace, token lifetime, claims), `migrations/**`, existing `supabase/*.sql`, `money.js`, or `computeSchedule`, unless the step's allowed list names that file.
7. New SQL is a new idempotent file plus a rollback file. Never run SQL. The app must keep working when the new table, column, or function is missing.
8. Feature flags live in `adminConfig.features.<flag>` and default to off. Bug fixes in Steps 3–7 ship on.
9. New logic goes in new modules under `src/lib/estimator/` with tests. New UI goes in new files under `src/components/`. No new dependency unless the step names it.
10. Never read or commit `.env`, `.vercel/`, keys, or real emails. New env vars go in `.env.example`, empty, and a server secret is never a `VITE_` variable.
11. Asia/Manila for displayed times, once `phTime.js` exists. Stored timestamps stay ISO UTC.
12. `isTestDeployment` is true only when `ESTIMATOR_TEST_LOGIN` is `1`, `VERCEL_ENV` is not `production`, and `ESTIMATOR_TEST_SUPABASE_URL` equals `VITE_SUPABASE_URL`. Test sign-in uses only that guard.
13. Stop and ask when a spec item is unclear, a golden total would change, or a file outside the step's allowed list is required.
14. State lives in `docs/grok-progress.md`. Do one step per turn.
