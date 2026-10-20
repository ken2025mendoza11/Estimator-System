# Grok progress

One step per turn. Do not start the next step until Ken says `continue`.

Baseline at `88f5e91` (before Step 1): `npm test` 208 + 73, 0 failures. `tsc` 0 errors. `eslint` 0 errors, 156 warnings. Build ok.

| Step | Name | Status | Branch | PR |
| --- | --- | --- | --- | --- |
| 1 | Phase 0: test sign-in, seed, guardrail files | done | `grok/phase-0` | https://github.com/ken2025mendoza11/Estimator-System/pull/1 |
| 2 | GOLD: computation map + golden lock | done | `grok/phase-gold` | https://github.com/ken2025mendoza11/Estimator-System/pull/2 |
| 3 | Phase 1A: data safety | done | `grok/phase-1a` | https://github.com/ken2025mendoza11/Estimator-System/pull/3 |
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
- `bc6efeb` Document the test deployment and the step table.

Item in progress: none. Step 2 is done on `grok/phase-gold`.

## Step 2 done

Stacked on `grok/phase-0` (https://github.com/ken2025mendoza11/Estimator-System/pull/1 is still open). Draft PR: https://github.com/ken2025mendoza11/Estimator-System/pull/2. Do not merge to `main`.

- `4d2bf69` Add the four section D cost-estimate examples.
- `3924f60` Lock today's cost-estimate totals in a golden test.

Baseline before the first Step 2 edit (same tree as Step 1): `npm test` 210 + 84, 0 failures. `tsc` 0. `eslint` 0 errors, 156 warnings. Build ok. `npm ci` was not repeated; the Step 1 install was still present.

After Step 2: `npm test` 219 + 84, 0 failures. `tsc` 0. `eslint` 0 errors, 156 warnings. Build ok. No behaviour change. No `src/` code edited.

Item in progress: none. Step 3 is done on `grok/phase-1a`, stacked on `grok/phase-gold`. Do not start Step 4 until Ken says `continue`.

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

Line numbers are `src/components/CostEstimatorApp.jsx` on this branch unless noted. No formula was moved.

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

Risks:

- When the test guard is on, Better Auth also exposes email sign-up. `server.ts` enables the whole plugin and is outside this step.
- `src/routes/api/auth/$.ts` returns 404 for `/api/auth/sign-in/email` when the guard is off. Better Auth itself returns 400, so the route file had to answer first. That file was not on the allowed list.
- The BOL sheet is not the sum of the labour lines. Same role, day type, and shift are merged onto the schedule rectangle, and the first line's OT hours are used. The golden test locks that number.
- Benefits are not in the grand. A blank per diem becomes ₱500 per active day.
- The approval preview ignores `summaryOverrides`. The screen official total and the export total both honour them. On these fixtures the screen and the export match to the centavo.
