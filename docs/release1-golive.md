# Release 1 go-live

Ken runs this. This file does not apply SQL, does not change a Vercel project, and does not turn flags on in production.

Do this on `estimator-test` first. Take a backup before the first script. Repeat the backup before production. If a script fails, stop. Run the rollbacks below in reverse order only for the scripts that were applied. Do not drop tables or columns that were already there.

## Backup first

1. In the Supabase project you are about to change, take a backup (or a snapshot) and keep it until the smoke checks pass.
2. Confirm the project is the one you mean. The seed refuses any host that is not `estimator-test`.
3. Apply the scripts in the SQL editor, one file at a time, in the order below.

## SQL, in order

These are the scripts through Step 35. Step 32 and Step 33 add no SQL. Skip a file only if that exact version is already applied.

| Order | Script | Undo |
| --- | --- | --- |
| 1 | `supabase/p1a-numbering-2026-10-20.sql` | `supabase/p1a-numbering-2026-10-20-rollback.sql` |
| 2 | `supabase/p1b-access-2026-10-20.sql` | `supabase/p1b-access-2026-10-20-rollback.sql` |
| 3 | `supabase/p4-calc-constants-2026-10-20.sql` | `supabase/p4-calc-constants-2026-10-20-rollback.sql` |
| 4 | `supabase/p5-numbering-suffixes-2026-10-20.sql` | `supabase/p5-numbering-suffixes-2026-10-20-rollback.sql` |
| 5 | `supabase/p8-quotations-2026-10-20.sql` | `supabase/p8-quotations-2026-10-20-rollback.sql` |
| 6 | `supabase/p9-route-fuel-2026-10-20.sql` | `supabase/p9-route-fuel-2026-10-20-rollback.sql` |
| 7 | `supabase/p10-schedule-2026-10-20.sql` | `supabase/p10-schedule-2026-10-20-rollback.sql` |
| 8 | `supabase/plui-signup-2026-10-20.sql` | `supabase/plui-signup-2026-10-20-rollback.sql` |
| 9 | `supabase/p2-approvals-2026-10-20.sql` | `supabase/p2-approvals-2026-10-20-rollback.sql` |
| 10 | `supabase/p19-active-user-2026-10-20.sql` | `supabase/p19-active-user-2026-10-20-rollback.sql` |
| 11 | `supabase/p20-role-by-id-2026-10-20.sql` | `supabase/p20-role-by-id-2026-10-20-rollback.sql` |
| 12 | `supabase/p26-departments-approvers-2026-10-28.sql` | `supabase/p26-departments-approvers-2026-10-28-rollback.sql` |
| 13 | `supabase/p27-ce-lock-2026-10-28.sql` | `supabase/p27-ce-lock-2026-10-28-rollback.sql` |
| 14 | `supabase/p30-proposal-2026-10-28.sql` | `supabase/p30-proposal-2026-10-28-rollback.sql` |
| 15 | `supabase/p31-job-order-2026-10-28.sql` | `supabase/p31-job-order-2026-10-28-rollback.sql` |
| 16 | `supabase/p34-release1-2026-10-28.sql` | `supabase/p34-release1-2026-10-28-rollback.sql` |
| 17 | `supabase/p35-release1-2026-10-28.sql` | `supabase/p35-release1-2026-10-28-rollback.sql` |

`p30` must be applied before a proposal number can be taken. `p31` must be applied before a job order number can be taken. `p34` comes after both. It lets an award or a cancel change a locked estimate, stores markups as their own kind, refuses a job order number that is already taken, restarts the job order sequence each year, and stops an empty PR number from deleting another proposal. `p35` comes after `p34`. Only the seed (the service role) can advance the sample counters, and that function will not move the proposal sequence backwards. A locked estimate becomes Awarded only when an approved job order that links it is already stored. Cancel is allowed only when that job order is already cancelled. The app saves the schema document, which holds the job orders, before the estimate, so that check can see the job order. Releasing a draft's PR number clears that claim. It does not delete the proposal. The app still saves when those functions are missing; the new buttons explain that and do not write the document.

The `p30` rollback deletes saved proposals (`delete from workspace_docs where kind = 'proposal'`). Back up first. The `p34` rollback does not delete proposals, but it does delete saved markups (`delete from workspace_docs where kind = 'markup'`). Back up before that rollback. It also restores the older claim functions, including the empty-PR delete, so do not roll `p34` back unless you mean to. The `p35` rollback does not delete markups or proposals. It restores the p34 counter function and the p34 estimate guard.

## Rollback order

Reverse of the table, and only for scripts that were applied: 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1. Each rollback file removes only what its script added. Do not run a later rollback before the script that depends on it has been undone.

