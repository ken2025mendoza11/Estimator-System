# Grok progress

One step per turn. Do not start the next step until Ken says `continue`.

Baseline at `88f5e91` (before Step 1): `npm test` 208 + 73, 0 failures. `tsc` 0 errors. `eslint` 0 errors, 156 warnings. Build ok.

| Step | Name | Status | Branch | PR |
| --- | --- | --- | --- | --- |
| 1 | Phase 0: test sign-in, seed, guardrail files | done | `grok/phase-0` | opening |
| 2 | GOLD: computation map + golden lock | pending | | |
| 3 | Phase 1A: data safety | pending | | |
| 4 | Phase 1B: access control and sign-in | pending | | |
| 5 | Phase 1C: stable IDs and clone remap | pending | | |
| 6 | CE-COMP: CE computation | pending | | |
| 7 | Phase 4: calculator fixes | pending | | |
| 8 | Phase 2a: approval engine + change types | pending | | |
| 9 | Phase 2b: take-over, closing, reminders, notifications | pending | | |
| 10 | Phase 2c: signatures, DRAFT watermark, inspection | pending | | |
| 11 | Phase 5: Monitoring, suffixes, award, Admin, Scope Library, Price check | pending | | |
| 12 | Phase 6: Equipment rates, reports, mobile viewer | pending | | |
| 13 | Phase 7: Pre-submit checker | pending | | |
| 14 | Phase 8: Quotations, availability, locations, pending records | pending | | |
| 15 | Phase 9: Route and fuel calculator | pending | | |
| 16 | Phase 10: SOW tagging, Gantt, project schedule, export order | pending | | |
| 17 | LOGIN-UI: sign-in and sign-up UI | pending | | |
| 18 | Phase 11: past estimates and document formats | blocked until Ken supplies sample files | | |

## Step 1 done

- `1e37dba` Turn test sign-in on only outside production.
- `6206da1` Add an idempotent seed for the test project.

Item in progress: none. Next action for Step 2: map every total, then lock today's numbers for the four cases and `legacy-ce.json`. Do not start until Ken says `continue`.

SQL written: none.

Questions:

1. The seed writes `app_user_roles` with `SUPABASE_SERVICE_ROLE_KEY` (signed-in users have no insert policy). Confirm that env name.
2. The seed loads one RCE, one legacy CE, and one inspection. Say if you want more than one of each.

Risks:

- When the test guard is on, Better Auth also exposes email sign-up. `server.ts` enables the whole plugin and is outside this step.
- `src/routes/api/auth/$.ts` returns 404 for `/api/auth/sign-in/email` when the guard is off. Better Auth itself returns 400, so the route file had to answer first. That file was not on the allowed list.

## Computation map

Not started. Step 2.
