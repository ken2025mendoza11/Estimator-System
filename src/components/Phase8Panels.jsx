// @ts-nocheck
import { useState } from "react";
import {
	addQuotation,
	addQuotationLine,
	availabilityKeysFrom,
	bytesToDataUrl,
	finalizePending,
	isAdminLevel,
	isReviewerLevel,
	lineFromQuote,
	locationMirrorRow,
	pendingReminderPlan,
	quotationLineMirrorRow,
	quotationMirrorRow,
	quotationReference,
	recommendPending,
	sha256Hex,
	stampReminder,
	submitPending,
	tryMirror,
	withClientLocation
} from "../lib/estimator/phase8";

const CATS = ["BOL", "BOTE", "BOCM", "PPE", "MISC"];

function itemName(item) {
	return String(item?.description || item?.item || item?.role || item?.name || "").trim();
}

async function optionalMirror(client, table, rows) {
	if (!client) return;
	await tryMirror(client, table, rows);
}

export function Phase8CePanel({
	features,
	library,
	onLibrary,
	refs,
	onRefs,
	tasks,
	readOnly,
	clientName,
	clients,
	onUpdateClient,
	items,
	onUpdateItem,
	keys,
	records,
	onRecords,
	level,
	actor,
	holidays,
	escalateAfter,
	mirror,
	unticked,
	onUntick,
	onAddLine
}) {
	const [line, setLine] = useState({ description: "", qty: "1", unit: "", unitCost: "", masterlistId: "", category: "BOCM" });
	const [pick, setPick] = useState("");
	const [note, setNote] = useState("");
	const [message, setMessage] = useState("");
	const quotationsOn = features?.quotations === true;
	const availabilityOn = features?.availability === true;
	const locationsOn = features?.clientLocations === true;
	const pendingOn = features?.pendingRecords === true;
	if (!quotationsOn && !availabilityOn && !locationsOn && !pendingOn) return null;

	async function onFile(event) {
		const file = event.target.files && event.target.files[0];
		event.target.value = "";
		if (!file || readOnly) return;
		const bytes = new Uint8Array(await file.arrayBuffer());
		const sha256 = await sha256Hex(bytes);
		const saved = addQuotation(library, {
			sha256,
			fileName: file.name,
			mime: file.type || "application/pdf",
			byteLength: bytes.length,
			dataUrl: bytesToDataUrl(bytes, file.type || "application/pdf"),
			at: new Date().toISOString()
		});
		onLibrary(saved.library);
		if (!refs.some((ref) => ref.quotationId === saved.quotation.id)) onRefs([...(refs || []), quotationReference(saved.quotation.id)]);
		await optionalMirror(mirror, "quotations", [quotationMirrorRow(saved.quotation)]);
		setPick(saved.quotation.id);
		setMessage(saved.duplicate ? "That file is already in the library. This estimate references it." : "Quotation stored once.");
	}

	function addLine(event) {
		event.preventDefault();
		const quotation = (library || []).find((row) => row.id === pick);
		if (!quotation || readOnly) return;
		const next = addQuotationLine(quotation, line);
		const added = next.lines[next.lines.length - 1];
		onLibrary((library || []).map((row) => row.id === quotation.id ? next : row));
		optionalMirror(mirror, "quotation_lines", [quotationLineMirrorRow(next, added)]);
		setLine({ description: "", qty: "1", unit: "", unitCost: "", masterlistId: "", category: line.category });
	}

	function placeLine(quoteLine) {
		const task = (tasks || [])[0];
		const sub = task?.subtasks?.[0];
		if (!task || !sub) {
			setMessage("Add a task and a subtask first.");
			return;
		}
		const dbItem = (items || []).find((item) => item.id === quoteLine.masterlistId) || (items || []).find((item) => itemName(item).toLowerCase() === String(quoteLine.description || "").toLowerCase());
		const row = lineFromQuote({
			quoteLine,
			dbItem,
			id: `line-${quoteLine.id}`,
			category: line.category || "BOCM"
		});
		onAddLine(task.id, sub.id, line.category || "BOCM", row);
		setMessage(row.priceSource === "db" ? "Database price kept." : "Quote price used. There is no database price.");
	}

	const shown = (library || []).filter((row) => (refs || []).some((ref) => ref.quotationId === row.id));

	return (
		<div className="ce-card wiz-card">
			{quotationsOn ? (
				<div>
					<h3 className="ce-serif">Quotations</h3>
					<p className="wiz-hint">The file is stored once. This estimate keeps a reference. Untick an annex for this export only.</p>
					{readOnly ? null : <input type="file" accept="application/pdf" onChange={onFile} />}
					{shown.map((row) => (
						<div key={row.id}>
							<label className="ce-picker-row">
								<input
									type="checkbox"
									checked={!unticked?.[row.id]}
									onChange={(e) => onUntick(row.id, !e.target.checked)}
								/>
								<span>{row.fileName || row.id}</span>
							</label>
							{row.dataUrl ? <iframe title={row.fileName || "Quotation"} src={row.dataUrl} className="ce-export-preview" /> : null}
							{(row.lines || []).map((quoteLine) => (
								<p key={quoteLine.id} className="wiz-hint">
									{quoteLine.description} · {quoteLine.qty} {quoteLine.unit} · {quoteLine.unitCost}
									{readOnly ? null : <button type="button" className="ce-btn-ghost ce-btn-sm" onClick={() => placeLine(quoteLine)}>Use on estimate</button>}
								</p>
							))}
						</div>
					))}
					{readOnly || !pick ? null : (
						<form onSubmit={addLine}>
							<label className="wiz-field"><span className="ce-field-label">Line</span>
								<input className="ce-input" value={line.description} onChange={(e) => setLine({ ...line, description: e.target.value })} />
							</label>
							<label className="wiz-field"><span className="ce-field-label">Qty</span>
								<input className="ce-input" value={line.qty} onChange={(e) => setLine({ ...line, qty: e.target.value })} />
							</label>
							<label className="wiz-field"><span className="ce-field-label">Unit</span>
								<input className="ce-input" value={line.unit} onChange={(e) => setLine({ ...line, unit: e.target.value })} />
							</label>
							<label className="wiz-field"><span className="ce-field-label">Quote price</span>
								<input className="ce-input" value={line.unitCost} onChange={(e) => setLine({ ...line, unitCost: e.target.value })} />
							</label>
							<label className="wiz-field"><span className="ce-field-label">Database id</span>
								<input className="ce-input" value={line.masterlistId} onChange={(e) => setLine({ ...line, masterlistId: e.target.value })} />
							</label>
							<label className="wiz-field"><span className="ce-field-label">Category</span>
								<select className="ce-input" value={line.category} onChange={(e) => setLine({ ...line, category: e.target.value })}>
									{CATS.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
								</select>
							</label>
							<button type="submit" className="ce-btn-ghost ce-btn-sm">Add quote line</button>
						</form>
					)}
				</div>
			) : null}
			{availabilityOn ? (
				<div>
					<h3 className="ce-serif">Availability</h3>
					{(items || []).map((item) => (
						<label key={item.id} className="wiz-field">
							<span className="ce-field-label">{itemName(item) || item.id}</span>
							<select
								className="ce-input"
								value={item.availabilityKey || ""}
								disabled={readOnly}
								onChange={(e) => onUpdateItem(item.categoryKey, item.id, { availabilityKey: e.target.value })}
							>
								<option value="">No key</option>
								{availabilityKeysFrom(keys).map((key) => <option key={key.id} value={key.id}>{key.label}</option>)}
							</select>
						</label>
					))}
				</div>
			) : null}
			{locationsOn ? (
				<LocationEditor clients={clients} clientName={clientName} readOnly={readOnly} mirror={mirror} onUpdateClient={onUpdateClient} />
			) : null}
			{pendingOn ? (
				<PendingEditor
					records={records}
					onRecords={onRecords}
					level={level}
					actor={actor}
					readOnly={readOnly}
					note={note}
					setNote={setNote}
					holidays={holidays}
					escalateAfter={escalateAfter}
					mirror={mirror}
					setMessage={setMessage}
				/>
			) : null}
			{message ? <p className="wiz-hint">{message}</p> : null}
		</div>
	);
}

function LocationEditor({ clients, clientName, readOnly, mirror, onUpdateClient }) {
	const [draft, setDraft] = useState({ label: "", address: "", city: "" });
	const name = String(clientName || "").trim().toLowerCase();
	const list = (clients || []).filter((client) => {
		if (!name) return true;
		return String(client.fullName || "").trim().toLowerCase() === name || String(client.clientCode || "").trim().toLowerCase() === name;
	});
	function add(event, client) {
		event.preventDefault();
		if (readOnly) return;
		const next = withClientLocation(client, draft);
		const loc = next.locations[next.locations.length - 1];
		onUpdateClient(client.id, { locations: next.locations });
		optionalMirror(mirror, "client_locations", [locationMirrorRow(client.id, loc)]);
		setDraft({ label: "", address: "", city: "" });
	}
	return (
		<div>
			<h3 className="ce-serif">Client locations</h3>
			{list.map((client) => (
				<div key={client.id}>
					<p className="wiz-hint">{client.fullName || client.clientCode}</p>
					{(client.locations || []).map((loc) => <p key={loc.id} className="wiz-hint">{[loc.label, loc.city, loc.address].filter(Boolean).join(" · ")}</p>)}
					{readOnly ? null : (
						<form onSubmit={(event) => add(event, client)}>
							<input className="ce-input" placeholder="Label" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
							<input className="ce-input" placeholder="City" value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} />
							<input className="ce-input" placeholder="Address" value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} />
							<button type="submit" className="ce-btn-ghost ce-btn-sm">Add location</button>
						</form>
					)}
				</div>
			))}
		</div>
	);
}

