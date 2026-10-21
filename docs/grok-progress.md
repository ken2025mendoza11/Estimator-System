# Grok progress

One step per turn. Do not start the next step until Ken says `continue`.

Baseline at `88f5e91` (before Step 1): `npm test` 208 + 73, 0 failures. `tsc` 0 errors. `eslint` 0 errors, 156 warnings. Build ok.

| Step | Name | Status | Branch | PR |
| --- | --- | --- | --- | --- |
| 1 | Phase 0: test sign-in, seed, guardrail files | done | `grok/phase-0` | https://github.com/ken2025mendoza11/Estimator-System/pull/1 |
| 2 | GOLD: computation map + golden lock | done | `grok/phase-gold` | https://github.com/ken2025mendoza11/Estimator-System/pull/2 |
| 3 | Phase 1A: data safety | done | `grok/phase-1a` | https://github.com/ken2025mendoza11/Estimator-System/pull/3 |
| 4 | Phase 1B: access control and sign-in | done | `grok/phase-1b` | https://github.com/ken2025mendoza11/Estimator-System/pull/4 |
| 5 | Phase 1C: stable IDs and clone remap | done | `grok/phase-1c` | https://github.com/ken2025mendoza11/Estimator-System/pull/5 |
| 6 | CE-COMP: CE computation | done | `grok/phase-ce-comp` | https://github.com/ken2025mendoza11/Estimator-System/pull/6 |
| 7 | Phase 4: calculator fixes | done | `grok/phase-4` | https://github.com/ken2025mendoza11/Estimator-System/pull/7 |
| 8 | Phase 2a: approval engine + change types | done | `grok/phase-2a` | https://github.com/ken2025mendoza11/Estimator-System/pull/8 |
| 9 | Phase 2b: take-over, closing, reminders, notifications | done | `grok/phase-2b` | https://github.com/ken2025mendoza11/Estimator-System/pull/9 |
| 10 | Phase 2c: signatures, DRAFT watermark, inspection | done | `grok/phase-2c` | https://github.com/ken2025mendoza11/Estimator-System/pull/10 |
| 11 | Phase 5: Monitoring, suffixes, award, Admin, Scope Library, Price check | done | `grok/phase-5` | https://github.com/ken2025mendoza11/Estimator-System/pull/11 |
| 12 | Phase 6: Equipment rates, reports, mobile viewer | done | `grok/phase-6` | https://github.com/ken2025mendoza11/Estimator-System/pull/12 |
| 13 | Phase 7: Pre-submit checker | done | `grok/phase-7` | https://github.com/ken2025mendoza11/Estimator-System/pull/13 |
| 14 | Phase 8: Quotations, availability, locations, pending records | done | `grok/phase-8` | https://github.com/ken2025mendoza11/Estimator-System/pull/14 |
| 15 | Phase 9: Route and fuel calculator | done | `grok/phase-9` | https://github.com/ken2025mendoza11/Estimator-System/pull/15 |
| 16 | Phase 10: SOW tagging, Gantt, project schedule, export order | done | `grok/phase-10` | https://github.com/ken2025mendoza11/Estimator-System/pull/16 |
| 17 | LOGIN-UI: sign-in and sign-up UI | done | `grok/phase-login-ui` | https://github.com/ken2025mendoza11/Estimator-System/pull/17 |
| 18 | Phase 11: past estimates and document formats | blocked until Ken supplies sample files | | |

## Step 1 done

- `1e37dba` Turn test sign-in on only outside production.
- `6206da1` Add an idempotent seed for the test project.
- `bc6efeb` Document the test deployment and the step table.

Item in progress: none. Step 2 is done on `grok/phase-gold`.

## Step 2 done

