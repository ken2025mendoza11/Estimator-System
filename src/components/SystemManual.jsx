// @ts-nocheck
'use client';
import React, { useMemo, useState } from "react";

const GROUPS = [
	{ id: "orient", label: "Start here" },
	{ id: "people", label: "People" },
	{ id: "forms", label: "Forms" },
	{ id: "watch", label: "Monitoring" },
	{ id: "settings", label: "Settings" },
	{ id: "trouble", label: "What if" }
];

function levelLabel(levels, id) {
	return levels.find((l) => l.id === id)?.label || id || "—";
}

function fillTokens(template, vars) {
	return String(template ?? "").replace(/\{(\w+)\}/g, (_, key) => {
		const value = vars[key];
		return value == null || value === "" ? `{${key}}` : String(value);
	});
}

function departmentsOf(users, pending) {
	const map = new Map();
	[...(users || []), ...(pending || []).map((p) => ({ ...p, status: "pending" }))].forEach((person) => {
		const name = String(person.department || "Unassigned").trim() || "Unassigned";
		if (!map.has(name)) map.set(name, []);
		map.get(name).push(person);
	});
	return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function deptStory(name) {
	const key = name.toLowerCase();
	if (key.includes("cost")) return {
		does: "Prices the job. This is the cost estimate: labor, tools, materials, PPE, and the extra lines that do not fit the other sheets.",
		opens: "Dashboard → Cost Estimate, then Breakdown."
	};
	if (key.includes("sale")) return {
		does: "Asks costing for a number. The form is the RCE. Sales does not build the labor sheets.",
		opens: "Monitoring → RCE Request → new request."
	};
	return {
		does: "Uses the forms their level allows. The access table on People decides which screens they see.",
		opens: "The sidebar items that stay lit for their level."
	};
}

function optionLabel(options, id) {
	return options.find((o) => o.id === id)?.label || id;
}

function Steps({ steps, levels }) {
	if (!steps?.length) return <p className="man-empty">No steps yet. An administrator adds them under Admin → Approval flow. This page will list them as soon as they exist.</p>;
	return (
		<ol className="man-steps">
			{steps.map((step, index) => (
				<li key={step.id || index}>
					<span>{index + 1}</span>
					<div>
						<strong>{step.title || "Untitled step"}</strong>
						<em>{levelLabel(levels, step.role)}{step.isFinal ? " · last signature" : ""}</em>
					</div>
				</li>
			))}
		</ol>
	);
}

function Callout({ title, children }) {
	return (
		<aside className="man-call">
			<b>{title}</b>
			<p>{children}</p>
		</aside>
	);
}

const STATUS_GUIDE = {
	Draft: {
		means: "The file exists, but nobody is pricing it yet.",
		does: "It stays on the active board. Nothing is sent for a signature.",
		how: "An early file. Most new estimates move straight to Ongoing once someone starts."
	},
	Pending: {
		means: "It is on the board and waiting for a person to take it.",
		does: "Monitoring can filter to Pending. The job is not closed.",
		how: "Used before work starts, and for a request that has not been accepted."
	},
	Ongoing: {
		means: "Someone is building the price.",
		does: "The sheets, summary, and scope of work can be edited. Aging keeps counting. This is the normal working state.",
		how: "Where a live estimate sits. Resume after Park comes back here. If an approver rejects the file, it also comes back here so you can fix it."
	},
	"On Park": {
		means: "You stepped away on purpose.",
		does: "Park Editor pauses your session and saves. The job stays on the active board, so people can still see it.",
		how: "Press Park Editor, or pick On Park in the status menu. Resume puts it back to Ongoing."
	},
	"Waiting for information": {
		means: "You cannot price it until the requestor sends something.",
		does: "The request opens again for files and notes only. The estimate stays on the active board. A note goes to the requestor.",
		how: "Press Request information and tick what is missing (drawing, specification, photos, dimensions, schedule) or write a note. You can also pick this status in the menu — a remark is required."
	},
	Sourcing: {
		means: "The price is waiting on a supplier, not on the estimate itself.",
		does: "The job stays on the active board. People see why it is not moving.",
		how: "Pick Sourcing in the status menu. A remark to the requestor is required."
	},
	"For approval": {
		means: "You are finished editing. It is in the signature route.",
		does: "The person on the current step can approve or reject. Approve on the last step makes it Done. Reject sends it back to Ongoing.",
		how: "Only Submit CE does this. The menu will not let you type this status by hand. Submit CE runs the checker first, then Submit for approval."
	},
	"For revision": {
		means: "A finished estimate has to be changed.",
		does: "The revision number and revision date move forward, and the instruction is stored. The file is worked again. Monitoring still treats it as in progress.",
		how: "On a Done estimate, press Revise and write the instruction. You do not pick this from the status menu."
	},
	"No quote": {
		means: "We will not give a price.",
		does: "The job leaves the active board. It is no longer the live estimate for that request.",
		how: "Pick No quote in the status menu. A reason is required."
	},
	Done: {
		means: "The last approver signed it.",
		does: "It leaves the active board. You can mark Awarded or Lost and write a JO number. A snapshot of the tasks and summary is kept.",
		how: "The final Approve step sets this. It cannot be chosen from the status menu."
	},
	Cancelled: {
		means: "The job was stopped.",
		does: "It leaves the active board and is no longer the live estimate for that request.",
		how: "A closed outcome. It is not one of the everyday menu choices on the estimate header."
	},
	"Close bid": {
		means: "The bid itself is closed.",
		does: "It leaves the active board, with Done, Cancelled, and No quote.",
		how: "Pick Close bid in the status menu when the bid is over and you are not pricing it further."
	}
};

function statusBoard(name) {
	const key = String(name || "").trim().toLowerCase();
	if (key === "done" || key === "cancelled" || key === "canceled" || key === "close bid" || key === "no quote") return "Leaves the active board";
	return "Stays on the active board";
}

function Flow({ nodes }) {
	return (
		<div className="man-flow" aria-label="Flow">
			{nodes.map((node, index) => (
				<React.Fragment key={node.label}>
					{index > 0 ? <span className="man-arrow" aria-hidden="true">→</span> : null}
					<div className={"man-node" + (node.hot ? " is-hot" : "") + (node.off ? " is-off" : "")}>
						<b>{node.label}</b>
						{node.note ? <small>{node.note}</small> : null}
					</div>
				</React.Fragment>
			))}
		</div>
	);
}

function SheetMap({ dc, sample, notes, signers }) {
	const headerLeft = fillTokens(dc.headerLeft, sample);
	const headerRight = fillTokens(dc.headerRight, sample);
	const footer = [dc.footerLeft, dc.footerCenter, dc.footerRight].map((part) => fillTokens(part, sample)).filter((part) => part && part !== "—").join("   ·   ");
	return (
		<div className="man-sheetmap">
			<div className="man-sheet" aria-hidden="true">
				<div className="man-tag" data-n="1">{headerLeft || "Header left"}<i>{headerRight || "Header right"}</i></div>
				<div className="man-sheet-id">
					<div data-n="2"><b>Project type</b><span>Electrical or Mechanical</span></div>
					<div><b>Date</b><span>the file date</span></div>
					<div><b>Project description</b><span>what the job is</span></div>
					<div data-n="3"><b>CE number</b><span>{sample.docNo}</span></div>
					<div><b>Client · location · attention · end user</b></div>
					<div><b>Revision no. {sample.rev}</b><span>and revision date</span></div>
					<div><b>Material · quantity · no. of days</b></div>
				</div>
				<div className="man-sheet-lines" data-n="4">
					<span>Item</span><span>Description</span><span>Total cost</span>
					<span>A</span><span>Onsite works</span><span>from the breakdown</span>
					<span>B</span><span>Shop works</span><span>from the breakdown</span>
					<span>C</span><span>Trading</span><span>from the breakdown</span>
				</div>
				<div className="man-sheet-note" data-n="5">{(notes[0] && notes[0].text) || "Summary notes print under the lines."}</div>
				<div className="man-sheet-sign" data-n="6">
					{(signers.length ? signers : [{ title: "Prepared" }, { title: "Reviewed" }, { title: "Approved" }]).map((step) => (
						<span key={step.id || step.title}>{step.title}</span>
					))}
				</div>
				<div className="man-tag is-foot" data-n="7">{footer || "Footer"}</div>
			</div>
			<ol className="man-leaders">
				<li><b>Header.</b> {dc.companyName || "The company"} on the left, revision and number on the right. Both lines are the document-control text, filled for this sample.</li>
				<li><b>Identity block.</b> Type, description, client, location, attention, end user, material, quantity, and days. This is the job, not the price.</li>
				<li><b>CE number and revision.</b> The number identifies the file. Revise on a finished estimate moves the revision number and date forward.</li>
				<li><b>The money lines.</b> Each work type’s total is pulled from the breakdown. You do not retype those totals here. Tick a line to include it on the client page.</li>
				<li><b>Notes.</b> {(notes.length ? notes.map((note) => note.text).join(" ") : "None saved yet.")} A note prints only for the templates named on it.</li>
				<li><b>Signatures.</b> One box per step in the cost-estimate route: {(signers.map((step) => step.title).join(" → ")) || "no route yet"}.</li>
				<li><b>Footer.</b> Document number and page, from the same document-control settings. Change the setting and this picture changes.</li>
			</ol>
		</div>
	);
}

function BreakdownMap({ workTypes }) {
	const names = (workTypes || []).map((type) => type.label === "ONSITE" ? "Onsite" : type.label === "SHOP" ? "Shop" : "Trading");
	return (
		<div className="man-sheetmap">
			<div className="man-bd" aria-hidden="true">
				<div className="man-bd-main">
					<div className="man-bd-bar" data-n="1"><b>C. TRADING</b><i>₱ total</i><span>Add task</span></div>
					<div className="man-bd-path" data-n="2">Task / Scope <i>Close others</i></div>
					<div className="man-bd-card">
						<b>Scope</b>
						<div className="man-bd-chips" data-n="3"><span>BOL</span><span>BOTE</span><span>BOCM</span><span>PPE</span><span>MISC</span></div>
						<div className="man-bd-table">Role · days · rate · overtime → line amount</div>
					</div>
				</div>
				<div className="man-bd-rail" data-n="4">
					<div>{names.join("  ")}</div>
					<small>Find scope</small>
					<b>Task</b>
					<span>Scope <i>pin</i></span>
					<span className="is-dim">Sub-scope</span>
				</div>
			</div>
			<ol className="man-leaders">
				<li><b>Orange bar.</b> The work type you are in, and its total. Add task starts another main task in this type.</li>
				<li><b>The path.</b> Task, then scope, then sub-scope if you opened one. Close others drops every pinned scope except this one.</li>
				<li><b>The five sheets.</b> Open a chip to edit it. BOL is people, BOTE is tools, BOCM is materials, PPE is safety gear, MISC is the rest (parts A–E). Shop and trading tools can also carry electricity.</li>
				<li><b>The list on the right.</b> {names.join(", ")} switch the work type. Click a scope to open only that scope. The pin keeps another scope on the page, folded, until you expand it.</li>
			</ol>
		</div>
	);
}

function FormatSheet({ code, name, columns, sample, math }) {
	return (
		<figure className="man-format">
			<figcaption><b>{code}</b><span>{name}</span></figcaption>
			<div className="man-grid" role="img" aria-label={`${code} columns`}>
				<div className="man-grid-row is-head" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(4.4rem, 1fr))` }}>
					{columns.map((col) => <span key={col}>{col}</span>)}
				</div>
				<div className="man-grid-row" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(4.4rem, 1fr))` }}>
					{sample.map((cell, index) => <span key={`${code}-${index}`}>{cell}</span>)}
				</div>
			</div>
			<p className="man-math">{math}</p>
		</figure>
	);
}