function PendingEditor({ records, onRecords, level, actor, readOnly, note, setNote, holidays, escalateAfter, mirror, setMessage }) {
	const [name, setName] = useState("");
	const [replacesId, setReplacesId] = useState("");
	function replace(next) {
		onRecords(next);
		optionalMirror(mirror, "pending_records", next.map((record) => ({
			id: record.id,
			kind: record.kind,
			payload: record.payload,
			status: record.status,
			replaces_id: record.replacesId || "",
			target_id: record.targetId || ""
		})));
	}
	function submit(event) {
		event.preventDefault();
		if (readOnly || !name.trim()) return;
		const id = `ml-${Math.random().toString(16).slice(2, 10)}`;
		const record = submitPending({
			kind: "item",
			payload: { id, description: name.trim() },
			actor,
			now: new Date().toISOString(),
			replacesId
		});
		replace([...(records || []), record]);
		setName("");
		setReplacesId("");
	}
	function apply(record, result) {
		if (!result.ok) {
			setMessage(result.message);
			return;
		}
		replace((records || []).map((row) => row.id === record.id ? result.record : row));
	}
	return (
		<div>
			<h3 className="ce-serif">Pending records</h3>
			{(records || []).map((record) => {
				const plan = pendingReminderPlan({ record, holidays, escalateAfter });
				return (
					<div key={record.id}>
						<p className="wiz-hint">{record.payload?.description || record.id} · {record.status}{plan.escalate ? " · Escalated" : ""}{plan.slots.length ? " · Reminder due" : ""}</p>
						{readOnly ? null : (
							<div>
								{record.status === "submitted" && isReviewerLevel(level) ? <button type="button" className="ce-btn-ghost ce-btn-sm" onClick={() => apply(record, recommendPending({ record, actor, level, now: new Date().toISOString(), note }))}>Recommend</button> : null}
								{record.status === "recommended" && isAdminLevel(level) ? <button type="button" className="ce-btn-ghost ce-btn-sm" onClick={() => apply(record, finalizePending({ record, actor, level, now: new Date().toISOString() }))}>Finalise</button> : null}
								{plan.slots.length || plan.escalate ? <button type="button" className="ce-btn-ghost ce-btn-sm" onClick={() => apply(record, { ok: true, record: stampReminder(record, plan, new Date()) })}>Log reminder</button> : null}
							</div>
						)}
					</div>
				);
			})}
			{readOnly ? null : (
				<form onSubmit={submit}>
					<input className="ce-input" placeholder="New item" value={name} onChange={(e) => setName(e.target.value)} />
					<input className="ce-input" placeholder="Replaces id" value={replacesId} onChange={(e) => setReplacesId(e.target.value)} />
					<input className="ce-input" placeholder="Recommend note" value={note} onChange={(e) => setNote(e.target.value)} />
					<button type="submit" className="ce-btn-ghost ce-btn-sm">Submit pending</button>
				</form>
			)}
		</div>
	);
}