## Flags to turn on together

Leave them off until the SQL above has been applied on that project. Turn these on in Admin as one set:

- `approvalEngineV2` — approval engine
- `checkerV2` — checker
- `docSuffixes` — numbering suffixes
- `release1Departments`
- `release1SalesView`
- `release1WithdrawRequest`
- `release1Markup`
- `release1Proposal`
- `release1JobOrder`
- `release1Monitor`

The TEST seed turns the Release 1 flags and `approvalEngineV2` on. It does not turn `checkerV2` or `docSuffixes` on. Turn those two on by hand for the smoke checks.

Email stays empty until you choose a provider. Server only, never `VITE_`:

- `RELEASE1_MAIL_KEY`
- `RELEASE1_MAIL_URL`
- `RELEASE1_MAIL_FROM`

An empty key skips mail and logs that the send was skipped. The key is not written in the log.

Escalation and expiring notices run on the server. They read and save the stored documents, and they also write the in-app notice onto the notifications record. The browser does not start them. Set `RELEASE1_SCHEDULER_SECRET` on the server only (empty in `.env.example`, no `VITE_` prefix). Also set `SUPABASE_SERVICE_ROLE_KEY` on the server so the route can read the roster and the documents. Do not configure a cron from this repo.

A scheduler Ken controls can POST `/api/release1-escalate` with header `x-release1-scheduler: $RELEASE1_SCHEDULER_SECRET`. The route ignores any clock in the request and uses the server time. Twelve hours moves the step to its backup. Another twelve hours moves it to the next approver. The same step is not repeated. An already expired proposal is skipped. A save writes only when the stored version still matches. Mail is not sent for a document whose save failed. Mail from that route uses the fixed templates and only roster addresses. `/api/release1-mail` accepts the same header, or a signed-in user. The body is `{ "toUserId", "template", "docId" }`. The server looks up the document label from the stored documents. It does not accept free text. Templates: `needs-approval`, `approved`, `returned`, `escalated`, `expiring`, `ce-approved`.

## Seed

After the SQL, on `estimator-test` only:

`npm run seed:test`

That writes one sample at each stage (accepted RCE, done CE, approved markup, approved proposal, submitted job order, Awarded) for staff, lead, head, and admin. Markup is its own document. Award status stays on the job order, not on the estimate. The seed also signs in a Sales rep, a second Sales rep, and a Sales manager, and wires them as the markup, proposal, and job order approvers. It registers the sample proposal and job order numbers and advances the counters (proposal 3614, year 26 sequence 14) so the next real number does not collide with a sample. Sample job orders record the PO file name only. A new job order uploads the file into `estimator-files` and stores that path. If `p34` is not applied yet, that registration is logged and skipped. Job orders are merged into the schema document. Other schema keys are left in place. This was not run from here.

## Smoke checks

Sign in as each role. The account id in the timeline is the identity. A display name is not.

| Role | Check |
| --- | --- |
| Staff (Cost Estimating) | Open a sample estimate. Submit is unchanged. Golden totals on the four direct examples stay 27,362.51 / 95,682.28 / 31,692.31 / 154,737.10. |
| Lead (Cost Estimating) | The sample queue for lead still opens. Approving a sample markup, proposal, or job order records the lead account id. |
| Head (Management) | Final approval still works. A backup signature reads `for <name>` and the timeline `who` is the backup account id. |
| Admin | Admin can turn the flags on, edit proposal clauses, and reassign a proposal or job order. Admin cannot be the only thing that keeps an estimate total correct. |
| Sales | With the flags on, generate markup on an approved estimate, then a proposal, then a job order. The job order PDF is the SY3 form: a header block, a labelled field grid, Prepared by, and Checked and approved by. When a backup signed, that block reads `for <primary approver name>`. The quantities attachment is a PDF and shows quantities and no prices. The PO or NTP file is uploaded to `estimator-files` (the job order stores the storage path, not the file bytes). Approve the job order only after that approved job order is stored: the estimate status becomes Awarded and the proposal becomes Won. The estimate does not gain `awardStatus` or `awardJo`. Cancel only after that job order is cancelled: the estimate and the proposal go back to the status they had before the award (the sample's previous status is Done and Approved), not a hardcoded path. Deleting a never-submitted draft keeps the proposal, with `deleted` and a timeline entry, and releases its PR number. It does not remove the row. A proposal marked Lost counts as a loss on that sales rep's win rate. |
| Sales, second account | Take over an approved proposal. The new owner is that account id. |

Also confirm: a duplicate client PR number is refused; a missing number function does not save a blank proposal or job order; Reports colours a 12-hour approval `#b45309`; with no mail key, the screen still works.