function TemplateBoard({ notes }) {
	const saved = notes || [];
	const base = [
		{ id: "onsite", label: "Onsite" },
		{ id: "shop", label: "Shop" },
		{ id: "trading", label: "Trading" }
	];
	const extra = [...new Set(saved.flatMap((note) => note.templates || []))].filter((id) => !base.some((item) => item.id === id));
	const columns = [...base, ...extra.map((id) => ({ id, label: id }))];
	return (
		<div className="man-tpls">
			{columns.map((column) => {
				const lines = saved.filter((note) => (note.templates || []).includes(column.id));
				return (
					<section key={column.id} className="man-tpl">
						<header>{column.label}</header>
						{lines.length ? lines.map((note) => <p key={note.id}>{note.text}</p>) : <p className="man-empty">No note is attached to this template.</p>}
					</section>
				);
			})}
		</div>
	);
}

function FormulaBoard({ formula }) {
	const hours = formula.hoursPerDay ?? "—";
	const cells = [
		["Hourly", `Daily rate ÷ ${hours}`],
		["Overtime hour", `Hourly × ${formula.otMultiplier ?? "—"}`],
		["Night", `${formula.nightDiffPct ?? "—"}% on the day rate`],
		["Sunday / special", `Daily × ${formula.sundayMultiplier ?? "—"}`],
		["Holiday", `Daily × ${formula.holidayMultiplier ?? "—"}`],
		["Monthly", `Daily × ${formula.daysPerMonth ?? "—"} days`],
		["13th month", `Monthly ÷ ${formula.thirteenthDivisor ?? "—"}`],
		["SSS · Pag-IBIG · PhilHealth", `${formula.sssPct ?? "—"}% · ${formula.hdmfPct ?? "—"}% · ${formula.phicPct ?? "—"}%`]
	];
	return (
		<div className="man-eq">
			{cells.map(([name, rule]) => (
				<div key={name}>
					<b>{name}</b>
					<span>{rule}</span>
				</div>
			))}
		</div>
	);
}

