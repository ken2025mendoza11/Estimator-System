# Release 1 go-live

Ken runs this. This file does not apply SQL, does not change a Vercel project, and does not turn flags on in production.

Do this on `estimator-test` first. Take a backup before the first script. Repeat the backup before production. If a script fails, stop. Run the rollbacks below in reverse order only for the scripts that were applied. Do not drop tables or columns that were already there.

## Backup first

1. In the Supabase project you are about to change, take a backup (or a snapshot) and keep it until the smoke checks pass.
2. Confirm the project is the one you mean. The seed refuses any host that is not `estimator-test`.
3. Apply the scripts in the SQL editor, one file at a time, in the order below.

## SQL, in order

These are the scripts from Steps 1–33. Step 32 and Step 33 add no SQL. Skip a file only if that exact version is already applied.

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

`p30` must be applied before the seed writes a proposal. `p31` must be applied before a proposal number or a job order number can be taken from the database. The app still saves when those functions are missing; the new buttons explain that and do not write the document.

## Rollback order

Reverse of the table, and only for scripts that were applied: 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1. Each rollback file removes only what its script added. Do not run a later rollback before the script that depends on it has been undone.

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

An empty key skips mail and logs that the send was skipped. The key is not written in the log. Escalation is `POST /api/release1-escalate` with the waiting documents. It does not read the database. Call it from a scheduler if it must run while the app is closed. Twelve hours moves the step to its backup, or to the next approver when there is no backup.

## Seed

After the SQL, on `estimator-test` only:

`npm run seed:test`

That writes one sample at each stage (accepted RCE, done CE, approved markup, approved proposal, submitted job order, Awarded) for staff, lead, head, and admin. Job orders are merged into the schema document. Other schema keys are left in place. This was not run from here.

## Smoke checks

Sign in as each role. The account id in the timeline is the identity. A display name is not.

| Role | Check |
| --- | --- |
| Staff (Cost Estimating) | Open a sample estimate. Submit is unchanged. Golden totals on the four direct examples stay 27,362.51 / 95,682.28 / 31,692.31 / 154,737.10. |
| Lead (Cost Estimating) | The sample queue for lead still opens. Approving a sample markup, proposal, or job order records the lead account id. |
| Head (Management) | Final approval still works. A backup signature reads `for <name>` and the timeline `who` is the backup account id. |
| Admin | Admin can turn the flags on, edit proposal clauses, and reassign a proposal or job order. Admin cannot be the only thing that keeps an estimate total correct. |
| Sales | With the flags on, generate markup on an approved estimate, then a proposal, then a job order. The job order and its attachment show quantities and no prices. Approve the job order: the estimate is Awarded and the proposal is Won. Cancel it: the estimate returns to Done and the proposal returns to Approved. |
| Sales, second account | Take over an approved proposal. The new owner is that account id. |

Also confirm: a duplicate client PR number is refused; a missing number function does not save a blank proposal or job order; Reports colours a 12-hour approval `#b45309`; with no mail key, the screen still works.