Stacked on `grok/phase-0` (https://github.com/ken2025mendoza11/Estimator-System/pull/1 is still open). Draft PR: https://github.com/ken2025mendoza11/Estimator-System/pull/2. Do not merge to `main`.

- `4d2bf69` Add the four section D cost-estimate examples.
- `3924f60` Lock today's cost-estimate totals in a golden test.

Baseline before the first Step 2 edit (same tree as Step 1): `npm test` 210 + 84, 0 failures. `tsc` 0. `eslint` 0 errors, 156 warnings. Build ok. `npm ci` was not repeated; the Step 1 install was still present.

After Step 2: `npm test` 219 + 84, 0 failures. `tsc` 0. `eslint` 0 errors, 156 warnings. Build ok. No behaviour change. No `src/` code edited.

Item in progress: none. Step 17 is done on `grok/phase-login-ui`, stacked on `grok/phase-10`. Ken said `continue` on 20 Oct 2026. Step 18 stays blocked: no sample past estimates and no template gap analysis were attached.

## Step 3 done

Stacked on `grok/phase-gold` (https://github.com/ken2025mendoza11/Estimator-System/pull/2 is still open). Draft PR: https://github.com/ken2025mendoza11/Estimator-System/pull/3. Do not merge to `main`.

Baseline before the first Step 3 edit (same tree as Step 2): `npm test` 219 + 84, 0 failures. `tsc` 0. `eslint` 0 errors, 156 warnings. Build ok.

- `f7dffdf` Use Asia/Manila for the calendar default and approval stamps.
- `ace2b37` Keep the document-number format and cap new numeric input.
- `ab75fad` Add document counters and an exists conflict for new ids.
- `50a6a74` Merge server lists with only the documents edited locally.
- `c5705d4` Allocate document numbers and report an exists conflict.
- `600ec57` Key the local backup per user and skip tombstones while hydrating.
- `e0801a8` Seal approved estimates and take document numbers from the server.

After Step 3: `npm test` 225 + 88, 0 failures. `tsc` 0. `eslint` 0 errors, 156 warnings. Build ok. Golden totals unchanged.

### What shipped

- Local backup is keyed per user and cleared on sign-out. Hydration keeps every server document and copies over only dirty ones. That save sends the version the edit started from, and it does not tombstone during hydration.
- `next_doc_no` (SQL, not run) has separate CE / RCE / OIF counters, seeded from the current max. A new id that already exists returns conflict `exists`. The six create sites call it and fall back to today's format when the function is missing. Offline, New is disabled: "Connect to the internet to get a document number".
- Approval changes status and Rev only when `result.ok`. The approve button no longer bumps Rev itself.
- For approval, Done, and accepted estimates do not take line edits. Restore does not set the status. Award and the approval buttons still work. Revise on a Done estimate still records the note.
- Excel cover writes real onsite / shop / trading numbers, numeric percent cells, and `ROUND(...,2)`.
- Login buttons use the `ce-login-btn` rules (44px, full width).
- New qty and days stop above 1,000,000. New rates and unit costs stop above 1,000,000,000. Negatives are refused. Stored rows are not rewritten.
- `phTime.js` is the Manila clock. `todayLocal` / `addDaysLocal` default to Asia/Manila. The approval stamp is Manila. 16:30 UTC is the next Philippine day.

### Calendar sites still on UTC or the browser zone

Not switched in this step. The approval stamp and the document-number year are the ones this step changes.

1. `src/lib/estimator/workflow.js` `todayIso` — UTC date. Nothing calls it.
2. `CostEstimatorApp.jsx` pending registration `requestedAt`.
3. `CostEstimatorApp.jsx` document-control sample date.
4. `CostEstimatorApp.jsx` masterlist `lastReviewed` on add.
5. `CostEstimatorApp.jsx` masterlist modal save date.
6. `CostEstimatorApp.jsx` item form default `lastReviewed`.
7. `CostEstimatorApp.jsx` scope template created date.
8. `CostEstimatorApp.jsx` scope template job-type `updatedAt`.
9. `CostEstimatorApp.jsx` scope template duplicate `updatedAt`.
10. `CostEstimatorApp.jsx` CE list `lastEdited` after a document save.
11. `CostEstimatorApp.jsx` archived CE `lastEdited`.
12. `CostEstimatorApp.jsx` scope-library template `updatedAt`.

Also, not in that twelve: `AdminHub.jsx` `requestedAt` and a panel date (file not on this step's allowed list); `toLocaleString` / `toLocaleTimeString` for the draft-offer clock, the idle auto-save log, and grouped number formatting.

SQL written, not run: `supabase/p1a-numbering-2026-10-20.sql`, then the rollback file only if it must be undone. Apply on the TEST project after the app is deployed. The app keeps working when `next_doc_no` is missing.

Flags: none. These fixes ship on.

Questions: none new. The Step 1 questions are still open.

Risks:

- A backup saved before this step has no revision map, so its first push uses the version just loaded.
- The Excel cover no longer reads other sheets for the work-type columns. MOB is 0 unless a task has MOB lines.
- `save_workspace_doc` is replaced in full (same signature) so the exists check can ship. Apply the new file, not both the old and the new.

## Step 4 done

Stacked on `grok/phase-1a` (https://github.com/ken2025mendoza11/Estimator-System/pull/3 is still open). Draft PR: https://github.com/ken2025mendoza11/Estimator-System/pull/4. Do not merge to `main`.

Baseline before the first Step 4 edit (same tree as Step 3): `npm test` 225 + 88, 0 failures. `tsc` 0. `eslint` 0 errors, 156 warnings. Build ok.

- `fedac25` Add pending accounts and stop direct document writes.
- `0a051b6` Register a new account as pending and list access for admins.
- `346f75d` Offer Microsoft sign-in beside Google when it is configured.
- `167e3f9` Send attachment and import writes through the save function.
- `912c66a` Hold a pending account off the records and gate acting-as.

After Step 4: `npm test` 225 + 91, 0 failures. `tsc` 0. `eslint` 0 errors, 156 warnings. Build ok. Golden totals unchanged.

### What shipped

- Import, attachment migrate, and the OIF fold write through `save_workspace_doc`. A direct `workspace_docs` write remains only when that function is missing. A `forbidden` result is an error, not a version conflict.
- SQL (not run) revokes authenticated insert, update, and delete on `workspace_docs`. Select stays. Signed approval steps must have `byUserId = auth.uid()` and a matching role (admin allowed). Done is allowed only when the approval is accepted. Task changes are refused on an accepted estimate. A non-admin `kind='admin'` write returns `ok: false`, "Only an admin can change settings.", not `skipped: true`.
- `app_user_roles` gains `status` (default active), `requested_at`, `profile`, `decided_by`, `decided_at`. Helpers: `is_active_user`, `register_pending`, `grant_role`, `decline_user`, `disable_user`, `list_user_access`.
- A signed-in account with no row is registered pending and sees "Waiting for admin approval" with no records. Existing rows stay active, so the current admin stays admin. If the new columns or functions are missing, accounts stay active and the app still loads.
- The admin view lists the access queue and can grant staff, lead, head, or admin, or decline or disable. `AdminHub.jsx` was not edited.
- Microsoft is offered beside Google only when both Microsoft env vars are set and the mode is not the Grok broker. It is not a trusted linking provider.
- "Acting as" shows only for an admin on a test deployment (`isTestDeployment`).

### R1

`public.email_allowlist` and `email_is_allowed()`. An empty table allows everyone, the same rule as an empty `ESTIMATOR_ALLOWED_EMAILS`, so the current admin is not locked out. `issue-access.server.ts` was not edited. The env allowlist still gates tokens. JWT mint is unchanged.

SQL written, not run: `supabase/p1b-access-2026-10-20.sql`, then the rollback file only if it must be undone. Apply on the TEST project after the app is deployed and after the Step 3 numbering file. The rollback restores the Step 3 `save_workspace_doc` and the old `is_admin()`. It does not delete documents or role rows.

Flags: none. These fixes ship on.

Questions: none new. The Step 1 questions are still open.

Risks:

- After the SQL is applied, authenticated cannot insert, update, or delete `workspace_docs`. Staff with an active role can still save a CE through the function. Pending users cannot.
- An empty `email_allowlist` allows every email at the database. The env allowlist still gates who receives a token.
- A new Google account with no role row is inserted as staff/pending and sees no data.
- Microsoft is not auto-linked to an existing Google account.
- `is_admin()` now also requires status active. The rollback restores the previous function.
- The PASS checks in the SQL file were not executed here.

## Step 5 done

Stacked on `grok/phase-1b` (https://github.com/ken2025mendoza11/Estimator-System/pull/4 is still open). Draft PR: https://github.com/ken2025mendoza11/Estimator-System/pull/5. Do not merge to `main`.

Baseline before the first Step 5 edit (same tree as Step 4): `npm test` 225 + 91, 0 failures. `tsc` 0. `eslint` 0 errors, 156 warnings. Build ok. `npm ci` was not repeated.

- `b59b96f` Add a clone remap that gives tasks and lines new ids.
- `eb3ccfb` Lock clone remap and prove load and save keep ids.
- `e736f24` Remap ids when a cost estimate is cloned from another.

After Step 5: `npm test` 225 + 96, 0 failures. `tsc` 0. `eslint` 0 errors, 156 warnings. Build ok. Golden totals unchanged.

### What shipped

- `remapCloneIds` copies the estimate and assigns a fresh UUID to every task, nested subtask, and line. The source is not mutated. Predecessors are remapped. A predecessor that does not point at a copied id stays as it is.
- `sow[].activity_id` and `schedule` (keyed by task id, or rows) follow the new ids. `sowText` is left alone. `clonedFrom` is added with `sourceId` and `idMap`, keeping any older keys.
- Summary task-filter ids are remapped so the clone does not keep the source task ids in that list.
- The wizard clone is the only caller. Saving and loading through split/assemble returns the same ids.

SQL: none. Flags: none. This ships on. No screen change.

Questions: none new. The Step 1 questions are still open.

Risks:

- `package.json` gained one test-script entry so the new tests run.
- Attachment file ids are not remapped.
- `clonedFrom.sourceId` is the source `projectInfo.docNo` when that is set. The wizard then puts the new CE number in `docNo`. The stored source id stays the old number.

## Step 6 done

Stacked on `grok/phase-1c` (https://github.com/ken2025mendoza11/Estimator-System/pull/5 is still open). Draft PR: https://github.com/ken2025mendoza11/Estimator-System/pull/6. Do not merge to `main`.

Baseline before the first Step 6 edit (same tree as Step 5): `npm test` 225 + 96, 0 failures. `tsc` 0. `eslint` 0 errors, 156 warnings. Build ok. `npm ci` was not repeated.

- `bf91405` Move cost-estimate totals into ceTotals and add direct-v1 math.
- `0fe09d6` Use direct-v1 totals on a marked estimate and offer the switch.

After Step 6: `npm test` 233 + 96, 0 failures. `tsc` 0. `eslint` 0 errors, 157 warnings. Build ok. Golden totals unchanged.

### What shipped

- `calcBOL` through `projectTotal` now live in `src/lib/estimator/ceTotals.js`. A missing `pricing.model` still runs the legacy bodies. The golden test locks those bodies.
- Direct-v1 (only when `pricing.model` is `direct-v1`) uses the DOLE helper. Premiums do not stack. Night is +10% on the scaled rate. OT uses 1.25 on a regular day and 1.3 on a rest day or holiday. Row A.1 is statutory benefits at the regular rate, no premium and no OT, rounded per BOL line then summed. The grand is one total: A + A.1 + B + C + D + E.
- The four section D cases as direct-v1, to the centavo: Shop 27,362.51 (BOL sheet 12,800.00). Onsite 95,682.28 (BOL sheet 43,961.13, which is A minus per diem). Trading 31,692.31. Hybrid 154,737.10. Contingency and a stored override are ignored. Generator power is not costed on onsite.
- `directCostTotalsForNew` defaults off. It only offers the switch. A CE that is already direct-v1 keeps that math if the flag is later turned off. The banner shows only when the flag is on, the status is Draft or Ongoing, the CE is not already direct, and the editor is not read-only. Confirm writes `pricing.model`, snapshots `directFormula` of the admin rates, and logs the old total and the new one.
- Screen grand, official total, sticky bar, PDF and Excel cover, list amount, monitoring export, approval preview, and the scope-library total use that one total when the model is direct-v1. The Excel cover adds an A.1 row and omits Contingency, Discount, and Net. The cover payload writes 0% for those fields. Stored `commercial.*` is not rewritten.
- Official amount cells on a direct-v1 estimate are read-only because the rows are passed with `group: true`. `CeOfficialSummary.jsx` was not edited. Summary overrides stay stored and are ignored while the model is direct-v1.
- The admin panel can edit the direct rates when the flag is on, and it refuses an out-of-range value. `directFormula` still falls back to the default if a stored value is out of range. Flag off, the preview and the BOL legend stay the old text.

SQL: none. Rates live in `adminConfig`. The flag ships off. The math ships for a CE that is already marked direct-v1.

Questions: none new. The Step 1 questions are still open.

Risks:

- `package.json` gained one test-script entry so `ceTotals.direct.test.mjs` runs.
- The move and the direct-v1 math are one commit. They were written into the same uncommitted file. The golden test locks the legacy path.
- A stored direct rate that is out of range falls back inside `directFormula`. The admin screen refuses it on edit.
- A night regular day at ₱900 is `990.0000000000001` before rounding. Line money goes through `roundMoney`. The unit test allows `1e-6`. The section D cents match.
- The old benefits table (SSS 4.5% of monthly, ₱500 per-diem fallback) is unchanged and still not in the legacy grand. It is hidden on a direct-v1 BOL sheet. Direct-v1 A.1 is a different formula and is in the grand.
- An approved or sealed CE never sees the switch. A CE already marked direct-v1 keeps computing that way if the flag is turned off.
- BOL groups use the max line qty and the sum of line days. The footer is `directBolSheet` (A minus per diem), not the schedule rectangle. A group subtotal is rounded on its own and can differ from that footer by a centavo.
- `activeCePricing` and `bolLegendFlag` are module lets set while the estimate editor renders, so a breakdown line matches the model without a new prop on every grid.
- `eslint` is 157 warnings: the 156 baseline plus two `@ts-nocheck` warnings on the two new files. The App warning count fell by one.

## Step 7 done

Stacked on `grok/phase-ce-comp` (https://github.com/ken2025mendoza11/Estimator-System/pull/6 is still open). Draft PR: https://github.com/ken2025mendoza11/Estimator-System/pull/7. Do not merge to `main`.

Baseline before the first Step 7 edit (same tree as Step 6): `npm test` 233 + 96, 0 failures. `tsc` 0. `eslint` 0 errors, 157 warnings. Build ok. `npm ci` was not repeated.

- `6bffbb5` Move the EL formulas into elCalcs and lock the check numbers.
- `e0e32a0` Use the EL formulas in the calculator and reject bad input.
- `b8346bf` Add a calculator line from a dialog, with versioned constants.
- `90313b5` Add a calculator-constants table and its rollback.

After Step 7: `npm test` 248 + 96, 0 failures. `tsc` 0. `eslint` 0 errors, 160 warnings. Build ok. Golden totals unchanged.

### What shipped

- Paint coverage is volume-solids percent × 10 / DFT. 100 m², 1 coat, 200 µm, 75%, 0% waste = 26.67 L.
- Fillet 6 mm × 10 m SMAW 65% = 2.174 kg. Plate 2.4 × 1.2 m × 6 mm = 135.65 kg. Pipe 60.3 × 3.91 × 6 m = 32.62 kg. Cutting waste defaults to 0.
- Air cargo 20 kg, 50×40×30, declared ₱10,000 = ₱1,724.80. A blank declared value is a zero valuation, and the total still computes. Chargeable weight rounds up to the next 0.5 kg.
- A zero DFT, deposition efficiency, or volumetric divisor is an inline message. Those values are not silently replaced.
- Groove uses a 60° included angle, a 2 mm gap, and reinforcement on the weld-metal area. The fillet size is labelled Leg. The plate note says length and width are in metres.
- Add to cost estimate picks the estimate, task, subtask, and category. Only Draft, Ongoing, On Park, Waiting for information, Sourcing, and For revision. A matching database description supplies the unit cost for material categories. Air cargo stays 1 × the freight total in MISC section B. Merge is shown and happens only if it is ticked. `line.calc` stores the inputs. ⓘ re-opens them. The alert runs after the update, not inside it.
- Admin → Calculator edits the constants and bumps the version. An out-of-range value is refused. A saved line shows “constants changed” when the version differs. A missing constants object uses the built-in rates.

SQL written, not run: `supabase/p4-calc-constants-2026-10-20.sql`, then the rollback file only if it must be undone. Apply on the TEST project after the app is deployed and after the Step 4 access file. The app does not call the new functions. The Supabase client is not on this step’s allowed list.

Flags: none. These fixes ship on. There was no separate OT calculator to rewire. Step 6 `dolePay` stays the OT helper.

Questions: one new, below. The Step 1 questions are still open.

Risks:

- `elCalcs.js` is one commit of about 500 lines. The formulas and the insert planner were written together.
- Groove 10 mm, 60°, 2 mm gap, density 7.85 is 0.610 kg/m of weld metal before reinforcement and 0.671 kg/m after the stated 10%. The screen applies the 10%.
- `eslint` is 160 warnings: the Step 6 count of 157 plus one `@ts-nocheck` warning on each of `elCalcs.js`, its test, and `AddToCeDialog.jsx`.
- `package.json` gained `elCalcs.test.mjs`.
- The SQL table is not read. Turning the Admin version is what the badge compares.

## Step 8 done

Stacked on `grok/phase-4` (https://github.com/ken2025mendoza11/Estimator-System/pull/7 is still open). Draft PR: https://github.com/ken2025mendoza11/Estimator-System/pull/8. Do not merge to `main`.

Baseline before the first Step 8 edit (same tree as Step 7): `npm test` 248 + 96, 0 failures. `tsc` 0. `eslint` 0 errors, 160 warnings. Build ok. `npm ci` was not repeated.

- `05c923b` Add the approval engine and lock each routing path.
- `e664853` Use the approval engine when the flag is on.

After Step 8: `npm test` 261 + 96, 0 failures. `tsc` 0. `eslint` 0 errors, 161 warnings. Build ok. Golden totals unchanged.

### What shipped

- `approvalEngine.js` is the new path for RCE, CE, inspection, addendum, Update, and closing. `workflow.js` only re-exports it. `startApproval` and `applyApprovalDecision` are unchanged. A document that is not `engine: "v2"` still finishes on the old object.
- `approvalEngineV2` defaults off. Missing or any value other than `true` stays off. Off, submit and approve/reject are today's path. On, a new submit copies `flowSnapshot` (mode, steps, final, backup) so a later Admin edit does not change that approval.
- Mixed: reviewers in parallel, final only after every reviewer has signed and every comment is Fixed. Sequential: one open step. Parallel: every step is open, including final, but an open comment still blocks the final signature. A missing mode is mixed.
- The owner is dropped when they are named on a step. If the named final person is the owner, the backup is used. If the backup is missing or is also the owner, start refuses: "The owner cannot approve this document, and no backup is set." Admin does not satisfy staff, lead, or head.
- Actions are Approve, Approve with comment, and Request edit. Comments are Open or Fixed. Reject is hidden while the flag is on. An old `reject` decision still shows. Request edit sets `edit-requested` and the CE status `For revision`. It does not advance the step.
- Edit keeps the same number and rev, clears signatures, and routes again from the snapshot. Revise stores the next rev on the in-progress approval. The issued rev stays until that rev is approved, then the previous snapshot is `Superseded`. Update writes `Rev 0 - Update 1`, status `Internal`, and is not issued.
- Admin → Approval flow can turn the engine on. Mode, final, and backup show only then. A blank role cannot be saved while the flag is on.

SQL: none. The running approval and the flow live on the document and in `adminConfig`. The shared `supabase/p2-approvals-<date>.sql` file is left for Steps 9–10 if a table is required. The app does not need one for this step.

Flags: `approvalEngineV2` ships off.

Questions: none new. The three questions below are still open.

Risks:

- The engine and its tests are one commit of about 700 lines.
- `eslint` is 161 warnings: the Step 7 count of 160 plus one `@ts-nocheck` warning on each new file, and the App warning count fell by one.
- `package.json` gained `approvalEngine.test.mjs`.
- A head can still sign an unnamed lead step. That is the same ladder as today, except admin no longer can. Naming the reviewer limits the step to that person.
- An in-progress legacy approval is not rewritten when the flag is turned on. Reject is hidden for every document while the flag is on, so a legacy in-flight document can still be approved and cannot be rejected from the button.
- Take-over, reminders, the notification matrix, closing statuses, signatures, and the DRAFT watermark are not in this step.

## Step 9 done

Stacked on `grok/phase-2a` (https://github.com/ken2025mendoza11/Estimator-System/pull/8 is still open). Draft PR: https://github.com/ken2025mendoza11/Estimator-System/pull/9. Do not merge to `main`.

Baseline before the first Step 9 edit (same tree as Step 8): `npm test` 261 + 96, 0 failures. `tsc` 0. `eslint` 0 errors, 161 warnings. Build ok. `npm ci` was not repeated.

- `dd9f272` Add reminder, closing, take-over, and notification rules.
- `2f80484` Use take-over, closing, reminders, and the notification matrix when the flag is on.

After Step 9: `npm test` 267 + 96, 0 failures. `tsc` 0. `eslint` 0 errors, 164 warnings. Build ok. Golden totals unchanged.

### What shipped

- Same flag `approvalEngineV2`, still off. Off, Assist, Transfer, a direct No quote, and the wizard (lead, head, and admin can still open a cost estimate from an RCE that is not accepted) stay as they are. Reject stays hidden while the flag is on, from Step 8.
- Take-over asks for a reason and stays pending on the cost estimate. The owner, or a name listed under Admin → Approval flow → “Authorised to approve a take-over”, can approve or decline. Admin is not automatic. Approve moves `assignedTo` to the person who asked and unlocks the editor. Decline leaves the owner. Both are timeline rows. Assist is still there.
- Cancelled, No quote, and Close bid go through `Pending Cancelled approval`, `Pending No quote approval`, or `Pending Close bid approval`. A blank reason is refused. The approval engine runs with `changeKind: "closing"`. A final signature writes the requested status, not Done, and does not freeze an approved snapshot. Request edit restores the status the request left. The new pending statuses seal the sheet the same way For approval does.
- Notify, and a check while the estimate list is open, sends one in-app reminder per slot. Slots are 08:00, 11:00, 14:00, 17:00, and 20:00 Asia/Manila. Nothing before 08:00 and nothing at 23:00. The first look sends only the latest open slot. After that, each missed slot is sent once, from `reminderAt`. Notify sets `reminderAt` to now so the open slot is not sent again. There is no cron and no Vercel schedule.
- The notification matrix lists the in-app events. A missing row stays on. Only an explicit off drops that event, and only while the flag is on. Off, every notice is sent as before.
- A new cost estimate can be created only from an accepted RCE while the flag is on. Opening a live cost estimate is unchanged. The new cost estimate stores `rceStamp`. If that RCE later changes, Monitoring and the editor show “RCE changed” and the cost estimate is not edited.

SQL: none. The shared `supabase/p2-approvals-<date>.sql` file is still left for Step 10 if a table is required. The app does not need one for this step.

Flags: `approvalEngineV2` ships off.

Questions: none new. The three questions below are still open.

Risks:

- The rules and their tests are one commit of about 300 lines. The App wiring is one commit of about 360 lines.
- `eslint` is 164 warnings: the Step 8 count of 161 plus one `@ts-nocheck` warning on each of `reminders.js`, `notifyMatrix.js`, and `reminders.test.mjs`. The App warning count stayed 111.
- `package.json` gained `reminders.test.mjs`. `workflow.js` only re-exports.
- A reminder is computed when the app is open. A closed browser does not catch up until the next time that list is loaded.
- A cost estimate created while the flag was off has no stamp, so it is not tagged when an RCE changes.
- Signatures, the DRAFT watermark, and the inspection flow are not in this step.

## Step 10 done

Stacked on `grok/phase-2b` (https://github.com/ken2025mendoza11/Estimator-System/pull/9 is still open). Draft PR: https://github.com/ken2025mendoza11/Estimator-System/pull/10. Do not merge to `main`.

Baseline before the first Step 10 edit (same tree as Step 9, `41aad09`): `npm test` 267 + 96, 0 failures. `tsc` 0. `eslint` 0 errors, 164 warnings. Build ok. `npm ci` was not repeated.

- `f3db1ca` Add signature paths, the DRAFT rule, and inspection noting rules.
- `c5e24fb` Draw signatures and the DRAFT mark, and note inspections, when the flag is on.
- `ee53e2c` Use the Supabase user key for signature images and load them on final PDFs.

After Step 10: `npm test` 272 + 96, 0 failures. `tsc` 0. `eslint` 0 errors, 166 warnings. Build ok. Golden totals unchanged.

### What shipped

- Same flag `approvalEngineV2`, still off. Off, the PDF bytes, the Excel cover header, the inspection form, and send-to-CE stay as they are. No second flag.
- On, a PNG signature is kept for the session and uploaded to `signatures/<auth.uid>.png`. That key is `stableUserUuid(user id)`, the same value the JWT uses for `auth.uid()`. A UUID id is kept. Any other id is hashed, so it matches for the test users and for every other account. Export lookup uses that same key from the approval step's `byUserId` or from `userId` / `userKey`. It does not use `adminConfig.users` id. A missing bucket or a refused upload keeps the image for this session and later exports fall back to the bundled Great Vibes script font. The SIL OFL text is `public/fonts/OFL-GreatVibes.txt`. The font file was already in `public/fonts`.
- On, CE, RCE, and OIF PDFs, including their previews, stamp DRAFT until the document is final. Signature images are loaded whenever the flag is on, including a final approval. Done, accepted, approved, Noted, Cancelled, No quote, and Close bid are clean of the watermark. A pending closing is still a draft. The Excel cover writes DRAFT in the existing middle header cell. No cover row is inserted, so the formulas stay on the same rows. An RCE page inside a CE pack is not stamped on its own; the CE stamp covers the pack.
- Inspection noting uses the stored oif flow (Prepared by, then Noted by). Submit sets For approval. The lead's Noted writes status Noted, not Done. Request edit restores For revision. A report with no id must be saved first. Linked RCE and linked CE selects appear only while the flag is on. Sending lines to a For approval, Done, accepted, approved, pending-approval, Cancelled, No quote, or Close bid cost estimate is blocked. Ongoing and For revision still accept lines.

SQL written, not run: `supabase/p2-approvals-2026-10-20.sql`, then the rollback file only if it must be undone. Apply on the TEST project after the app is deployed. The four `estimator_files_*` policies are left as they are. Three new RESTRICTIVE policies (`estimator_files_signatures_insert`, `_update`, and `_delete`) limit a write under `signatures/` to `signatures/<auth.uid>.png`. Any signed-in user can still read `signatures/*`. The rollback drops only those three policies and does not delete signature files. The app keeps working when the policies are missing.

Flags: `approvalEngineV2` ships off.

Questions: none new. The three questions below are still open.

Risks:

- The rules, tests, SQL, and license text are one commit of about 290 lines. The App wiring is one commit of about 290 lines.
- `eslint` is 166 warnings: the Step 9 count of 164 plus one `@ts-nocheck` warning on each of `signatures.js` and `signatures.test.mjs`. The App warning count stayed 111.
- `package.json` gained `signatures.test.mjs`. `workflow.js` only re-exports.
- The storage key is `auth.uid()`. The app also remembers the image under the person's display name so a PDF slot that only has a name can draw it in this session. Another signed-in user can read that object once the new policies are applied. A name with no auth id still falls back to the script font.
- `ee53e2c` corrected the first upload path, which used the raw account id and the admin roster id, and it loads signature images on a final PDF as well as a draft. The SQL file no longer drops the existing bucket policies.
- Monitoring, suffixes, award, Admin, Scope Library, and Price check are not in this step.

### Golden table (today)

Section D's today column. The BOL sheet and benefits are today's functions, not the direct-v1 columns.

| Case | Grand | Official | Net | BOL sheet | Benefits (roles) |
| --- | --- | --- | --- | --- | --- |
| Shop | 24,542.00 | 23,342.00 | 24,542.00 | 12,800.00 | Welder 7,709.33 |
| Onsite | 89,445.63 | 89,445.63 | 89,445.63 | 48,395.63 | Electrician 5,223.00; Rigger 6,045.67 |
| Trading | 31,692.31 | 31,692.31 | 31,692.31 | 0.00 | none |
| Hybrid | 145,679.94 | 137,987.63 | 152,963.94 | 61,195.63 | same three roles |
| Legacy fixture | 5,576.01 | 24,375.00 | 5,737.71 | 3,675.00 | Rigger 3,595.67 |

Shop official drops the unsectioned permit 1,200. Hybrid official uses override C = 20,000 (computed C is 26,492.31). Hybrid net is grand × 1.05. Legacy official uses override C = 20,000 and net is grand × 1.05 × 0.98.

Schedule used for the sheet (grand does not use it): shop welders are sequential, so the sheet is Welder 2 × 8 regular days. Onsite day-types are sequential and the 2×2 rigger follows them, so the regular-day sheet is Rigger 4 × 8 days at the first line's 2 OT hours. Per diem is not on the sheet. A missing per diem falls back to ₱500 × active days (Welder).

## Computation map

Step 6 moved `calcBOL` through `projectTotal`, plus `buildBolGroups`, `bolLineAmount`, `withBolEdit`, and `categoryOnTask`, into `src/lib/estimator/ceTotals.js`. The line numbers below are the Step 2 snapshot, before that move. `formulaNow` and `dayTypeMultiplier` stayed in the App. `money.js` and `computeSchedule` were not edited.

Line numbers are `src/components/CostEstimatorApp.jsx` on the Step 2 branch unless noted. No formula was moved in Step 2.

**Formula**

- `DEFAULT_TEMPLATE_FORMULA` 4036–4047. `activeTemplateFormula` 4048. `formulaNum` 4049. `normalizeTemplateFormula` 4053. `applyTemplateFormula` 4071. `formulaNow` 4074. `dayTypeMultiplier` 4077.
- Admin preview `TemplateFormulaPanel` 4525–4633. Labor sheet 4610–4623 uses the same OT math as `calcBOL` (hourly × OT × day multiplier × night). Benefits sheet 4624–4630 is monthly / 13th / SSS / HDMF / PHIC only.
- `fmt` / `num2` 6810–6816.
- `DAY_TYPES` 6863. `CATS` 6875. `WORK_TYPES` 6909. `normalizeWorkType` 6929. `taskWorkType` 6935. `tasksOfType` 6938. `chargesPower` 6944 (shop and trading only).
- `summarySort` 3901. Empty masterlist sorts with `localeCompare`. The golden test uses that empty-list order so the benefits block can run outside React. Benefit money does not depend on the sort.

**Line totals**

- `calcBOL` 7220–7238. OT/h = rate / 8 × 1.25 × day multiplier × night. Subtotal is `roundMoney` of base + OT + per diem + allowance. The field named `benefits` here is per diem + allowance, not the statutory table.
- `calcBOTE` 7240. Electricity only when `chargesPower`. `boteElectricityCost` 7396.
- `calcBOCM` 7245 and `calcPPE` 7246 call `qtyUnitAmount` in `src/lib/estimator/money.js` 21–23.
- `calcMISC` 7247 calls `miscAmount` in `money.js` 26–28. Blank or 0 days count as 1.
- `roundMoney` / `checksumTotal` / `commercialNet`: `money.js` 9–18 and 37–42. `workflow.js` 432 is a different `checksumTotal` and is not the CE path.
- `itemSubtotal` 7399. `categoryTotal` 7406. `subtaskTotal` 7409. `flattenSubs` 7412. `categoryOnTask` 7423. `botePowerOnTask` 7427. `taskTotal` 7430. `projectTotal` 7434.
- Labour card uses `calcBOL` at 9916–9943 and shows the line subtotal at 10287.

**Official summary**

- `miscBucket` 7248. Section codes: A accommodation, B transportation, C requirements, D admin, I insurance, E third party. A blank section is in the grand and in no bucket.
- `buildOfficialBaseRows` 7272–7376.
- Export / PDF body: `prepareExportData` 17899. `shown` 18048. `bodySum` 18060. `TOTAL AMOUNT` 18094. Does not round each row before the sum.
- On-screen official: `shownAmount` 18372. `officialTotal` 18391. Rounds each row, then the sum.
- Monitoring export: `buildMonitoringExportData` 3252, same override rule, `bodySum` 3334.
- Approval preview 23435–23444 builds an official total and **ignores** `summaryOverrides`.
- `summaryOverrides` is read at 18049, 18372, and 3328. `overrideOr` for benefit cells is `summaryTools.js` 118.

**Grand, net, cover, monitoring**

- Screen grand and net: 17879–17883. Net is `checksumTotal(grand × (1+cont/100) × (1−disc/100))`.
- Export cover: 18247–18276. `grandTotal` is `projectTotal`. `netTotal` is `checksumTotal(commercialNet(...))`.
- `SummaryView` grand 14237 is the same sum as `projectTotal`.
- List amount: `ceAmountLabel` 3082. Monitoring row: `moneyOf` 23405. Scope-library template total 28006.
- `exportDocuments.js` 203–206 and 263–266 checksum `cover.grandTotal`, not `netTotal`.

**BOL sheet and benefits**

- `computeSchedule` 13954–14022. Do not change. A subtask's duration is the max line `days`, at least 1.
- `getScheduledItemMap` 14040–14071. Qty is spread across that whole subtask window. The key is `role~dayType~shift`.
- `buildBolGroups` 14454–14522. It then replaces the line subtotal with qty × days of labour + OT and drops per diem. OT hours come from the first line in the group.
- `bolLineAmount` 14564. `withBolEdit` 14573. Sheet grand in `BOLMasterSummaryImpl` 14887–14894 (per work type, empty edits in the golden test). Header 14987.
- Benefits block 14895–14958. Not a function. Monthly = rate × 26. 13th = monthly / 12. SSS 4.5%, HDMF 2%, PHIC 3% of monthly, not × pax. Per diem = (max line per diem, or ₱500) × active days. Allowance = max allowance × active days. The footer at 15239 sums the unrounded totals.
- Export BOL: `buildBolExportSection` 17228. It uses `buildBolGroups(...).grandTotal` per work type.
- Other summary sheets: `buildCategoryAutoRows` 15252, `categoryEditedRow` 15285, grand 15341–15343.
- `MISCSheet` grand 15914. Sections B, D, and E use qty × days × cost. Other sections use qty × cost. It does not call `miscAmount`.

SQL written: none.

Questions:

1. The seed writes `app_user_roles` with `SUPABASE_SERVICE_ROLE_KEY` (signed-in users have no insert policy). Confirm that env name.
2. The seed loads one RCE, one legacy CE, and one inspection. Say if you want more than one of each.
3. Groove 10 mm with the stated 10% reinforcement is 0.671 kg/m of weld metal, not 0.61. 0.61 is that joint with reinforcement 0. Say if the screen should show 0.61 instead.

Risks:

- When the test guard is on, Better Auth also exposes email sign-up. `server.ts` enables the whole plugin and is outside this step.
- `src/routes/api/auth/$.ts` returns 404 for `/api/auth/sign-in/email` when the guard is off. Better Auth itself returns 400, so the route file had to answer first. That file was not on the allowed list.
- The BOL sheet is not the sum of the labour lines. Same role, day type, and shift are merged onto the schedule rectangle, and the first line's OT hours are used. The golden test locks that number.
- Benefits are not in the grand. A blank per diem becomes ₱500 per active day.
- The approval preview ignores `summaryOverrides`. The screen official total and the export total both honour them. On these fixtures the screen and the export match to the centavo.

## Step 11 done

Stacked on `grok/phase-2c` (https://github.com/ken2025mendoza11/Estimator-System/pull/10 is still open). Draft PR: https://github.com/ken2025mendoza11/Estimator-System/pull/11. Do not merge to `main`.

Baseline before the first Step 11 edit (same tree as the Step 10 correction, `a5fb57e`): `npm test` 272 + 96, 0 failures. `tsc` 0. `eslint` 0 errors, 166 warnings. Build ok. `npm ci` was not repeated.

- `8cd7fb7` Add Phase 5 suffix, calendar, price, and scope helpers.
- `2a61ecc` Wire Phase 5 behind flags that stay off.

After Step 11: `npm test` 283 + 96, 0 failures. `tsc` 0. `eslint` 0 errors, 174 warnings. Build ok. Golden totals unchanged.

### What shipped

- Five flags, each off unless it is exactly `true`: `monitoringFamilies`, `docSuffixes`, `scopeLibraryV2`, `priceCheck`, `branding`. Off, monitoring rows, document numbers, award writes, prebuilt templates, clone behavior, and CSS variables stay as they are.
- On, active monitoring shows one row per CE family, with tags and an expandable member list. `foldMonitoringRows` is still the flag-off path.
- Alternates are `-A` to `-D`. A lead, head, or admin must give a reason. Admin is included so the test admin can mint one. Staff cannot. A non-empty admin reason list must contain the reason. Addendum is only when the CE award field is Awarded: the original gets `-AD1`, alternate B gets `-B-AD1`. An update copy is `-U1` on the same stem and does not take a new serial. Urgent is the next normal number plus the tag "RCE to follow". There is no CE-M series.
- Awarded / Lost and a job-order number are copied onto the linked RCE. Monitoring still reads the CE field.
- Combined total is a display sum of the original amount plus approved addendums. It does not call `projectTotal`. Alternates and update copies are not added.
- Admin Phase 5 holds the reason list, the existing `authorisations.takeover` key, the PH holiday list, and branding colors. Branding paints `--bg`, `--card`, `--ink`, `--ledger`, and `--brass` only when the flag is on.
- `phCalendar.js` treats YYYY-MM-DD as a Manila date. Sunday is not a working day. Saturday is, unless that date is on the holiday list. `computeSchedule` is not changed.
- Scope library records owner, an Official tag, and a usage count, and Save as scope stores a snapshot. A prebuilt "with resources" template seeds labor, tools, and PPE (a supply line for trading) only when `scopeLibraryV2` is on. Rates on those seeds are 0.
- Price check runs after `remapCloneIds` when `priceCheck` is on. It uses `clonedFrom.idMap`. Resync all, resync selected, or keep is logged. Constant drift is listed and not written into the total.

SQL written, not run: `supabase/p5-numbering-suffixes-2026-10-20.sql`, then the rollback file only if it must be undone. Apply on the TEST project after `p1a-numbering-2026-10-20.sql`. `next_ce_suffix` issues the next letter, addendum, or update under an advisory lock and also skips numbers already stored on `workspace_docs`. It does not replace `next_doc_no` and it does not touch `estimator_files_*`. The rollback drops only `next_ce_suffix` and `ce_suffix_alloc`. If the function is missing, the app scans the numbers it already has.

Flags: all five ship off.

Questions: none new. The three questions below are still open.

Risks:

- The helper commit is about 1,100 lines because the modules, tests, and SQL shipped together. The App wiring is 372 lines. Both build.
- `eslint` is 174 warnings: the Step 10 count of 166 plus one `@ts-nocheck` warning on each new Phase 5 file. The App warning count stayed 111.
- `package.json` gained `phase5.test.mjs`. `workflow.js` only re-exports.
- Family folding runs on the active monitoring board. The executive table is still one row per cost estimate.
- A suffix number taken from the server can differ from the local scan if another user took the letter first. The server id is the one saved.
- Equipment rates, reports, and the mobile viewer are not in this step.

### Questions still open

1. The seed writes `app_user_roles` with `SUPABASE_SERVICE_ROLE_KEY`. Confirm that env name.
2. The seed loads one RCE, one legacy CE, and one inspection. Say if more of each are wanted.
3. Groove 10 mm with the stated 10% reinforcement is 0.671 kg/m of weld metal, not 0.61. 0.61 is that joint with reinforcement 0. Say if the screen should show 0.61 instead.

## Step 12 done

Stacked on `grok/phase-5` (https://github.com/ken2025mendoza11/Estimator-System/pull/11 is still open). Draft PR: https://github.com/ken2025mendoza11/Estimator-System/pull/12. Do not merge to `main`.

Baseline before the first Step 12 edit (same tree as Step 11, `01387cb`): `npm test` 283 + 96, 0 failures. `tsc` 0. `eslint` 0 errors, 174 warnings. Build ok. `npm ci` was not repeated.

- `9275ab0` Add Phase 6 rates, reports, and a mobile viewer behind flags.

After Step 12: `npm test` 288 + 96, 0 failures. `tsc` 0. `eslint` 0 errors, 182 warnings. Build ok. Golden totals unchanged.

### What shipped

- Three flags, each off unless it is exactly `true`: `equipmentRates`, `reports`, `mobileViewer`. Off, BOTE lines, the sidebar, and the home screen stay as they are.
- Admin Phase 6 stores a versioned formula and equipment items (cost, life, salvage, hours, days, maintenance %, rental %). Each of hour, day, rental, and project is a formula or a manual override. The parser is a tokenizer. It does not use `eval` or `Function`. No new dependency.
- Default version 1, for cost 100000, life 5, salvage 10000, hours 8, days 20, maintenance 10, rental 15: hour 2475, day 19800, rental 22770, project 396000. A new BOTE line stores the per-day equivalent in `rate` (`hour` × hours, `project` ÷ days, day and rental already per day) plus `rateType`, `rateVersion`, and `rateSnapshot`. `calcBOTE` is not edited. A line with no `rateType` stays qty × days × rate. A saved line is not rewritten when the formula later changes. Picking "day" on a line that has no rate type does nothing.
- Reports, only when `reports` is on: pipeline, win rate = Awarded ÷ (Awarded + Not awarded), mean speed in days, open workload, cost mix from `categoryOnTask` as a reader, and accuracy. Excel uses the `xlsx` package already in the app.
- Mobile viewer route `/view/$kind/$id`. The screen is read-only and shows Approve only when `mobileViewer` is on and the Step 8 engine says this person can approve. Approve calls `decideApproval`. Reject is still refused. A final step sets CE to Done, RCE to Accepted, and OIF to Noted. The flag off leaves the normal app.

SQL written: none.

Flags: all three ship off.

Questions: none new. The three questions below are still open.

Risks:

- The code commit is about 1,100 lines because the modules, the viewer route, and the App wiring shipped together. It builds.
- `eslint` is 182 warnings: the Step 11 count of 174 plus one `@ts-nocheck` warning on each new Phase 6 file. The App warning count stayed 111. `routeTree.gen.ts` is ignored by eslint.
- `package.json` gained `phase6.test.mjs`. `workflow.js` only re-exports. `CostEstimatorApp.d.ts` gained an optional `mobileView` prop so the shell typechecks.
- A formula that divides by zero, or an hour or project rate with hours or days missing, does not invent a line rate.
- The mobile route is registered. With the flag off, that route still opens the normal app and does not show the viewer.

### Questions still open

1. The seed writes `app_user_roles` with `SUPABASE_SERVICE_ROLE_KEY`. Confirm that env name.
2. The seed loads one RCE, one legacy CE, and one inspection. Say if more of each are wanted.
3. Groove 10 mm with the stated 10% reinforcement is 0.671 kg/m of weld metal, not 0.61. 0.61 is that joint with reinforcement 0. Say if the screen should show 0.61 instead.

## Step 13 done

Stacked on `grok/phase-6` (https://github.com/ken2025mendoza11/Estimator-System/pull/12 is still open). Draft PR: https://github.com/ken2025mendoza11/Estimator-System/pull/13. Do not merge to `main`.

Baseline before the first Step 13 edit (same tree as Step 12, `7c64909`): `npm test` 288 + 96, 0 failures. `tsc` 0. `eslint` 0 errors, 182 warnings. Build ok. `npm ci` was not repeated.

- `c028685` Add a pre-submit checker behind a flag that stays off.

After Step 13: `npm test` 292 + 96, 0 failures. `tsc` 0. `eslint` 0 errors, 187 warnings. Build ok. Golden totals unchanged.

### What shipped

- One flag, off unless it is exactly `true`: `checkerV2`. Off, Submit CE still calls `saveVersion()` immediately and the old dialog still uses `buildCePreflight`.
- On, Submit CE opens the checker and does not save until there are no errors and every warning has a checkbox plus a reason. The report is stored on the version and on `document.checkerReports` (new key only) and shown to approvers. Final approval is blocked while errors remain. Request edit is not blocked. Export stays on the old preflight.
- Existing zero/empty, tool kW, ad-hoc, override, stale rate, special rate, no priced line, no-quote reason, linked RCE, manual extras, SOW, drawing, electricity, and entry-gap messages stay. Nested subtasks are walked.
- New rules: an unpriced line is an Error, unit sanity, onsite days with no per diem, out-of-range values, and a `direct-v1` summary that does not match the breakdown is an Error. Step 6 warnings (blank work type, onsite power, missing per diem rate, MISC blank days, non-numeric) are included. `ceTotals.js` was not rewritten.
- Spelling is a Warning. Ignore once is this session. Ignore in this CE writes `spellIgnore`. Add writes `adminConfig.checker.words`. Database names are treated as correct. Same item and specs in one subtask is an Error with Merge. Same activity and day type is a Warning. A near name is a Warning with Use DB item.
- Admin Phase 7 can turn rules off, change severity, set ranges, and add dictionary words. Missing config uses the defaults.

SQL written: none.

Flags: `checkerV2` ships off.

Questions: none new. The three questions below are still open.

Risks:

- The code commit is 975 lines because the checker, the panel, the admin tab, the pinned dictionary, and the App wiring shipped together. It builds.
- `eslint` is 187 warnings: the Step 12 count of 182 plus one `@ts-nocheck` warning on each of `checker.js`, `spellBrowser.js`, `phase7.test.mjs`, `Phase7Admin.jsx`, and `CheckerPanel.jsx`. The App warning count stayed 111.
- `package.json` gained `phase7.test.mjs` plus pinned `nspell@2.1.5` and `dictionary-en@4.0.0`. `workflow.js` only re-exports. `calcBOTE` was not edited.
- The English dictionary is about 552KB and is bundled in the client. The build still succeeds. The client chunk is larger.
- Flag off is source-asserted: `if (!checkerOn) saveVersion()` and `buildCePreflight(...)` remain.
- Quotations, availability, locations, and pending records are not in this step.

### Questions still open

1. The seed writes `app_user_roles` with `SUPABASE_SERVICE_ROLE_KEY`. Confirm that env name.
2. The seed loads one RCE, one legacy CE, and one inspection. Say if more of each are wanted.
3. Groove 10 mm with the stated 10% reinforcement is 0.671 kg/m of weld metal, not 0.61. 0.61 is that joint with reinforcement 0. Say if the screen should show 0.61 instead.

## Step 14 done

Stacked on `grok/phase-7` (https://github.com/ken2025mendoza11/Estimator-System/pull/13 is still open). Draft PR: https://github.com/ken2025mendoza11/Estimator-System/pull/14. Do not merge to `main`.

Baseline before the first Step 14 edit (same tree as Step 13, `f776ef7`): `npm test` 292 + 96, 0 failures. `tsc` 0. `eslint` 0 errors, 187 warnings. Build ok. `npm ci` was not repeated.

- `6f39153` Add quotations, availability, locations, and pending records behind flags.

After Step 14: `npm test` 300 + 96, 0 failures. `tsc` 0. `eslint` 0 errors, 192 warnings. Build ok. Golden totals unchanged.

### What shipped

- Four flags, each off unless it is exactly `true`: `quotations`, `availability`, `clientLocations`, `pendingRecords`. Off, the estimate, the export, and the masterlist sheets stay as they are. Export with no annexes still calls `doc.save`.
- On, a quotation file is hashed with SHA-256 and stored once on the masterlist JSON. A second upload of the same file reuses that row. The cost estimate stores `{ quotationId, includeAnnex }` only. A quote line becomes a CE line at the database price when that price is above 0, and at the quote price only when the database price is missing.
- The quotation PDF is previewed inline. Ticked annexes are appended after the finished cost-estimate PDF by `stitchPdfAttachments`. Untick applies to that export only. The base summary layout is not redrawn.
- Availability keys start empty. Nothing is seeded. A key is stored on the item JSON as `availabilityKey`.
- A client location is `{ id, label, address, city, notes }` on `client.locations`. There is no Sites table. The client's existing code, name, and address stay.
- A pending record is submitted, recommended by a lead, head, or admin, then finalised by an admin. Merge re-points `masterlistId` on Draft, Ongoing, and For revision estimates only. For approval, Done, and the other locked statuses are skipped and not rewritten. Reminders use the existing 08:00–22:00 Asia/Manila slots, one every 3 hours. Escalation is after N working days, default 3, from the admin field `pendingEscalateDays`.
- Checker rules `quote-over-db`, `quote-missing`, `availability`, `client-location`, and `pending-open` run only when the matching flag is on.

SQL written, not run: `supabase/p8-quotations-2026-10-20.sql`, then the rollback file only if it must be undone. Apply on the TEST project after `p1b-access-2026-10-20.sql`. It adds `quotations`, `quotation_lines`, `document_quotations`, `client_locations`, and `pending_records`. It does not alter `clients` or `masterlist_items`. The screen writes the JSON doc. `tryMirror` returns missing when a table is absent. `supabase-workspace.ts` is not changed, so a missing table cannot block a save.

Flags: all four ship off.

Questions: none new. The three questions below are still open.

Risks:

- The code commit is 1,364 lines because the modules, the panel, the SQL, and the App wiring shipped together. It builds.
- `eslint` is 192 warnings: the Step 13 count of 187 plus one `@ts-nocheck` warning on each of `phase8.js`, `pdfAnnex.js`, `phase8.test.mjs`, `Phase8Admin.jsx`, and `Phase8Panels.jsx`. The App warning count stayed 111.
- `package.json` gained `phase8.test.mjs`. `workflow.js` only re-exports. `calcBOTE` was not edited.
- A quotation's data URL lives once on the masterlist JSON, so a large PDF makes that document larger. The cost estimate stores only the id.
- The route and fuel calculator is not in this step.

### Questions still open

1. The seed writes `app_user_roles` with `SUPABASE_SERVICE_ROLE_KEY`. Confirm that env name.
2. The seed loads one RCE, one legacy CE, and one inspection. Say if more of each are wanted.
3. Groove 10 mm with the stated 10% reinforcement is 0.671 kg/m of weld metal, not 0.61. 0.61 is that joint with reinforcement 0. Say if the screen should show 0.61 instead.

## Step 15 done

Stacked on `grok/phase-8` (https://github.com/ken2025mendoza11/Estimator-System/pull/14 is still open). Draft PR: https://github.com/ken2025mendoza11/Estimator-System/pull/15. Do not merge to `main`.

Baseline before the first Step 15 edit (same tree as Step 14, `b0eeb5e`): `npm test` 300 + 96, 0 failures. `tsc` 0. `eslint` 0 errors, 192 warnings. Build ok. `npm ci` was not repeated.

- `7963c6e` Add a route and fuel calculator behind a flag that stays off.

After Step 15: `npm test` 306 + 96, 0 failures. `tsc` 0. `eslint` 0 errors, 197 warnings. Build ok. Golden totals unchanged.

### What shipped

- One flag, off unless it is exactly `true`: `routeFuel`. Off, the EL calculator tabs stay weld, paint, raw, air, and standards. There is no Route and fuel tab and no print bar.
- On, the calculator gains a Route and fuel tab. The other calculators get a print view. The route panel has its own print view. Print styles sit inside that bar, so they are absent when the flag is off.
- The map uses OpenStreetMap tiles through `GET /api/route-fuel`. Road kilometres come from OSRM through the same route, cached in memory for 6 hours. The first map click is the start and the next is the end. Circles and a polyline are used. There is no geocoder. If the service fails, the user types the kilometres.
- Fuel is kilometres divided by km per litre, times the regional price, plus 10%. Tolls and a ferry amount are extra and are not inside the fuel formula. A truck is warned, not blocked, on a weekday Manila departure inside 06:00–10:00 or 17:00–22:00.
- Vehicles, fuel prices, and tolls live in admin JSON. Nothing is seeded. Admin Phase 9 can add them only while the flag is on.
- Add to cost estimate uses the existing Step 7 dialog. The line is MISC section B, description "Route fuel", and the snapshot keeps fuel, tolls, and the ferry apart.

SQL written, not run: `supabase/p9-route-fuel-2026-10-20.sql`, then the rollback file only if it must be undone. Apply on the TEST project after `p1b-access-2026-10-20.sql`. It adds `vehicles`, `fuel_prices`, and `route_tolls`. It does not alter `clients` or `masterlist_items`. The screen writes the JSON. A missing table cannot block a save. `supabase-workspace.ts` is not changed.

Flags: `routeFuel` ships off. `leaflet` is pinned at `1.9.4`.

Questions: none new. The three questions below are still open.

Risks:

- The code commit is 861 lines because the calculator, the map, the cached route, the SQL, and the App wiring shipped together. It builds.
- `eslint` is 197 warnings: the Step 14 count of 192 plus one `@ts-nocheck` warning on each of `routeFuel.js`, `routeFuel.server.js`, `phase9.test.mjs`, `RouteFuelPanel.jsx`, and `Phase9Admin.jsx`. The App warning count stayed 111.
- `package.json` gained `phase9.test.mjs` and pinned `leaflet@1.9.4`. `workflow.js` only re-exports. `calcBOTE` and `money.js` were not edited. The calculator only reads `roundMoney`.
- The public OSRM and OSM demo servers can be slow or refuse a request. The calculator then asks for a typed distance. The cache is in memory only, so a new server starts empty.
- Leaflet is loaded only in the browser, after the flag is on and the route tab is open. It is not imported at the top of a server module.
- SOW tagging, the Gantt, and the project schedule are not in this step.

### Questions still open

1. The seed writes `app_user_roles` with `SUPABASE_SERVICE_ROLE_KEY`. Confirm that env name.
2. The seed loads one RCE, one legacy CE, and one inspection. Say if more of each are wanted.
3. Groove 10 mm with the stated 10% reinforcement is 0.671 kg/m of weld metal, not 0.61. 0.61 is that joint with reinforcement 0. Say if the screen should show 0.61 instead.

## Step 16 done

Stacked on `grok/phase-9` (https://github.com/ken2025mendoza11/Estimator-System/pull/15 is still open). Draft PR: https://github.com/ken2025mendoza11/Estimator-System/pull/16. Do not merge to `main`.

Baseline before the first Step 16 edit (same tree as Step 15, `71d75be`): `npm test` 306 + 96, 0 failures. `tsc` 0. `eslint` 0 errors, 197 warnings. Build ok. `npm ci` was not repeated.

- `b01e183` Add SOW headings and a project schedule behind flags that stay off.

After Step 16: `npm test` 312 + 96, 0 failures. `tsc` 0. `eslint` 0 errors, 201 warnings. Build ok. Golden totals unchanged.

### What shipped

- Two flags, each off unless it is exactly `true`: `sowTagging` and `schedule`. Off, the scope editor stays the scope text and the export order stays as it is. There is no Project schedule page.
- On, scope headings sit beside the existing scope text. `sowText` is kept. Split into headings does nothing until Confirm. Each heading has one activity id. A heading with no activity, an activity that is not a task id, and a task with no heading are coverage warnings. They run only when `sowTagging` is on.
- Version snapshots keep `sowText` and `sow`. A saved schedule is included when the estimate has one.
- The schedule is stored on the cost estimate, keyed by task id. Day numbers come from the existing schedule function and are not rewritten. Bars are drawn as a plain SVG on Philippine working days (Sunday off, Saturday on unless it is a listed holiday). Finish to start only. No resource view, milestones, critical path, or lags.
- A locked estimate keeps the baseline rows. Draft, Ongoing, and For revision can move the working bars and still keep that baseline. A clone remaps the task ids.
- With `schedule` on, the export order is Summary, scope of work, cost breakdown, project schedule, then annexes. The Project schedule page lists estimates.

SQL written, not run: `supabase/p10-schedule-2026-10-20.sql`, then the rollback file only if it must be undone. Apply on the TEST project after `p1b-access-2026-10-20.sql`. It adds `ce_schedule`. It does not alter `clients` or `masterlist_items`. The screen writes the JSON. A missing table cannot block a save.

Flags: both ship off.

Questions: none new. The three questions below are still open.

Risks:

- The code commit is 609 lines because the headings, the chart, the export order, and the App wiring shipped together. It builds.
- `eslint` is 201 warnings: the Step 15 count of 197 plus one `@ts-nocheck` warning on each of `phase10.js`, `phase10.test.mjs`, `Phase10Admin.jsx`, and `Phase10Panels.jsx`. The App warning count stayed 111.
- `package.json` gained `phase10.test.mjs`. `workflow.js` only re-exports. `computeSchedule`, `calcBOTE`, and `money.js` were not edited.
- The public holiday list is whatever Admin already stored. A blank start date uses today's Asia/Manila date.
- Sign-in and sign-up UI are not in this step.

### Questions still open

1. The seed writes `app_user_roles` with `SUPABASE_SERVICE_ROLE_KEY`. Confirm that env name.
2. The seed loads one RCE, one legacy CE, and one inspection. Say if more of each are wanted.
3. Groove 10 mm with the stated 10% reinforcement is 0.671 kg/m of weld metal, not 0.61. 0.61 is that joint with reinforcement 0. Say if the screen should show 0.61 instead.

## Step 17 done

Ken approved doing this on the open stack. Step 4 is on `grok/phase-1b`, not on `main`. Draft PR: https://github.com/ken2025mendoza11/Estimator-System/pull/17. Do not merge to `main`.

- The sign-in page keeps the session loader and the same `signIn` calls. The TEST banner and the fake-user buttons show only when test sign-in is on.
- A new person fills in full name, department, mobile, and an e-signature, then waits. The waiting screen uses Philippine stamp marks. After an administrator accepts them, a three-stop welcome shows once.
- The admin queue has Pending, Possible duplicates, Active, Declined, Disabled, and Allowlist. A pending account older than three hours raises a reminder when an administrator opens the queue.
- The same email is a strong match. A similar name is only a warning. Granting a role refuses a second active account with that email. A Microsoft sign-in does not take over a Google account and does not rewrite its user id. Link requests stay off unless `microsoftLinkFlow` is turned on, and even then they are only saved.
- The public sign-in name, logo, and contact come from `get_public_branding()`. Before this SQL is applied, sign-in stays as it was and people who are already signed in stay signed in.

SQL written, not run: `supabase/plui-signup-2026-10-20.sql`, then the rollback file only if it must be undone. Apply on the TEST project after `p1b-access-2026-10-20.sql`. It does not alter `clients` or `masterlist_items`.

`microsoftLinkFlow` ships off. The login mockup PDF was not in the workspace, so the screens follow the written scope and the existing `ce-*` classes.

A later commit on the same PR keeps a duplicate sign-in as a pending row (`duplicate_of` set, never active), leaves the nine new columns in place on rollback, checks the SQL with a PASS/FAIL block, and shows the Manila greeting and pending stamp from `phTime`.

Tests: `npm test` 323 + 96, 0 failures. `tsc` 0. `eslint` 0 errors, 205 warnings (201 plus one `@ts-nocheck` warning on each of `loginUi.js`, `loginUi.test.mjs`, `AccessScreens.jsx`, and `AccessQueue.jsx`). Build ok.

### Questions still open

1. The seed writes `app_user_roles` with `SUPABASE_SERVICE_ROLE_KEY`. Confirm that env name.
2. The seed loads one RCE, one legacy CE, and one inspection. Say if more of each are wanted.
3. Groove 10 mm with the stated 10% reinforcement is 0.671 kg/m of weld metal, not 0.61. 0.61 is that joint with reinforcement 0. Say if the screen should show 0.61 instead.




