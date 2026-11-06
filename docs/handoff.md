# Estimator System handoff

Written 29 October 2026 from `grok/phase-39` at `357a1d7` (Record the Step 39 draft pull request). This file is a briefing for the next session. It is not a product step and it does not change the app. The step log is [grok-progress.md](grok-progress.md). The go-live checklist is [release1-golive.md](release1-golive.md).

## What this is

A construction cost estimator for Cebu Air. Staff prepare a request for a cost estimate (RCE) and a cost estimate (CE). A different person reviews it. A final approver accepts it. After approval, Sales can add a markup, a proposal, and a job order. Line amounts, contingency, and discount are rounded to cents before they are totaled.

People sign in with the app account (better-auth). They do not sign in as a Supabase user. After sign-in, the server mints a short-lived Supabase JWT. The signing secret stays on the server. Documents live in Supabase. Sign-in users and sessions live in a separate Neon Postgres (`DATABASE_URL`), not in Supabase.

The product line through Release 1 is written. It is not live. The stacked draft pull requests have not been merged to `main`. The Release 1 SQL has not been applied. The test seed has not been run. Mail and the scheduler are not configured. Feature flags default off in the app.

## Where the code is

| Item | Value |
| --- | --- |
| GitHub | [ken2025mendoza11/Estimator-System](https://github.com/ken2025mendoza11/Estimator-System) |
| Remote used for these branches | `estimator` (not `origin`) |
| `origin` | a different repo (`zippy-breeze-jade-lilac`). Do not push phase branches there. |
| Current branch | `grok/phase-39` |
| Current head | `357a1d7` Record the Step 39 draft pull request. |
| Feature commit under that | `0549ee3` Spell the live Neon endpoint correctly. |
| Open draft PR | https://github.com/ken2025mendoza11/Estimator-System/pull/38 into `grok/phase-38` |
| `main` | far behind this stack. Do not merge this work onto `main` unless Ken says so. |

Each step is its own branch, stacked on the previous step, with one draft PR into the previous branch. Do not rebase, force-push, or merge `grok/phase-29` through `grok/phase-39`. Do not change Vercel, Supabase, or Neon settings from a coding step.

Author on these commits (env vars only, do not change git config): `ken2025mendoza11` / `323184618+ken2025mendoza11@users.noreply.github.com`.

## How to check it

```bash
npm ci
npm test
npm run typecheck
npm run lint
npm run build
```

Last full run on `grok/phase-39` (29 Oct 2026): `npm test` 433 + 99, 0 failures. `tsc` 0. `eslint` 0 errors, 217 warnings. Build ok. Do not add a new lint warning. `@tanstack/react-start` is `1.168.60`. Do not drop below that (Vercel refuses older versions).

Dev server: `npm run dev` on port 8080. A local preview is not required to finish a step.

Golden totals, locked and unchanged: **27,362.51 / 95,682.28 / 31,692.31 / 154,737.10**.

## Two databases

**Supabase** holds estimator documents (`workspace_docs`), files (`estimator-files`), roles, and numbering.

| Which | Project ref | Host |
| --- | --- | --- |
| Test / preview | `nqxijgsbpffewizzefwi` | `https://nqxijgsbpffewizzefwi.supabase.co` |
| Live | `rgppzzwitldwbfkgezoz` | `https://rgppzzwitldwbfkgezoz.supabase.co` |

The seed allows only the test host, and only when the hostname is exactly that one label plus `.supabase.co`. A longer host that merely contains the ref is refused.

**Neon** holds sign-in users and sessions. Both the test project and the live project name the database `neondb`, so the database name cannot tell them apart. The seed checks the endpoint id: the first label of the `DATABASE_URL` host, with one trailing `-pooler` removed.

| Which | Neon project | Endpoint id |
| --- | --- | --- |
| Test sign-in (`estimator-test-auth`, project `sweet-wave-03277146`) | allowed | `ep-jolly-sound-azpo5a4b` |
| Live sign-in (`estimator-auth`, project `frosty-boat-59654501`) | refused | `ep-wandering-morning-aocsri1h` |

The allow-list is `TEST_SIGN_IN_ENDPOINTS` in [scripts/seed-safety.mjs](../scripts/seed-safety.mjs). It holds only the test endpoint. With or without `-pooler` that id is allowed. The live id, an unknown id, and a longer name that only contains the test id are refused. The seed prints `Supabase project:` and `Sign-in endpoint:` and never prints the password or the full address.

`--fixture-only` writes the local fixture and returns before those checks. It does not contact a database.

Vercel previews may use their own Neon branch of the test sign-in project (`preview/grok/...`), copied from main when the branch is created. Users seeded into main show up only in a preview whose branch is created or reset after the seed. How the current preview `DATABASE_URL` is set, and whether it points at the main endpoint or a branch endpoint, is not known from this repo. Do not guess it. Do not change the Vercel or Neon setting to find out.

## Architecture, short

- UI: TanStack Start / React. The large screen is [src/components/CostEstimatorApp.jsx](../src/components/CostEstimatorApp.jsx). Release 1 panels sit beside it (`MarkupPanel`, `ProposalPanel`, `JobOrderPanel`, `Release1Admin`).
- Sign-in: better-auth, routes under `src/routes/api/auth/` and `src/lib/auth/`. Test picker (staff, lead, head, admin) exists only when `ESTIMATOR_TEST_LOGIN` is `1`, `VERCEL_ENV` is not `production`, and `ESTIMATOR_TEST_SUPABASE_URL` equals `VITE_SUPABASE_URL`.
- Documents: `src/lib/estimator/workspace-docs.ts` and `supabase-workspace.ts`. Kinds include `ce`, `markup`, `proposal`. Job orders are merged into the schema document. Markups are their own documents. They are not written onto a locked estimate.
- Server routes for Release 1: `POST /api/release1-escalate` and `POST /api/release1-mail`. Both need a signed-in user or the header `x-release1-scheduler` matching `RELEASE1_SCHEDULER_SECRET`. An empty secret never matches.
- Money: `src/lib/estimator/ceTotals.js`, `elCalcs.js`, `money.js`. Do not recompute the golden totals.
- Philippines time: `phTime.js`, `phCalendar.js`.

## Directory map

```
/workspace
  README.md                  run, env vars, deploy, test sign-in
  docs/
    grok-progress.md         step table and what each step shipped
    release1-golive.md       SQL order, flags, seed, smoke checks
    handoff.md               this file
  src/
    components/              screens. CostEstimatorApp.jsx is the app.
    routes/                  pages and API routes
    lib/auth/                better-auth, test login, gates
    lib/app-data/            connector / readiness
    lib/estimator/           domain logic and most tests
    lib/supabase/            JWT mint, allow-list, session
  scripts/                   seed, migrate, brand check, smoke helpers
  supabase/                  SQL Ken runs by hand, plus a matching rollback
  migrations/                sign-in tables for DATABASE_URL (Neon), not Supabase
  public/                    fonts used by PDFs, favicon
  server/                    small middleware
```

Do not commit `.env`, `.vercel`, `.grok/`, `attachments/`, or `artifacts/`. `attachments/` is source material (CE summary PDFs, freight calculator, inspection form, screenshots). It is not part of the app.

### Estimator modules that matter

| Area | Files |
| --- | --- |
| Totals and goldens | `ceTotals.js`, `ceTotals.golden.test.mjs`, `__fixtures__/ce-examples.json` |
| Approvals | `approvalEngine.js`, `reminders.js`, `signatures.js` |
| Numbers | `docNumbers.js`, `docSuffixes.js` |
| Lock, sales, requests | `ceLock.js`, `salesView.js`, `ceRequest.js` |
| Markup, proposal, job order | `markup.js`, `proposal.js`, `proposalDocx.js`, `jobOrder.js`, `jobOrderPdf.js` |
| Monitor, mail, store | `release1Monitor.js`, `release1Mail.server.js`, `release1Store.server.js` |
| Reports, checker, route/fuel | `reports.js`, `checker.js`, `routeFuel.js` |
| Departments and accounts | `departments.js` |
| Seed safety | `scripts/seed-safety.mjs`, `scripts/seed-test.mjs` |

## What the app can do

Flags default **off** in the app. The TEST seed turns the Release 1 flags and `approvalEngineV2` on. It does **not** turn on `checkerV2` or `docSuffixes`. Leave those two off until Ken turns the whole set on together, and only after the SQL for that project is applied.

Turn on together, in Admin, after SQL:

`approvalEngineV2`, `checkerV2`, `docSuffixes`, `release1Departments`, `release1SalesView`, `release1WithdrawRequest`, `release1Markup`, `release1Proposal`, `release1JobOrder`, `release1Monitor`.

### Already in the product (behind those flags where noted)

- RCE and CE, official summary, line math, contingency, discount. Four direct examples locked to the golden totals.
- Approval engine: submit, review, final accept, take-over, closing, reminders, in-app notices. Timeline `who` is the account id. Timeline `at` is an ISO time. Screens and documents show names, never account ids.
- Signatures. A backup signs `for <primary approver name>`. DRAFT watermark. Inspection stays DRAFT until it should not.
- Document numbers and suffixes (suffix flag stays off until Ken turns it on).
- Monitoring families, Scope Library, price check, equipment rates, reports, mobile viewer.
- Pre-submit checker (`checkerV2`, off until Ken turns it on).
- Quotations, availability, locations, pending records.
- Route and fuel calculator.
- SOW tagging, Gantt, project schedule, export order.
- Sign-in and sign-up UI. Admin and the caller role follow the signed-in user id.
- Departments and approver lists.
- An approved CE is locked. Sales is view-only on it. Sales can withdraw an RCE and request a CE.
- Markup is its own document on an approved estimate. It uses the stored direct cost. It is not written onto the locked estimate.
- Proposal with Word and PDF. Selling price is the proposal total. A proposal can be revised from Approved, Sent, or Expired. Only the owner or an admin changes or releases a PR number. An empty PR does not delete another proposal.
- Job order from an approved or sent proposal. Number shape `JO-<3 digits>-<SW|F|T|O>-<client code>-<YY>-<proposal control>`. First issue has no REV. A revision is `JO-001-SW-ABC-26-0137REV001` (no hyphen before REV) and is registered. The 3-digit sequence restarts at 001 each year. The PDF is the SY3 form. The quantities attachment is a PDF with no prices. The PO or NTP file goes to `estimator-files`. The job order stores the path, not the bytes. More than one estimate can be linked.
- Award: an approved job order sets the linked estimate to Awarded and the proposal to Won. Cancel puts both back to the status from before the award. The estimate does not gain `awardStatus` or `awardJo`. The schema document (job orders) is saved before the estimate so the database check can see the job order. A locked estimate becomes Awarded only when that approved job order is already stored.
- Deleting a never-submitted draft keeps the proposal (`deleted`, `deletedAt`, timeline). It does not remove the row. The PR is released through the owner check. Deleted drafts are hidden from the Sales worklist, proposal aging, and dashboard counts. A deleted Lost does not change that sales rep's win rate. Overall win rate stays on cost estimates only. A Lost proposal counts as a loss on that sales rep's win rate.
- Sales monitor: proposals and job orders with status, age, and who holds them. At 12 hours the row is coloured `#b45309`. Escalation is server-side. Twelve hours moves the step to the backup. Another twelve hours moves it to the next approver. The same step is not repeated. An already expired proposal is skipped. The browser does not start escalation.
- Mail uses fixed templates only (`needs-approval`, `approved`, `returned`, `escalated`, `expiring`, `ce-approved`). The body is `{ toUserId, template, docId, kind }`. The server looks up the label. Free text is refused. A `ce-approved` mail and a markup mail both use the CE number on the stored estimate, not the internal id and not a proposal or job order that shares that estimate. If the markup's estimate has no document number, the mail is not sent. Mail goes only to a roster address.
- A notification version conflict is re-read and retried up to 3 times. The response includes `noticeSave` (`ok`, `attempts`, `conflict`). Documents are saved once, so a retry does not write them again with a stale version. Mail is not sent for a document whose save failed.
- The escalate route ignores any clock in the request and uses the server time.
- Remarks use a required remark box. New code does not use `window.prompt`, `alert`, or `confirm`.
- Nothing is hard-deleted. A "delete" keeps the row and hides it.

### Seed

`npm run seed:test` on the test projects only. It upserts. It does not delete rows. It writes one sample at each stage (accepted RCE, done CE, approved markup, approved proposal, submitted job order, Awarded) for staff, lead, head, and admin, plus Test Sales, Test Sales Two, and Test Sales Manager. Sample counters move to proposal 3614 and year 26 sequence 14. It was not run from this workspace.

## Progress

One step per turn. Do not start the next step until Ken says `continue`. Step 18 (Phase 11, past estimates and document formats) is **skipped**. There is no Step 18 branch.

| Steps | What they are | PRs |
| --- | --- | --- |
| 1–10 | Test sign-in, golden totals, data safety, access, stable ids, CE computation, calculator, approvals, signatures | [#1](https://github.com/ken2025mendoza11/Estimator-System/pull/1)–[#10](https://github.com/ken2025mendoza11/Estimator-System/pull/10) |
| 11–17 | Monitoring through schedule, then login UI | [#11](https://github.com/ken2025mendoza11/Estimator-System/pull/11)–[#17](https://github.com/ken2025mendoza11/Estimator-System/pull/17) |
| 18 | Phase 11 past estimates | skipped |
| 19–25 | Seed examples, role by id, rollback safety, sample data, preview, view-only save, no save on load | [#18](https://github.com/ken2025mendoza11/Estimator-System/pull/18)–[#24](https://github.com/ken2025mendoza11/Estimator-System/pull/24) |
| 26–28 | Departments, CE lock, Sales view-only, RCE withdraw | [#25](https://github.com/ken2025mendoza11/Estimator-System/pull/25)–[#27](https://github.com/ken2025mendoza11/Estimator-System/pull/27) |
| 29–33 | Markup, proposal, job order, monitor and mail, go-live checklist | [#28](https://github.com/ken2025mendoza11/Estimator-System/pull/28)–[#32](https://github.com/ken2025mendoza11/Estimator-System/pull/32) |
| 34–39 | Release 1 review and five fix rounds, then the live endpoint spelling | [#33](https://github.com/ken2025mendoza11/Estimator-System/pull/33)–[#38](https://github.com/ken2025mendoza11/Estimator-System/pull/38) |

Detail for each step, including the commit subjects, is in [grok-progress.md](grok-progress.md). Read the newest step first (Step 39 is above Step 38 in that file).

### Latest fix rounds, so the next person does not undo them

- **36 / PR #35.** CE-approved mail loads the stored CE and uses the CE number. The browser sends `kind`. A notification version conflict retries up to 3 times. Deleted drafts stay stored and are hidden from Sales worklist, aging, and dashboard counts. Nothing in the repo explains a Vercel preview that dies about 2 seconds after start while `npm run build` passes. No `vercel.json`. Do not change Vercel settings to chase it.
- **37 / PR #36.** Seed refuses anything that is not the test Supabase project. Markup mail uses the CE number, with no fallback to the internal id.
- **38 / PR #37.** The sign-in check is the Neon endpoint, not the database name. Allow-list is only `ep-jolly-sound-azpo5a4b`.
- **39 / PR #38.** The live endpoint is `ep-wandering-morning-aocsri1h` (c, not t). `git grep aotsri1h` is empty.

## SQL Ken still has to run

Nothing in this repo runs these files. Ken pastes them into the Supabase SQL editor, one at a time, on `estimator-test` first, after a backup. If a script fails, stop. Roll back only what was applied, in reverse.

| Order | Script |
| --- | --- |
| 1 | `supabase/p1a-numbering-2026-10-20.sql` |
| 2 | `supabase/p1b-access-2026-10-20.sql` |
| 3 | `supabase/p4-calc-constants-2026-10-20.sql` |
| 4 | `supabase/p5-numbering-suffixes-2026-10-20.sql` |
| 5 | `supabase/p8-quotations-2026-10-20.sql` |
| 6 | `supabase/p9-route-fuel-2026-10-20.sql` |
| 7 | `supabase/p10-schedule-2026-10-20.sql` |
| 8 | `supabase/plui-signup-2026-10-20.sql` |
| 9 | `supabase/p2-approvals-2026-10-20.sql` |
| 10 | `supabase/p19-active-user-2026-10-20.sql` |
| 11 | `supabase/p20-role-by-id-2026-10-20.sql` |
| 12 | `supabase/p26-departments-approvers-2026-10-28.sql` |
| 13 | `supabase/p27-ce-lock-2026-10-28.sql` |
| 14 | `supabase/p30-proposal-2026-10-28.sql` |
| 15 | `supabase/p31-job-order-2026-10-28.sql` |
| 16 | `supabase/p34-release1-2026-10-28.sql` |
| 17 | `supabase/p35-release1-2026-10-28.sql` |

There is no `p36`, `p37`, `p38`, or `p39` SQL. Steps 32, 33, and 36–39 added none.

`p30` before proposal numbers. `p31` before job order numbers. `p34` after both. `p35` after `p34`. The `p30` rollback deletes saved proposals. The `p34` rollback deletes saved markups (`delete from workspace_docs where kind = 'markup'`) and restores the older empty-PR delete. The `p35` rollback does not delete markups or proposals. Back up before either of those rollbacks.

Older one-time access lock, separate from the table above, is described in [README.md](../README.md): deploy code first, then `supabase/apply-v2.sql`. Do not run `supabase/anon-access.sql` after access is locked. Sign-in tables (`migrations/0001_auth.sql`, `migrations/0002_estimator.sql`) go into Neon via `npm run db:migrate`, not into Supabase. Builds do not migrate unless `AUTH_MIGRATE_ON_BUILD=1`.

## Rules the next change must keep

- Draft PRs only until Ken says to merge. No merges, no rebases, no force-push of the phase branches.
- Do not run SQL. Do not run the seed unless Ken asks, and then only against the test Supabase ref and the test Neon endpoint.
- Do not change Vercel, Supabase, or Neon settings.
- Flags default false. Do not turn `checkerV2` or `docSuffixes` on in code.
- No hard deletes. A removed draft stays stored and is hidden.
- Every change that mutates a document writes a timeline entry: account id plus ISO time. Do not invent a timeline entry for a change that does not touch a document.
- Names on screens, documents, and emails. Account ids only in the timeline and in stored identity fields.
- A backup signature reads `for <primary approver name>`.
- Golden totals stay 27,362.51 / 95,682.28 / 31,692.31 / 154,737.10.
- No `window.prompt`, `alert`, or `confirm` in new or changed code.
- Tests call the app's real functions. Do not copy the logic into the test.
- No new lint warnings. Stay at 0 errors and 217 warnings unless Ken accepts a new one.
- If a requirement is unclear, stop and ask. Do not guess.
- State for a shipped step goes in [grok-progress.md](grok-progress.md): a table row, then a section inserted before the previous step. The first commit leaves the PR cell empty. The second commit, after `gh pr create --draft`, fills the URL. Message: `Record the Step N draft pull request.`

## What is not done

These are open on purpose. They are not bugs to "fix" by guessing.

1. The draft PR stack is not merged to `main`.
2. SQL order 1 through 17 is not applied on test or on live.
3. `npm run seed:test` has not been run.
4. `RELEASE1_MAIL_KEY`, `RELEASE1_MAIL_URL`, and `RELEASE1_MAIL_FROM` are empty. Empty key skips the send and logs that, without the key.
5. `RELEASE1_SCHEDULER_SECRET` is not set. Do not configure a cron from this repo. Ken, or a scheduler Ken controls, POSTs `/api/release1-escalate`.
6. `checkerV2` and `docSuffixes` stay off until Ken turns the flag set on together.
7. Phase 11 (past estimates and document formats) was skipped. Do not build it unless Ken asks.
8. A Vercel preview that stops about two seconds after start is not explained by this repo. Local `npm run build` passes. Settings were not changed.
9. It is unknown whether current Vercel previews point `DATABASE_URL` at `ep-jolly-sound-azpo5a4b` or at a `preview/grok/...` branch endpoint, and how that URL is set.

## What a sensible next plan is

Ken decides the order. A coding agent does not start the next item until Ken says so.

1. Ken reviews the open draft stack, starting from the latest ([PR #38](https://github.com/ken2025mendoza11/Estimator-System/pull/38)) back through the Release 1 PRs, and merges only when he says to.
2. On `estimator-test` only: backup, run SQL 1 through 17, then turn the flag set on together, including `checkerV2` and `docSuffixes` for the smoke checks.
3. Set the test Neon `DATABASE_URL` to the main endpoint `ep-jolly-sound-azpo5a4b` (pooler or not) and run `npm run seed:test`. Confirm the printed project ref and endpoint before it writes.
4. Walk the smoke table in [release1-golive.md](release1-golive.md).
5. Choose a mail provider and set the three mail env vars on the server. Set `RELEASE1_SCHEDULER_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` on the server. Point a scheduler Ken controls at `POST /api/release1-escalate`. Do not add a cron in this repo.
6. Answer the preview `DATABASE_URL` question before relying on a Vercel preview for sign-in. A preview branch created before the seed will not have the seeded users until that branch is created or reset.
7. Repeat the backup and the SQL on the live Supabase project only after test smoke checks pass. The seed must never be pointed at live. The live endpoint stays off the allow-list.