function FormSketch({ kicker, rows }) {
	return (
		<div className="man-form" aria-hidden="true">
			<div className="man-form-title">{kicker}</div>
			{rows.map((row) => (
				<div key={row.join("|")} className="man-form-row">
					{row.map((cell) => <span key={cell}>{cell}</span>)}
				</div>
			))}
		</div>
	);
}

export function SystemManual({ config, levels, access, docTypes, sheets, sortOptions, namingOptions, workTypes, editorTabs, jobStatuses, taskTemplates = [] }) {
	const articles = useMemo(() => buildArticles({
		config, levels, access, docTypes, sheets, sortOptions, namingOptions, workTypes, editorTabs, jobStatuses, taskTemplates
	}), [config, levels, access, docTypes, sheets, sortOptions, namingOptions, workTypes, editorTabs, jobStatuses, taskTemplates]);
	const [query, setQuery] = useState("");
	const [activeId, setActiveId] = useState(articles[0]?.id || "");
	const q = query.trim().toLowerCase();
	const shown = q ? articles.filter((a) => a.search.includes(q)) : articles;
	const active = shown.find((a) => a.id === activeId) || shown[0] || null;
	const people = (config?.users || []).length;
	const deptCount = departmentsOf(config?.users, config?.pending).length;
	const steps = Object.values(config?.approvalFlows || {}).reduce((n, list) => n + (list?.length || 0), 0);

	return (
		<div className="man-page">
			<header className="man-hero">
				<div>
					<p className="man-kicker">Field guide</p>
					<h1 className="ce-serif">How this system works</h1>
					<p>Drawn from the settings that are saved right now. Change a route, a template note, a header, or a formula and the picture on this page changes with it.</p>
				</div>
				<div className="man-stats">
					<div><b>{people}</b><span>People</span></div>
					<div><b>{deptCount}</b><span>Departments</span></div>
					<div><b>{steps}</b><span>Approval steps</span></div>
				</div>
			</header>
			<label className="man-find">
				<span>Find a topic</span>
				<input className="ce-input" value={query} placeholder="Try template, BOL, park, shop note…" onChange={(e) => setQuery(e.target.value)} />
			</label>
			<div className="man-split">
				<nav className="man-toc" aria-label="Manual topics">
					{GROUPS.map((group) => {
						const items = shown.filter((a) => a.group === group.id);
						if (!items.length) return null;
						return (
							<div key={group.id}>
								<p>{group.label}</p>
								{items.map((item) => (
									<button key={item.id} type="button" className={active?.id === item.id ? "is-on" : ""} onClick={() => setActiveId(item.id)}>
										{item.title}
									</button>
								))}
							</div>
						);
					})}
					{!shown.length && <p className="man-empty">Nothing matches. Try a shorter word.</p>}
				</nav>
				<article className="man-read">
					{active ? (
						<>
							<p className="man-kicker">{GROUPS.find((g) => g.id === active.group)?.label}</p>
							<h2 className="ce-serif">{active.title}</h2>
							{active.body}
						</>
					) : <p className="man-empty">Pick a topic.</p>}
				</article>
			</div>
		</div>
	);
}

