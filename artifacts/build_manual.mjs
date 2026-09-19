import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(import.meta.url);
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageNumber, LevelFormat, VerticalAlign } = require('docx');

const INK = '1A1914';
const MUTED = '5C584E';
const LEDGER = '2F5D50';
const CREAM = 'F6F4EE';
const LINE = 'D4CFC4';
const WARN = '8A4B12';
const KEEP = '1F4E3A';
const GAP = '7A2E2E';

const thin = { style: BorderStyle.SINGLE, size: 4, color: LINE };
const borders = { top: thin, bottom: thin, left: thin, right: thin };
const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

const W = 10080; // letter, 0.75" margins

function p(text, opts = {}) {
  const { bold, size = 22, color = INK, italics, after = 120, before = 0, align } = opts;
  return new Paragraph({
    alignment: align,
    spacing: { after, before, line: 276 },
    children: [new TextRun({ text, font: 'Calibri', size, bold, italics, color })],
  });
}
function runs(parts, opts = {}) {
  return new Paragraph({
    spacing: { after: opts.after ?? 120, before: opts.before ?? 0, line: 276 },
    alignment: opts.align,
    children: parts.map((x) =>
      new TextRun({
        text: x.text,
        font: 'Calibri',
        size: x.size ?? 22,
        bold: x.bold,
        italics: x.italics,
        color: x.color ?? INK,
      })
    ),
  });
}
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: LEDGER, space: 6 } },
    children: [new TextRun({ text, font: 'Calibri', size: 32, bold: true, color: LEDGER })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 100 },
    children: [new TextRun({ text, font: 'Calibri', size: 26, bold: true, color: INK })],
  });
}
function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 80 },
    children: [new TextRun({ text, font: 'Calibri', size: 24, bold: true, color: MUTED })],
  });
}
function bullet(text, ref = 'bullets') {
  return new Paragraph({
    numbering: { reference: ref, level: 0 },
    spacing: { after: 60, line: 276 },
    children: [new TextRun({ text, font: 'Calibri', size: 22, color: INK })],
  });
}
function num(text, ref) {
  return new Paragraph({
    numbering: { reference: ref, level: 0 },
    spacing: { after: 60, line: 276 },
    children: [new TextRun({ text, font: 'Calibri', size: 22, color: INK })],
  });
}
function cell(text, width, opts = {}) {
  const { header, fill, bold, color, align, span } = opts;
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    columnSpan: span,
    shading: { fill: fill || (header ? LEDGER : 'FFFFFF'), type: ShadingType.CLEAR },
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: align || AlignmentType.LEFT,
        spacing: { after: 0 },
        children: [
          new TextRun({
            text,
            font: 'Calibri',
            size: header ? 18 : 20,
            bold: bold ?? header,
            color: header ? 'FFFFFF' : color || INK,
          }),
        ],
      }),
    ],
  });
}
function row(cells) {
  return new TableRow({ children: cells, cantSplit: true });
}
function table(colWidths, rows) {
  return new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: colWidths,
    rows,
  });
}
function spacer(n = 80) {
  return new Paragraph({ spacing: { after: n }, children: [] });
}
function callout(title, body, fill = CREAM) {
  return new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [W],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: {
              top: { style: BorderStyle.SINGLE, size: 12, color: LEDGER },
              bottom: { style: BorderStyle.SINGLE, size: 4, color: LINE },
              left: { style: BorderStyle.SINGLE, size: 24, color: LEDGER },
              right: { style: BorderStyle.SINGLE, size: 4, color: LINE },
            },
            width: { size: W, type: WidthType.DXA },
            shading: { fill, type: ShadingType.CLEAR },
            margins: { top: 100, bottom: 100, left: 140, right: 140 },
            children: [
              new Paragraph({
                spacing: { after: 60 },
                children: [new TextRun({ text: title, font: 'Calibri', size: 20, bold: true, color: LEDGER })],
              }),
              new Paragraph({
                spacing: { after: 0, line: 276 },
                children: [new TextRun({ text: body, font: 'Calibri', size: 21, color: INK })],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

const verdictW = [1600, 2800, 5680];
function verdictRow(item, tag, note, tagColor) {
  return row([
    cell(item, 1600, { bold: true }),
    cell(tag, 2800, { bold: true, color: tagColor }),
    cell(note, 5680),
  ]);
}

const doc = new Document({
  styles: {
    default: { document: { run: { font: 'Calibri', size: 22 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: 'Calibri', size: 32, bold: true, color: LEDGER },
        paragraph: { spacing: { before: 360, after: 160 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: 'Calibri', size: 26, bold: true, color: INK },
        paragraph: { spacing: { before: 280, after: 100 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: 'Calibri', size: 24, bold: true, color: MUTED },
        paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 420, hanging: 240 } } } }] },
      { reference: 'flow', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 420, hanging: 240 } } } }] },
      { reference: 'roles', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 420, hanging: 240 } } } }] },
      { reference: 'howto', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 420, hanging: 240 } } } }] },
      { reference: 'improve', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 420, hanging: 240 } } } }] },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
      },
    },
    headers: {
      default: new Header({
        children: [
          new Paragraph({
            spacing: { after: 80 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: LEDGER, space: 6 } },
            children: [
              new TextRun({ text: 'Estimator System  ', font: 'Calibri', size: 18, bold: true, color: LEDGER }),
              new TextRun({ text: 'User Manual & Process Guide  ·  Working draft', font: 'Calibri', size: 18, color: MUTED }),
            ],
          }),
        ],
      }),
    },
    footers: {
      default: new Footer({
        children: [
          new Paragraph({
            border: { top: { style: BorderStyle.SINGLE, size: 6, color: LINE, space: 8 } },
            children: [
              new TextRun({ text: 'Controlled working document  ·  Not a live approval procedure  ·  Page ', font: 'Calibri', size: 16, color: MUTED }),
              new TextRun({ children: [PageNumber.CURRENT], font: 'Calibri', size: 16, color: MUTED }),
              new TextRun({ text: ' of ', font: 'Calibri', size: 16, color: MUTED }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], font: 'Calibri', size: 16, color: MUTED }),
            ],
          }),
        ],
      }),
    },
    children: [
      p('COSTING DEPARTMENT', { size: 20, color: LEDGER, bold: true, after: 40 }),
      p('Estimator System', { size: 56, bold: true, after: 40 }),
      p('User Manual, Process Flow & Improvement Review', { size: 28, color: MUTED, after: 200 }),
      p('Purpose of the system: reduce the time it takes to produce a cost estimate, and raise the accuracy of the number that goes to the client.', { italics: true, after: 200 }),
      table([2400, 7680], [
        row([cell('Document type', 2400, { header: true }), cell('Working manual (current system + agreed future rules)', 7680, { header: true })]),
        row([cell('Status', 2400), cell('Describes the system as built today. Workflow recommendations (approvals engine, job statuses, assist/transfer) are agreed but not implemented.', 7680)]),
        row([cell('Audience', 2400), cell('Requestors (Sales), Estimators, Leads, Heads, Administrators, Document Controllers', 7680)]),
        row([cell('Out of scope', 2400), cell('Login / authentication is deferred. This manual does not treat sign-in as a current feature.', 7680)]),
        row([cell('Date', 2400), cell('19 September 2026', 7680)]),
      ]),

      h1('1. Why this system exists'),
      p('The department’s problem is not “we need more spreadsheets.” It is two failures that compound:'),
      bullet('Slow generation — every new request is rebuilt by hand: rates looked up, manpower retyped, tools copied from last job, electricity forgotten or applied to the wrong place, attachments assembled after the fact.'),
      bullet('Low accuracy — the number is only as good as the last person’s memory. Onsite tools get shop power cost. Peak manpower is guessed instead of scheduled. Zero rates slip through. The RCE that arrived is not the RCE attached to the CE. Revisions overwrite without a trail.'),
      p('The Estimator System is a single workspace that turns a Request for Cost Estimate into a structured Cost Estimate: one breakdown, one set of rates from a shared database, one set of summary sheets that cannot drift from the breakdown, and a paper trail (RCE, notes, files, inspection).'),
      callout('What “good” looks like', 'A complete, internally consistent CE should be produceable in hours, not days, because labor/tools/PPE/consumables are pulled from the database and from reusable task packs; the total should be defensible because schedule logic, work type (onsite / shop / trading), and rates are system-owned rather than retyped.'),

      h1('2. What is in the product today'),
      h2('2.1 The two documents'),
      table([2200, 3940, 3940], [
        row([cell('', 2200, { header: true }), cell('RCE — Request for Cost Estimate', 3940, { header: true }), cell('CE — Cost Estimate', 3940, { header: true })]),
        row([cell('Owner', 2200, { bold: true }), cell('Requestor (Sales)', 3940), cell('Estimator', 3940)]),
        row([cell('Question', 2200, { bold: true }), cell('May we estimate this, and is this the latest request?', 3940), cell('What does it cost, and how is that built?', 3940)]),
        row([cell('Created from', 2200, { bold: true }), cell('Dashboard + RCE, or Monitoring → RCE Request', 3940), cell('Dashboard + Cost Estimate, or RCE Detail → Generate CE', 3940)]),
        row([cell('Number', 2200, { bold: true }), cell('Auto RCE-YYYY-NNN', 3940), cell('Auto CE-YYYY-NNN', 3940)]),
        row([cell('Today after Submit', 2200, { bold: true }), cell('Lands in RCE Request as Pending. No approval engine.', 3940), cell('Opens in the editor. Auto-saves. Status is a dropdown.', 3940)]),
      ]),

      h2('2.2 Screens'),
      table([2200, 7880], [
        row([cell('Screen', 2200, { header: true }), cell('What it is today', 7880, { header: true })]),
        row([cell('Dashboard', 2200, { bold: true }), cell('Personal queue of CEs assigned to the current user. Buttons: Create Inspection Report, Cost Estimate, RCE. Filter by Draft / Ongoing / Done / Parked.', 7880)]),
        row([cell('Monitoring', 2200, { bold: true }), cell('Tabs: Active (sample data), Archive (searchable CE archive with revisions), Inspection (live OIF table), RCE Request (live RCE list), Executive (sample KPIs).', 7880)]),
        row([cell('Scope Library', 2200, { bold: true }), cell('CE templates (Onsite / Shop / Hybrid / Trading cards), Per Task Template editor, Search Archive.', 7880)]),
        row([cell('Database', 2200, { bold: true }), cell('Masterlists: Manpower, Equipment, Consumables, PPE, Misc, Clients, plus user-added sheets. Editable headers, resizable columns, CSV import, add-column.', 7880)]),
        row([cell('EL Calculator', 2200, { bold: true }), cell('Standalone weld / paint / raw-material helpers and standards lookup. Not yet wired into a CE line.', 7880)]),
        row([cell('Admin', 2200, { bold: true }), cell('Users, pending access, designations, approval-flow configuration (CE / RCE / OIF), document control (two companies, logos, headers). Flows are configured, not executed.', 7880)]),
        row([cell('CE Editor', 2200, { bold: true }), cell('Tabs: Summary, Breakdown, SOW, MOB/DEMOB, BOL, BOCM, BOTE, PPE, MISC, ATTCH, RCE. Park / Resume. Auto-save.', 7880)]),
        row([cell('Inspection form', 2200, { bold: true }), cell('Onsite Inspection Form (OIF): header, photos, activity/service checks, measurements, manpower, scope, materials. Filing document.', 7880)]),
      ]),

      h1('3. User roles (as designed)'),
      p('Login is not in the product yet. Roles already exist in Admin as access levels. Use them as the intended operating model.'),
      table([1800, 2800, 5480], [
        row([cell('Role', 1800, { header: true }), cell('Typical people', 2800, { header: true }), cell('What they should do in this system', 5480, { header: true })]),
        row([cell('Staff', 1800, { bold: true }), cell('Estimator, Sales, Inspector', 2800), cell('Own dashboard, create/edit their documents, file inspections, use EL Calculator. Cannot see department Monitoring or Admin.', 5480)]),
        row([cell('Lead', 1800, { bold: true }), cell('Estimating lead, Sales manager', 2800), cell('Staff work plus Monitoring (Active / RCE / Archive), Scope Library, Database, document approval (when the engine exists).', 5480)]),
        row([cell('Head', 1800, { bold: true }), cell('Department head', 2800), cell('Lead work plus Executive monitoring and final acceptance of documents.', 5480)]),
        row([cell('Administrator', 1800, { bold: true }), cell('System owner / document controller', 2800), cell('Everything, including Admin console: users, designations, approval ladders, company logos and headers.', 5480)]),
      ]),
      callout('Assist vs Transfer (agreed, not built)', 'Continue / assist: owner stays A, B is granted temporary edit. Transfer: admin/lead reassigns owner A → B, with a history line. Do not allow quiet take-over. Accountability for the number must stay visible.'),

      h1('4. Intended process flow'),
      p('This is the operating sequence you approved. Only the document-studio parts exist today. Steps in italics are agreed and not yet a machine.'),
      num('Generate RCE — requestor fills the form (company/logo, client from database, auto RCE No., type checks, checklist, remarks, attachments) and submits.', 'flow'),
      num('RCE approvals — review then a nominated final approver. Reject returns to the requestor with remarks. Cancel and revise are formal actions with remarks and a new revision, not silent overwrites.', 'flow'),
      num('Accepted RCE becomes a job — it appears on RCE Request and on Active monitoring with a NEW mark. It does not become a CE until someone generates one.', 'flow'),
      num('Assign / Generate CE — from Active or from RCE Detail. Wizard links the RCE, copies client/project/location, chooses how to start (blank structured CE vs previous CE). One live CE per accepted RCE.', 'flow'),
      num('Estimate — breakdown by work type (Onsite / Shop / Trading). Pull labor, tools, consumables, PPE from the database or from a Per Task Template. Notes and files live on the task. Auto-save. Park if pausing.', 'flow'),
      num('Waiting for information / Sourcing — estimator can send the ball back to Sales (files/notes only) or mark items that must be outsourced. These are job statuses, not free-text.', 'flow'),
      num('Submit CE — pre-flight checker, then the CE approval ladder. Reject → For revision on the same CE number. Final signature → Done.', 'flow'),
      num('Archive — closed jobs keep every RCE revision, every CE revision, files, remarks, and who signed.', 'flow'),
      spacer(120),
      p('Job statuses (system-owned, not a casual dropdown): Pending · Ongoing · On Park · Waiting for information · Sourcing · For approval · For revision · No quote · Done · Cancelled.', { italics: true }),

      h1('5. How to use the current system'),
      h2('5.1 Create an RCE'),
      num('From Dashboard click + RCE (or Monitoring → RCE Request).', 'howto'),
      num('Choose Company 1 or Company 2 first. The logo follows the company.', 'howto'),
      num('Customer: pick a client from the database to auto-fill the address, or type a new name and address.', 'howto'),
      num('RCE No. is generated from the last number. Fill project title, priority, deadlines, and tick shop / onsite / trading and discipline checks.', 'howto'),
      num('Complete the Yes / No / N/A checklist. Remarks and Reason are free text. Attach files if needed.', 'howto'),
      num('Submit. Today the RCE is stored as Pending in RCE Request. Open it with View. Generate Cost Estimate from the detail page.', 'howto'),

      h2('5.2 Create a Cost Estimate'),
      num('From Dashboard click Cost Estimate, or from an RCE click Generate Cost Estimate.', 'howto'),
      num('Wizard: link an existing RCE when you have one. Confirm client, project, location. Choose a starting shape (onsite / shop / trading structure, or clone a previous CE).', 'howto'),
      num('The editor opens. Work lives in Breakdown first. Summaries are the roll-up, not a second set of books.', 'howto'),
      num('Park Editor pauses the job and keeps auto-save. Resume continues on the same CE.', 'howto'),

      h2('5.3 Breakdown (the source of truth)'),
      p('Tasks are grouped: A. Onsite Works · B. Shop Works · C. Trading. Each main task has a work-type selector. Subtasks can be Sequential or Parallel, with an optional predecessor. That schedule is what Mob/Demob peak-manpower reading uses — do not “fix” peaks by typing them.'),
      bullet('Drag the handle to reorder main tasks or subtasks. They stay inside their work-type group unless you change the type.'),
      bullet('+t adds a subtask after the current one. Copy appends resources from another subtask or from a Per Task Template.'),
      bullet('Select items opens the database with checkboxes so several manpower / tool / consumable / PPE rows can be added at once.'),
      bullet('Each category card (BOL, BOTE, BOCM, PPE, MISC) is a grid with Excel-style column resize and an Item No. column.'),
      bullet('Shop and Trading BOTE include kW, Hrs/Day, ₱/kWh and Electricity. Onsite BOTE does not — power is assumed client-supplied.'),
      bullet('Notes on main task and subtask can be hidden/shown. Files uploaded there compile toward ATTCH.'),
      bullet('Delete asks for confirm in a centered overlay. It removes the task and everything under it.'),

      h2('5.4 Summary sheets'),
      p('BOL, BOTE, BOCM and PPE summaries consolidate the breakdown by work type, with Item No., resizable columns, work-type filter (All / Onsite / Shop / Trading), and notes collected under each block total.'),
      bullet('MOB/DEMOB always shows Mobilization and Demobilization (from onsite tasks). Pickup and Delivery appear in addition when shop or trading work exists. Part A reads scheduled peak labor. Part B rolls pax into Project Manager / Skilled / Admin.'),
      bullet('MISC Requirements default to total manpower from Mob/Demob. Shop/trading hide accommodation-style sections that do not apply.'),
      bullet('ATTCH lists compiled attachments. RCE tab shows the linked request inside the CE.'),
      bullet('Summary tab shows the cost-by-work-type matrix, including electricity only on Shop and Trading BOTE.'),

      h2('5.5 Database'),
      p('This is the rate book. If it is stale, every CE is stale. Keep roles, daily rates, tool rates, consumable unit costs, PPE, and client addresses current. Headers are editable. Columns resize. CSV import must land in the matching column. Extra sheets can be added the same way.'),

      h2('5.6 Scope Library — Per Task Template'),
      p('Save a reusable pack: task name, work type, and rows for BOL / BOTE / BOCM / PPE / MISC, plus notes. In a breakdown subtask use Copy → Per Task Template to append that pack. This is the fastest accuracy-preserving way to reuse a known scope (for example “mechanical seal replacement, shop”).'),

      h2('5.7 Inspection (OIF)'),
      p('Create Inspection Report from the Dashboard. Fill the Onsite Inspection Form (date, OIF No., project, customer, photos, activity, measurements, estimated duration, manpower, scope, materials). Save. It appears under Monitoring → Inspection with Item No., report #, reference CE #, client, date, created by, status. Headers are editable, columns resize, extra columns and filters work like the database. Open a row to see the filed form.'),

      h2('5.8 EL Calculator'),
      p('Use it to size weld metal, coating quantity, or plate/pipe weight when the RCE or inspection does not give a bought-out qty. Copy the result into the breakdown by hand today. Wiring it as “insert into this BOCM row” is an accuracy improvement still open.'),

      h1('6. Feature inventory — improve, lacking, or maintain'),
      p('Each item is judged only against the reason the system exists: faster generation, more accurate numbers. Login is ignored.'),
      spacer(80),
      table(verdictW, [
        row([cell('Area', 1600, { header: true }), cell('Verdict', 2800, { header: true }), cell('Why it matters for speed / accuracy', 5680, { header: true })]),
        verdictRow('Shared database + CSV', 'MAINTAIN — then harden', 'This is the accuracy backbone. A wrong rate here is a wrong CE everywhere. Add last-updated, owner, and “rate expired” flags next.', KEEP),
        verdictRow('Client auto-address', 'MAINTAIN', 'Stops requestors retyping addresses and estimators inventing a site.', KEEP),
        verdictRow('Auto RCE / CE / OIF numbers', 'MAINTAIN', 'Removes collisions and the “what number is this?” delay.', KEEP),
        verdictRow('Company picker + logos', 'MAINTAIN', 'Wrong letterhead is a document-control error, not a costing error, but it blocks issue.', KEEP),
        verdictRow('Breakdown as source of truth', 'MAINTAIN — do not split books', 'Summaries that can be edited independently will diverge. Keep summaries as roll-ups with only clearly marked manual extras.', KEEP),
        verdictRow('Work types in one CE', 'MAINTAIN', 'Hybrid in one file is how you stop building three estimates and adding them in Excel.', KEEP),
        verdictRow('Electricity only on Shop/Trading', 'MAINTAIN', 'This is an accuracy rule. Do not put kWh on onsite tools.', KEEP),
        verdictRow('Sequential / parallel + predecessor', 'MAINTAIN', 'Peak headcount is the usual over/under-statement. Keep schedule-aware Mob/Demob.', KEEP),
        verdictRow('Item No. + column resize', 'MAINTAIN', 'Does not change the number, but estimators will not use a grid they cannot read.', KEEP),
        verdictRow('Notes hide/show + files → ATTCH', 'MAINTAIN', 'Accuracy of the *story* of the number. Reviewers need the assumption next to the line.', KEEP),
        verdictRow('Select items (multi-add)', 'MAINTAIN — expand', 'This is a speed feature. Next: qty/days defaults from the task duration, not 1 and 1.', KEEP),
        verdictRow('Copy + Per Task Template', 'MAINTAIN — this is the speed lever', 'A library of 20 real packs will beat any new screen. Make templates the default start, not a hidden tab.', KEEP),
        verdictRow('Auto-save + Park', 'MAINTAIN', 'Fear of losing work is why people stay in Excel. Do not take this away.', KEEP),
        verdictRow('OIF as filing form', 'MAINTAIN structure', 'Inspection is how scope arrives. Speed gain is when OIF manpower/duration/scope can seed a CE.', KEEP),
        verdictRow('RCE checklist form', 'IMPROVE', 'Checklist is visual. It does not gate Submit, does not score completeness, does not warn “onsite ticked but no duration.” Incomplete RCEs are the #1 cause of slow CEs.', WARN),
        verdictRow('RCE → CE handoff', 'IMPROVE', 'Generate CE copies client/title. It does not pull checklist, attachments, work-type ticks, or inspection into the breakdown. Estimator starts from a blank grid beside a PDF.', WARN),
        verdictRow('Wizard templates', 'IMPROVE', 'Onsite / Shop / Trading cards are labels. They do not preload resources. “Clone previous CE” is the only real accelerator and it is easy to clone the wrong job.', WARN),
        verdictRow('Database rates', 'IMPROVE', 'No effective date, no location differential, no “this role is night-shift default.” Estimators still override from memory — which is how accuracy dies.', WARN),
        verdictRow('Zero-value watch', 'IMPROVE', 'It notifies. It does not block Submit. Zero-rate lines still reach a client total.', WARN),
        verdictRow('BOTE electricity inputs', 'IMPROVE', 'Columns exist. Defaults do not. kW and ₱/kWh should come from the equipment master, not be retyped each row.', WARN),
        verdictRow('Mob/Demob Part A/B', 'IMPROVE', 'Reading peaks is correct. Allowance rates and days are still typed. Default days from task duration; lock Part A as read-from-breakdown.', WARN),
        verdictRow('Summary manual rows', 'IMPROVE', 'Needed for extras. Dangerous if used to bypass the breakdown. Mark them clearly and include them in the checker.', WARN),
        verdictRow('SOW tab', 'IMPROVE', 'Free text. Should be seeded from RCE remarks + OIF scope + breakdown task titles so the narrative cannot contradict the grid.', WARN),
        verdictRow('ATTCH compile', 'IMPROVE', 'Files attach. There is no required-evidence list from the RCE checklist (drawing, spec, photos).', WARN),
        verdictRow('EL Calculator', 'IMPROVE', 'Useful but isolated. “Insert result as BOCM qty” would stop transcription error.', WARN),
        verdictRow('Monitoring Active / Executive', 'IMPROVE / replace mock', 'Sample rows do not show live aging. You cannot manage slowness you cannot see.', WARN),
        verdictRow('Archive revisions', 'IMPROVE', 'The UI pattern is right. Live RCE/CE revision history is not behind it yet. Without it you cannot audit why a number changed.', WARN),
        verdictRow('RCE approval engine', 'LACKING', 'Submit dumps to Pending. No nominated final approver, no reject path. Estimators work requests that were never accepted — wasted time and wrong scope.', GAP),
        verdictRow('CE submit + checker', 'LACKING', 'No real Submit that routes the Admin CE flow. No blocking pre-flight. Status is a combo box. This is how inaccurate totals leave the building.', GAP),
        verdictRow('Wait-for-info loop', 'LACKING', 'Today the estimator parks or types remarks. Sales never gets a structured “upload this, then return.” That is days of delay.', GAP),
        verdictRow('Sourcing flag per line', 'LACKING', 'Items not in the database are typed ad-hoc. No list of “needs quote” that can be tracked or compared next time.', GAP),
        verdictRow('No-quote path', 'LACKING', 'Exists as a mock status. There is no Submit as no-quote + reason. People build a fake CE instead.', GAP),
        verdictRow('One RCE = one live CE', 'LACKING as a rule', 'The wizard can create a second CE for the same RCE. Two numbers, one client.', GAP),
        verdictRow('Notifications', 'LACKING', 'Nothing tells Sales the estimator is blocked, or the estimator that Rev 2 arrived. Slowness is often waiting, not calculating.', GAP),
        verdictRow('Rate vs awarded outcome', 'LACKING', 'Awarded / Lost is mixed into work status. You cannot learn which estimates were accurate versus which were cheap.', GAP),
        verdictRow('Seed from OIF', 'LACKING', 'Inspection captures quantity, size, weight, duration, manpower — then none of it becomes a breakdown row.', GAP),
        verdictRow('Productivity norms', 'LACKING', 'Days are typed. There is no “this activity is X m² / day for this crew.” Accuracy of duration is still tribal knowledge.', GAP),
      ]),

      h1('7. Improvement review — one area at a time'),
      p('Below is the same inventory in working language: what to do, and whether it attacks speed, accuracy, or both. Still not a build list to execute in one pass — it is the order of leverage.'),

      h2('7.1 Request quality (RCE form)'),
      p('A thin RCE guarantees a slow CE. The form looks complete; Submit does not care. Improve the form so work type, deadlines, drawing availability, and “what is missing” are unavoidable. Keep the two-company logo, client lookup, auto number, resizable checklist columns, and free-text remarks. Add a completeness score and a “cannot submit” state when onsite is ticked with no duration or when no activity type is ticked.'),

      h2('7.2 Handoff (RCE / OIF → CE)'),
      p('This is the largest speed leak in the current studio. The estimator opens a polished form and a blank breakdown. Improve: when Generate CE runs, stamp work-type groups from the RCE ticks, drop RCE remarks into SOW, drop attachments into ATTCH, and if an OIF is referenced, offer “create tasks from inspection manpower and duration.” Accuracy follows because the estimator is editing the request, not re-interpreting it.'),

      h2('7.3 Starting a CE (wizard + templates)'),
      p('Template cards that only change a label do not save time. Maintain the single hybrid file. Improve Per Task Template until it is the normal way to start a subtask, and add a small set of department-owned packs (seal replacement, retube, sandblast and coat, shop fab + deliver). Clone previous CE should preview what will be copied and strip client-specific notes by default so old assumptions do not contaminate a new price.'),

      h2('7.4 Database (the rate book)'),
      p('Maintain editable headers, resize, import alignment, extra sheets, client addresses. Improve every master row with: unit, default days or default kW, last reviewed date, and a simple active/inactive flag. Inactive items must not appear in Select items. Accuracy dies when five estimators keep private rate lists in their heads because the official sheet is not trusted.'),

      h2('7.5 Breakdown entry speed'),
      p('Maintain groups, drag-and-drop, +t, Copy, Select items, notes, confirm-delete. Improve Select items so chosen rows inherit the subtask’s duration as Days and a default qty of 1 (or peak from schedule). Improve Copy so you can copy one category only (BOL only) instead of the whole pack when you only need labor. That is hours per week.'),

      h2('7.6 Calculation rules'),
      p('Maintain day-type multipliers, night differential, OT, schedule-aware peaks, electricity only on shop/trading, work-type cost matrix. Improve visibility of the rule on the row (“this total includes electricity”) so reviewers do not add power twice. Do not let summary manual rows silently replace a breakdown total.'),

      h2('7.7 Checker before the number leaves'),
      p('Lacking as a gate. The zero-value watch is a hint, not a control. The pre-submit checker you already agreed is the accuracy control: linked RCE, no zero rates on used lines, shop tools have kW when electricity applies, at least one priced line, no-quote requires a reason. Warnings can pass with acknowledgement; failures cannot.'),

      h2('7.8 Waiting and sourcing (the hidden delay)'),
      p('Most “slow estimates” are not slow typing. They are blocked on a drawing or a vendor price. The system has Park, which hides the block. Add the two statuses as actions with a required note and, for information, a ping back to the requestor. Sourcing lines should be listable so next month’s database can absorb the quote.'),

      h2('7.9 Monitoring that manages work'),
      p('Replace Active mock data with live jobs. Aging against the RCE deadline is how you see slowness. NEW on accepted RCEs is how work enters the queue instead of dying in an inbox. Keep the three rails separate: RCE Request (document), Active (job), Archive (history). Executive then becomes real win-rate and cycle-time, which is how you prove the system worked.'),

      h2('7.10 History and learning'),
      p('Without revision history you cannot tell whether inaccuracy was a bad rate, a scope change, or a last-minute discount. Keep Archive’s “view files / revisions” idea and put a real timeline on both RCE and CE: who, when, remarks, file replaced. Later, Awarded vs Lost belongs on the Done job — not as a work status — so you can compare estimated vs actual only where you have an outcome.'),

      h2('7.11 Inspection and EL Calculator'),
      p('Keep both. They already capture the raw facts (size, weight, duration, weld length). The lack is the last inch: “use this measurement as qty.” Until that exists, they improve accuracy only if the estimator is disciplined. After it exists, they improve speed as well.'),

      h1('8. What to protect while you improve'),
      bullet('One CE file, three work types inside it — do not go back to separate Onsite / Shop / Trading systems.'),
      bullet('Breakdown owns quantities; summaries display them.'),
      bullet('Electricity is a shop/trading rule, never an onsite default.'),
      bullet('Schedule logic stays orthogonal to work type.'),
      bullet('Auto-save and Park stay.'),
      bullet('Database remains the only official rate source.'),
      bullet('Do not implement login until the studio + workflow feel finished; adding auth on a moving target will freeze the wrong design.'),

      h1('9. Suggested build order (when you say go)'),
      p('This is leverage order against slow + inaccurate, not a commitment to build now.'),
      table([1400, 2800, 5880], [
        row([cell('#', 1400, { header: true }), cell('Slice', 2800, { header: true }), cell('Effect', 5880, { header: true })]),
        row([cell('1', 1400), cell('Database hygiene + Select items defaults', 2800), cell('Faster line entry, fewer invented rates.', 5880)]),
        row([cell('2', 1400), cell('Per Task Template as the normal start', 2800), cell('Biggest speed win using a feature you already have.', 5880)]),
        row([cell('3', 1400), cell('RCE/OIF stamp into CE on generate', 2800), cell('Stops blank-page estimating.', 5880)]),
        row([cell('4', 1400), cell('CE pre-submit checker', 2800), cell('Stops zero-rate and missing-power totals leaving.', 5880)]),
        row([cell('5', 1400), cell('RCE final-approver + job on Active + NEW', 2800), cell('Estimators only work accepted scope.', 5880)]),
        row([cell('6', 1400), cell('Wait-for-info + sourcing actions', 2800), cell('Converts hidden delay into a visible loop.', 5880)]),
        row([cell('7', 1400), cell('CE approval + revision history + Archive for real', 2800), cell('Accuracy you can audit; cycle time you can report.', 5880)]),
        row([cell('8', 1400), cell('Assist vs Transfer', 2800), cell('Continuity without losing the owner of the number.', 5880)]),
      ]),

      h1('10. Impact if this is used as designed'),
      h3('On speed'),
      p('Time moves off retyping and hunting last year’s workbook, onto confirming scope and exceptions. Multi-select, task packs, stamped RCE data, and auto-numbered documents cut the first two hours of a typical estimate. Wait-for-info stops a job sitting in Park while Sales does not know they are blocking it. Cycle time becomes visible on Active aging.'),
      h3('On accuracy'),
      p('Rates come from one book. Electricity cannot land on client-powered onsite tools. Peaks come from the schedule. Checker blocks empty money fields. Revisions replace the RCE pack on the same CE instead of forking a second number. Archive tells you why the figure changed. Awarded/Lost later tells you whether the figure was right.'),
      h3('On the department'),
      p('Sales owns the quality of the request. Estimating owns the quality of the build-up. Leads own the queue. Heads own the signature. The system holds the rules so those roles do not depend on who is in the room. That is the actual product: not a prettier Excel, a shared method that is faster because it is constrained.'),

      h1('11. Quick how-to map'),
      table([3200, 6880], [
        row([cell('I need to…', 3200, { header: true }), cell('Where', 6880, { header: true })]),
        row([cell('Ask for an estimate', 3200), cell('Dashboard → + RCE → fill & Submit → RCE Request', 6880)]),
        row([cell('See incoming requests', 3200), cell('Monitoring → RCE Request → View', 6880)]),
        row([cell('Start the estimate', 3200), cell('RCE Detail → Generate Cost Estimate, or Dashboard → Cost Estimate', 6880)]),
        row([cell('Build the price', 3200), cell('CE Editor → Breakdown (then check BOL / BOTE / BOCM / PPE / MOB / MISC)', 6880)]),
        row([cell('Reuse a known task', 3200), cell('Scope Library → Per Task Template, then Breakdown → Copy', 6880)]),
        row([cell('Add many catalog items', 3200), cell('Subtask category → Select items', 6880)]),
        row([cell('Pause and work another job', 3200), cell('Park Editor (auto-saves)', 6880)]),
        row([cell('Correct a rate for everyone', 3200), cell('Database → that sheet → edit row or CSV import', 6880)]),
        row([cell('File a site visit', 3200), cell('Dashboard → Create Inspection Report → Monitoring → Inspection', 6880)]),
        row([cell('Size weld / paint / steel', 3200), cell('EL Calculator, then enter qty on the CE line', 6880)]),
        row([cell('See finished work / old files', 3200), cell('Monitoring → Archive', 6880)]),
        row([cell('Change letterhead or approval ladder names', 3200), cell('Admin → document control / approval flows (config only today)', 6880)]),
      ]),

      h1('12. Glossary'),
      table([2400, 7680], [
        row([cell('Term', 2400, { header: true }), cell('Meaning in this system', 7680, { header: true })]),
        row([cell('RCE', 2400, { bold: true }), cell('Request for Cost Estimate — the sales/request document.', 7680)]),
        row([cell('CE', 2400, { bold: true }), cell('Cost Estimate — the priced build-up.', 7680)]),
        row([cell('OIF', 2400, { bold: true }), cell('Onsite Inspection Form.', 7680)]),
        row([cell('BOL', 2400, { bold: true }), cell('Bill of Labor.', 7680)]),
        row([cell('BOTE', 2400, { bold: true }), cell('Bill of Tools & Equipment. Electricity applies on Shop and Trading only.', 7680)]),
        row([cell('BOCM', 2400, { bold: true }), cell('Bill of Consumables / Materials.', 7680)]),
        row([cell('PPE', 2400, { bold: true }), cell('Personal protective equipment.', 7680)]),
        row([cell('MISC', 2400, { bold: true }), cell('Indirects: accommodation, transport, admin, third party, etc.', 7680)]),
        row([cell('ATTCH', 2400, { bold: true }), cell('Attachments compiled from the CE and task notes.', 7680)]),
        row([cell('Work type', 2400, { bold: true }), cell('Onsite, Shop, or Trading — a grouping inside one CE, not a separate template file.', 7680)]),
        row([cell('Job', 2400, { bold: true }), cell('The Active-monitoring row that links one accepted RCE to one live CE.', 7680)]),
        row([cell('Per Task Template', 2400, { bold: true }), cell('Reusable named pack of resources for one task.', 7680)]),
      ]),

      spacer(200),
      p('End of working manual. Feature recommendations in sections 6–9 are direction only and are not implemented by the publication of this document.', { italics: true, color: MUTED, size: 20 }),
    ],
  }],
});

const buf = await Packer.toBuffer(doc);
fs.writeFileSync('/home/workdir/artifacts/Estimator_System_User_Manual.docx', buf);
console.log('wrote', buf.length);