function buildArticles(ctx) {
	const { config, levels, access, docTypes, sheets, sortOptions, namingOptions, workTypes, editorTabs, jobStatuses, taskTemplates = [] } = ctx;
	const flows = config?.approvalFlows || {};
	const dc = config?.documentControl || {};
	const rules = config?.masterlistRules || {};
	const formula = config?.templateFormula || {};
	const users = config?.users || [];
	const pending = config?.pending || [];
	const departments = departmentsOf(users, pending);
	const sample = { company: dc.companyName || "Company", rev: dc.revision || "0", date: "today", docNo: "CE-——", page: "1" };

	const list = [];
	const add = (article) => {
		const search = `${article.title} ${article.group} ${article.text}`.toLowerCase();
		list.push({ ...article, search });
	};

	add({
		id: "read-me",
		group: "orient",
		title: "This page follows the system",
		text: "admin approval header formula database live settings",
		body: (
			<>
				<p>Read this when you are new, or when a screen does not match what you remember. It is not a copy of a Word file. It looks at the same lists the system uses.</p>
				<ul className="man-points">
					<li><b>People, job titles, and departments</b> come from Admin → User access.</li>
					<li><b>Who signs</b> comes from Admin → Approval flow. Add a step there and it shows up here.</li>
					<li><b>The printed name, logo, header, footer, and summary notes</b> come from Admin → Document control.</li>
					<li><b>Labor math</b> comes from the formula settings. Open “How labor math is set” to see the numbers in use.</li>
					<li><b>Database sheets, sort, and name style</b> come from the database rules.</li>
				</ul>
				<Callout title="What does not rewrite itself">A brand-new button added in a future build is described only after that screen is part of this guide. Routes, names, access, formulas, and print text already move on their own.</Callout>
			</>
		)
	});

	add({
		id: "how-to",
		group: "orient",
		title: "How to price a job",
		text: "how to use cost estimate steps accept breakdown summary submit approve awarded",
		body: (
			<>
				<p>Follow the arrows. Each box is a real screen, not a suggestion.</p>
				<Flow nodes={[
					{ label: "RCE", note: "Sales writes the ask" },
					{ label: "Accept", note: "Costing takes it" },
					{ label: "Breakdown", note: "Build the price" },
					{ label: "Summary", note: "Choose what prints" },
					{ label: "Submit CE", note: "Checker, then route" },
					{ label: "Done", note: "Last signature", hot: true }
				]} />
				<ol className="man-howto">
					<li><b>Sales writes the RCE.</b> Client, what they want, and the files. It sits in Monitoring → RCE Request until someone accepts it.</li>
					<li><b>Costing accepts.</b> That request can now have a cost estimate. Open it from the dashboard.</li>
					<li><b>Fill the top of the summary first.</b> Project type, description, client, CE number, revision. The picture under “What prints on the page” names every box.</li>
					<li><b>Build the price on Breakdown.</b> Pick Onsite, Shop, or Trading. Add a task, add a scope, then fill BOL, BOTE, BOCM, PPE, and MISC. The orange bar is that type’s total.</li>
					<li><b>Go back to Summary.</b> The work-type totals are already there. Tick a line if it should show on the client page. Notes for the matching template print underneath.</li>
					<li><b>Submit CE.</b> The checker lists what is missing. You can go back, or acknowledge warnings and submit. Status becomes For approval. You cannot type that status yourself.</li>
					<li><b>The route signs it.</b> The current step is under Who signs. Approve moves to the next person. The last approve makes it Done. Reject sends it back to Ongoing.</li>
					<li><b>After Done.</b> Mark Awarded or Lost, and write the JO number if you have one. If the price must change, press Revise — the revision number moves forward and the status becomes For revision.</li>
				</ol>
			</>
		)
	});

	add({
		id: "departments",
		group: "orient",
		title: "Departments",
		text: `departments ${departments.map(([name, people]) => `${name} ${people.map((p) => p.name).join(" ")}`).join(" ")} costing sales workflow`,
		body: (
			<>
				<p>A department is the group printed on a person and on a job. It is not a separate app. Today the roster has {departments.length === 1 ? "one department" : `${departments.length} departments`}.</p>
				<div className="man-cards">
					{departments.map(([name, people]) => {
						const story = deptStory(name);
						const active = people.filter((p) => p.status !== "pending");
						const waiting = people.filter((p) => p.status === "pending");
						return (
							<section key={name} className="man-card">
								<h3 className="ce-serif">{name}</h3>
								<p>{story.does}</p>
								<p className="man-where">Open it from {story.opens}</p>
								<div className="man-people">
									{active.map((p) => <span key={p.id || p.email}>{p.name}<small>{p.designation || levelLabel(levels, p.level)}</small></span>)}
									{waiting.map((p) => <span key={p.id || p.email} className="is-wait">{p.name}<small>waiting to be accepted</small></span>)}
								</div>
							</section>
						);
					})}
				</div>
				{nameIncludes(departments, "cost") && (
					<>
						<h3 className="ce-serif">Costing, from request to signed estimate</h3>
						<Steps steps={flows.ce} levels={levels} />
					</>
				)}
				{nameIncludes(departments, "sale") && (
					<>
						<h3 className="ce-serif">Sales, from client to request</h3>
						<Steps steps={flows.rce} levels={levels} />
					</>
				)}
			</>
		)
	});

	add({
		id: "levels",
		group: "people",
		title: "Levels and what they can open",
		text: `levels ${levels.map((l) => `${l.label} ${l.blurb}`).join(" ")} ${access.map((row) => row.area).join(" ")}`,
		body: (
			<>
				<p>A level is not a department. Two people in Costing can be Staff and Lead. The level decides the screens.</p>
				<div className="man-cards">
					{levels.map((level) => (
						<section key={level.id} className="man-card">
							<h3 className="ce-serif">{level.label}</h3>
							<p>{level.blurb}</p>
							<ul className="man-points">
								{access.filter((row) => row[level.id]).map((row) => <li key={row.area}>{row.area}</li>)}
							</ul>
						</section>
					))}
				</div>
			</>
		)
	});

	add({
		id: "roster",
		group: "people",
		title: "Who is on the system",
		text: `users designations ${users.map((u) => `${u.name} ${u.designation} ${u.department} ${u.level}`).join(" ")} ${(config?.designations || []).join(" ")} pending ${pending.map((p) => p.name).join(" ")}`,
		body: (
			<>
				<p>Job titles you can assign right now: {(config?.designations || []).join(", ") || "none yet"}.</p>
				<div className="man-table-wrap">
					<table className="man-table">
						<thead><tr><th>Name</th><th>Title</th><th>Department</th><th>Level</th><th>Status</th></tr></thead>
						<tbody>
							{users.map((u) => (
								<tr key={u.id || u.email}>
									<td>{u.name}</td>
									<td>{u.designation || "—"}</td>
									<td>{u.department || "—"}</td>
									<td>{levelLabel(levels, u.level)}</td>
									<td>{u.status || "active"}</td>
								</tr>
							))}
							{pending.map((p) => (
								<tr key={p.id || p.email}>
									<td>{p.name}</td>
									<td>{p.designation || "—"}</td>
									<td>{p.department || "—"}</td>
									<td>{levelLabel(levels, p.level)}</td>
									<td>Waiting. An administrator accepts them and sets the level.</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
				<p>Use <b>Acting as</b> on the sidebar to see the system the way that person sees it. It does not log you out.</p>
			</>
		)
	});

	add({
		id: "routes",
		group: "forms",
		title: "Who signs each form",
		text: `approval ${docTypes.map((d) => d.label).join(" ")} ${Object.values(flows).flat().map((s) => s.title).join(" ")}`,
		body: (
			<>
				<p>Each form has its own route. The last step marked as final is the one that closes the route. Edit the names in Admin and the lines below are the new route.</p>
				{docTypes.map((doc) => (
					<section key={doc.id} className="man-block">
						<h3 className="ce-serif">{doc.label}</h3>
						<Steps steps={flows[doc.id]} levels={levels} />
					</section>
				))}
			</>
		)
	});

	add({
		id: "ce",
		group: "forms",
		title: "Cost estimate",
		text: `cost estimate tabs ${editorTabs.join(" ")} summary sow mobilization attachments`,
		body: (
			<>
				<p>One cost estimate is one job’s price. The tabs across the top, in this order, are the parts of that file.</p>
				<Flow nodes={editorTabs.map((tab) => ({ label: tab, note: tab === "SUMMARY" ? "what prints" : tab === "BREAKDOWN" ? "where the price is built" : "" }))} />
				<ul className="man-points">
					<li><b>Summary</b> — the client page. Identity on top, money lines from the breakdown, notes, then the signature boxes. The annotated page is under “What prints on the page”.</li>
					<li><b>Breakdown</b> — tasks and scopes. Open that topic for the picture of the screen.</li>
					<li><b>SOW</b> — the scope of work in words.</li>
					<li><b>Mob/Demob</b> — the cost to move people and tools to the job and back.</li>
					<li><b>BOL, BOCM, BOTE, PPE, MISC</b> — the same five sheets, rolled up for the whole estimate.</li>
					<li><b>ATTCH</b> — files that belong to the job.</li>
					<li><b>RCE</b> — the request this estimate answers, when there is one.</li>
				</ul>
				<p>Buttons on the estimate, and what they change:</p>
				<ul className="man-points">
					<li><b>Status menu</b> — you may only set On Park, Waiting for information, Sourcing, No quote, or Close bid. Anything else follows a button: Submit, Approve, Reject, or Revise.</li>
					<li><b>Park Editor</b> — status becomes On Park. Resume returns it to Ongoing.</li>
					<li><b>Request information</b> — status becomes Waiting for information, and the requestor can add files and notes.</li>
					<li><b>Submit CE</b> — checker, then For approval.</li>
				</ul>
			</>
		)
	});

	add({
		id: "breakdown",
		group: "forms",
		title: "Breakdown sheet",
		text: `breakdown onsite shop trading bol bote bocm ppe misc pin scope task subtask amber sync special rate`,
		body: (
			<>
				<p>The screen has two sides. The sheets you are editing are on the left. Every scope in this work type is on the right. Click a scope and only that scope’s sheets open.</p>
				<BreakdownMap workTypes={workTypes} />
				<p>Work types, in the order the file uses them:</p>
				<ol className="man-steps">
					{(workTypes || []).map((type) => (
						<li key={type.id}>
							<span>{type.letter}</span>
							<div>
								<strong>{type.full}</strong>
								<em>{type.id === "onsite" ? "Site labor and tools. No electricity line." : "Tools can carry kW, hours per day, and an electricity cost."}</em>
							</div>
						</li>
					))}
				</ol>
				<ul className="man-points">
					<li><b>BOL</b> is labor: role, day type, shift, quantity, days, daily rate, overtime hours, per diem, allowance.</li>
					<li><b>BOTE</b> is tools and equipment: description, quantity, days, daily rate. Shop and trading add power.</li>
					<li><b>BOCM</b> is materials: quantity, unit, unit cost.</li>
					<li><b>PPE</b> is safety gear: quantity in people, unit cost.</li>
					<li><b>MISC</b> is everything else. The parts are A accommodation, B transportation, C requirements, D admin, I insurances, E third party. The next topic draws every column.</li>
				</ul>
				<Callout title="Seeing more than one scope">Pin a row on the right. It stays under the scope you are editing, folded to its name, amount, and sheet chips. Click it to open the sheets. Click the header to fold it. Close others leaves only the one you are in. There is no limit. The pin is a view — it is not saved on the estimate.</Callout>
				<ul className="man-points">
					<li>An amber dot means that scope has no lines, or a description, unit, or price is behind the database.</li>
					<li>Sync on the breakdown can refresh description, unit, or price from the database. A special rate stays on this estimate only.</li>
					<li>The orange bar is the total for the work type you are looking at.</li>
					<li>Find scope filters the right-hand list. Empty work types can be hidden, then brought back with Show.</li>
					<li>Drag a task or a top-level scope to reorder it. A sub-subtask is opened from the list; it is not dragged as its own row.</li>
				</ul>
			</>
		)
	});

	add({
		id: "formats",
		group: "forms",
		title: "Sheet formats",
		text: "format columns bol bote bocm ppe misc day type shift overtime per diem kw unit cost accommodation transportation",
		body: (
			<>
				<p>Each chip on a scope opens one of these tables. The grey row is the header. The white row is one example line, so you can see where a number goes. The line under the table is how that sheet adds up.</p>
				<FormatSheet
					code="BOL"
					name="Bill of labor"
					columns={["Item", "Role", "Day type", "Shift", "Qty", "Days", "Rate/day", "OT hrs", "Per diem", "Allowance", "Subtotal"]}
					sample={["1", "Welder", "Regular", "Day", "2", "5", "rate", "2", "per diem", "allowance", "→"]}
					math="Subtotal = qty × days × rate, plus overtime (qty × days × OT hours × hourly × the overtime multiplier), plus qty × days × (per diem + allowance). Day type Regular, Sun/Special, or Holiday changes the rate. Shift Day or Night adds the night percent on a night row."
				/>
				<FormatSheet
					code="BOTE"
					name="Tools and equipment"
					columns={["Item", "Description", "Qty", "Days", "Rate/day", "kW", "Hrs/day", "₱/kWh", "Subtotal"]}
					sample={["1", "Welding machine", "1", "5", "rate", "kW", "hrs", "₱/kWh", "→"]}
					math="Use = qty × days × rate. On Shop and Trading, electricity is added: qty × days × hours/day × kW × ₱/kWh. Onsite tools stay unpowered — those three columns do not add money."
				/>
				<FormatSheet
					code="BOCM"
					name="Materials and consumables"
					columns={["Item", "Description", "Qty", "Unit", "Unit cost", "Total"]}
					sample={["1", "Electrode", "10", "kg", "cost", "→"]}
					math="Total = qty × unit cost. The unit is the one stored on the database row (kg, pc, lot)."
				/>
				<FormatSheet
					code="PPE"
					name="Safety gear"
					columns={["Item", "Description", "Qty", "Unit cost", "Total"]}
					sample={["1", "Helmet", "4", "cost", "→"]}
					math="Total = qty × unit cost. Qty is how many people, or how many pieces."
				/>
				<FormatSheet
					code="MISC"
					name="The rest, in parts"
					columns={["Part", "Description", "Qty", "Unit", "Days", "Unit cost", "Total"]}
					sample={["A", "House rental", "1", "lot", "1", "cost", "→"]}
					math="Total = qty × days × unit cost. Days counts as 1 when you leave it blank. Parts: A accommodation, B transportation, C requirements, D admin cost, I insurances, E third party. On the summary they print as E.1 through E.6."
				/>
			</>
		)
	});

	add({
		id: "templates",
		group: "forms",
		title: "Templates",
		text: `template onsite shop trading summary note task template ${(dc.summaryNotes || []).map((n) => n.text).join(" ")} ${(taskTemplates || []).map((t) => t.name).join(" ")}`,
		body: (
			<>
				<p>A template decides two different things. The three columns below are the printed notes. A saved task template is a whole scope you can drop onto a new job.</p>
				<h3 className="ce-serif">Which note prints on which job</h3>
				<p>Onsite, Shop, and Trading are the three print templates. A note appears under the summary only when that template is named on the note. Add a note, or take a template off it, in Admin → Document control, and this board moves.</p>
				<TemplateBoard notes={dc.summaryNotes} />
				<h3 className="ce-serif">A task you can reuse</h3>
				<p>Scope Library → Per Task Template saves a main task plus one scope, already filled with BOL, BOTE, BOCM, PPE, and MISC. On Breakdown, Start from Per Task Template drops that pack onto the estimate.</p>
				{(taskTemplates || []).length === 0 ? (
					<p className="man-empty">None saved yet. The moment one is saved, its name appears here.</p>
				) : (
					<ul className="man-points">
						{taskTemplates.map((tpl) => (
							<li key={tpl.id}><b>{tpl.name || "Untitled template"}</b> — {(workTypes || []).find((type) => type.id === tpl.workType)?.full || tpl.workType || "work type not set"}</li>
						))}
					</ul>
				)}
			</>
		)
	});

	add({
		id: "rce",
		group: "forms",
		title: "RCE request",
		text: "rce sales request accept reject revision information",
		body: (
			<>
				<p>The RCE is the ask. Sales fills the checklist below. Costing accepts it, and a cost estimate can be built against it.</p>
				<FormSketch kicker="Request for costing" rows={[
					["New project", "Existing project", "Inquiry number and date"],
					["Customer", "RCE number"],
					["Address", "RCE date"],
					["Project title", "Priority"],
					["Shopwork", "On-site", "Trading", "CE deadline"],
					["Mechanical", "Electrical", "Submission deadline"],
					["Checklist item", "Yes", "No"]
				]} />
				<p>The route in force is:</p>
				<Steps steps={flows.rce} levels={levels} />
				<ul className="man-points">
					<li><b>Accept</b> hands the request to costing.</li>
					<li><b>Reject / send back</b> returns it for a revision.</li>
					<li><b>Reply</b> answers a request for more information without starting the price.</li>
					<li>The printed header and footer are the same document-control text used on the cost estimate.</li>
				</ul>
			</>
		)
	});

	add({
		id: "inspection",
		group: "forms",
		title: "Onsite inspection",
		text: "inspection oif site visit photos manpower yes no",
		body: (
			<>
				<p>An inspection is a site visit, not a price. The form is one page, lettered A to F. Save files it. Open it again from Monitoring → Inspection.</p>
				<FormSketch kicker="Onsite inspection form" rows={[
					["Date", "OIF number", "Project", "RFQ number"],
					["Customer", "Representative", "Inspector", "Contact"],
					["A  Photos"],
					["B  Scope — onsite, shopwork, or supply only"],
					["C  Workpiece measurements — quantity and dimensions"],
					["D  Onsite activity — duration, then designation and number of people"],
					["E  Scope of work, in words"],
					["F  Materials, consumables, tools, and equipment"]
				]} />
				<p>The route in force is:</p>
				<Steps steps={flows.oif} levels={levels} />
				<ul className="man-points">
					<li>Record what you saw: manpower on site, yes or no checks, photos, and notes.</li>
					<li>Save files it. Open it again from Monitoring → Inspection.</li>
					<li>The columns on that monitoring list can be rearranged. That layout is separate from the approval route.</li>
				</ul>
			</>
		)
	});

	add({
		id: "monitoring",
		group: "watch",
		title: "Monitoring",
		text: `monitoring cost estimate inspection rce executive statuses ${jobStatuses.join(" ")} submitted revision`,
		body: (
			<>
				<p>Monitoring is the board, not the editor. Four lists: Cost Estimate, Inspection, RCE Request, and Executive Dashboard. Executive is for {whoCan(access, levels, "Monitoring — Executive")}.</p>
				<p>Open a cost estimate from the row menu, not by clicking the row itself. The row is the preview. The ⋮ menu is Open.</p>
				<Callout title="Active and closed">Done, Cancelled, Close bid, and No quote leave the active list. Every other status stays on it, including On Park and Waiting for information. Each status — what it means and which button sets it — is the next topic.</Callout>
			</>
		)
	});

	const statusNames = [...new Set(["Pending", ...(jobStatuses || [])])];
	add({
		id: "statuses",
		group: "watch",
		title: "What each status means",
		text: `status ongoing park waiting sourcing approval revision done cancelled no quote close bid draft pending ${statusNames.join(" ")}`,
		body: (
			<>
				<p>A status is the job’s situation, not a label you decorate. Some you choose. Some only a button can set. Closed ones drop off the active board.</p>
				<p className="man-kicker">The path a price usually takes</p>
				<Flow nodes={[
					{ label: "Ongoing", note: "you are editing" },
					{ label: "For approval", note: "Submit CE" },
					{ label: "Done", note: "last signature", hot: true }
				]} />
				<p className="man-kicker">Ways it leaves that path</p>
				<Flow nodes={[
					{ label: "Ongoing", note: "working" },
					{ label: "On Park", note: "Park Editor" },
					{ label: "Waiting", note: "need files" },
					{ label: "Sourcing", note: "need a supplier" }
				]} />
				<p className="man-kicker">If it is sent back, or if a signed one must change</p>
				<Flow nodes={[
					{ label: "For approval", note: "with the signer" },
					{ label: "Reject", note: "remarks required", off: true },
					{ label: "Ongoing", note: "you fix it" }
				]} />
				<Flow nodes={[
					{ label: "Done", note: "last signature", hot: true },
					{ label: "Revise", note: "writes a new revision" },
					{ label: "For revision", note: "price it again" }
				]} />
				<div className="man-status-list">
					{statusNames.map((name) => {
						const guide = STATUS_GUIDE[name] || {
							means: "This status is on the list.",
							does: `${statusBoard(name)}.`,
							how: "It is part of the status list the board uses."
						};
						return (
							<section key={name} className={"man-status" + (statusBoard(name).startsWith("Leaves") ? " is-off" : "")}>
								<header>
									<b>{name}</b>
									<em>{statusBoard(name)}</em>
								</header>
								<p><span>What it is.</span> {guide.means}</p>
								<p><span>What it does.</span> {guide.does}</p>
								<p><span>How you get there.</span> {guide.how}</p>
							</section>
						);
					})}
				</div>
			</>
		)
	});

	add({
		id: "database",
		group: "settings",
		title: "Database",
		text: `database masterlist ${sheets.map((s) => s.label).join(" ")} sort naming similarity ${rules.similarity} wipe`,
		body: (
			<>
				<p>The database is the price book. Estimates pick from it. They do not each invent a welder rate unless you mark a special rate on that estimate.</p>
				<div className="man-table-wrap">
					<table className="man-table">
						<thead><tr><th>Sheet</th><th>Sorted</th><th>Names written</th></tr></thead>
						<tbody>
							{sheets.map((sheet) => {
								const rule = rules.sheets?.[sheet.key] || {};
								return (
									<tr key={sheet.key}>
										<td>{sheet.label}</td>
										<td>{optionLabel(sortOptions, rule.sort)}</td>
										<td>{optionLabel(namingOptions, rule.naming)}</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
				<p>A new row whose name is very close to an old one is flagged. The closeness setting is {Math.round((Number(rules.similarity) || 0.78) * 100)} out of 100. Raise it if you want fewer warnings. Lower it if near-duplicates should be caught earlier.</p>
				<p>A row marked inactive is kept, but it drops out of the pick lists on an estimate. Clearing a whole sheet is a request. An administrator approves it. Until then, nothing is deleted.</p>
			</>
		)
	});

	add({
		id: "print",
		group: "settings",
		title: "What prints on the page",
		text: `header footer logo company ${dc.companyName} ${dc.headerLeft} ${dc.headerRight} ${dc.footerLeft} ${(dc.summaryNotes || []).map((n) => n.text).join(" ")}`,
		body: (
			<>
				<p>This is the summary page, shrunk. The numbers on the picture match the notes beside it. The header and footer are the real document-control text, filled with a sample number.</p>
				<SheetMap dc={dc} sample={sample} notes={dc.summaryNotes || []} signers={flows.ce || []} />
			</>
		)
	});

	add({
		id: "formula",
		group: "settings",
		title: "How labor math is set",
		text: `formula overtime night sunday holiday sss pag-ibig philhealth ${formula.hoursPerDay} ${formula.otMultiplier}`,
		body: (
			<>
				<p>These are the numbers every new labor line uses. Change them in Admin and both the estimate and this board use the new figure. Read each tile as: the name on top, the sum underneath.</p>
				<FormulaBoard formula={formula} />
			</>
		)
	});

	add({
		id: "what-if",
		group: "trouble",
		title: "When something looks wrong",
		text: "what if pin park locked assist transfer price amber wipe duplicate registration waiting no quote",
		body: (
			<div className="man-ifs">
				<If q="I need two scopes on screen." a="Pin the second scope on the right-hand list. Open it when you want its sheets. Close others when you are done comparing." />
				<If q="A price on the estimate does not match the database." a="The amber dot is the warning. Sync can update description, unit, or price. If this job must keep a different number, set a special rate. Special rates are not overwritten by a normal sync." />
				<If q="The estimate says view only." a="Someone else owns it. Assist lets you work while they stay the owner. Transfer moves ownership to the person you name. Leaving a file you can still edit does not throw away work already saved." />
				<If q="I stepped away." a="After 15 minutes with no mouse or keyboard the editing session locks. Come back and take it up again, or let someone assist." />
				<If q="The job is stuck, or we will not quote." a={`Set the status. The list is ${jobStatuses.join(", ")}. On Park, Waiting for information, Sourcing, and No quote are there so the board shows why it is not moving.`} />
				<If q="I changed who signs." a="Admin → Approval flow is the route. The next file follows the steps saved there. This guide’s “Who signs” topic is that same list." />
				<If q="The printed header is wrong." a="Admin → Document control. Company, logo, header, footer, and summary notes are what the page uses. The sample above is filled with today’s text." />
				<If q="The database warned that a name already exists." a={`It is the closeness check, now at ${Math.round((Number(rules.similarity) || 0.78) * 100)} out of 100. Keep the old row, or save the new one if it really is different.`} />
				<If q="I need a database sheet emptied." a="Ask from the database. An administrator approves or rejects. The rows stay until it is approved." />
				<If q="A person cannot see Monitoring or the Database." a="Check their level, not their department. Staff do not get those screens. Lead and above do. Administrator is the only level in Admin." />
				<If q="Someone registered and cannot get in." a="They sit under waiting users until an administrator accepts them and sets a level and a department." />
			</div>
		)
	});

	return list;
}

function nameIncludes(departments, needle) {
	return departments.some(([name]) => name.toLowerCase().includes(needle));
}

function whoCan(access, levels, area) {
	const row = access.find((item) => item.area === area);
	if (!row) return "the levels marked for it";
	const names = levels.filter((level) => row[level.id]).map((level) => level.label);
	return names.join(" and ") || "no one until access is turned on";
}

function If({ q, a }) {
	return (
		<details className="man-if">
			<summary>{q}</summary>
			<p>{a}</p>
		</details>
	);
}
