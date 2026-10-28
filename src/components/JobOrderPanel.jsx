import { useState } from "react";
import { personName } from "../lib/estimator/departments";
import { uploadNamedBlob } from "../lib/estimator/file-storage";
import { actorMayDecideJobOrder, jobOrderEditable } from "../lib/estimator/jobOrder";
import { jobOrderPdfBytes, quantityAttachmentPdfBytes } from "../lib/estimator/jobOrderPdf";
import { askReason } from "../lib/estimator/reasonBox";

/**
 * @param {Uint8Array | string} body
 * @param {string} name
 * @param {string} type
 */
function saveFile(body, name, type) {
	const bytes = typeof body === "string" ? body : Uint8Array.from(body);
	const blob = new Blob([bytes], { type });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = name;
	link.click();
	URL.revokeObjectURL(url);
}

const TYPES = ["SW", "F", "T", "O"];

/**
 * @param {{ jobOrder: any, sales: boolean, actorId: string, users?: unknown[], ceOptions?: { id: string, label?: string }[], createDefaults?: any, canCreate?: boolean, canCancel?: boolean, onJobOrder?: (action: string, payload?: any) => void }} props
 */
export function JobOrderPanel({ jobOrder, sales, actorId, users, ceOptions, createDefaults, canCreate, canCancel, onJobOrder }) {
	const defaults = createDefaults || {};
	const [type, setType] = useState("SW");
	const [clientCode, setClientCode] = useState("");
	const [picked, setPicked] = useState(/** @type {string[]} */ ([]));
	const [fields, setFields] = useState(/** @type {Record<string, string>} */ ({}));
	const [poKind, setPoKind] = useState("");
	const [poFileName, setPoFileName] = useState("");
	const [poStoragePath, setPoStoragePath] = useState("");
	const [fileNote, setFileNote] = useState("");
	const choices = Array.isArray(ceOptions) && ceOptions.length ? ceOptions : (defaults.ceId ? [{ id: String(defaults.ceId) }] : []);
	const name = (/** @type {unknown} */ id) => personName(id, users) || "Unnamed";

	/**
	 * @param {File | undefined} file
	 * @param {string} docId
	 */
	async function storePoFile(file, docId) {
		if (!file) return;
		setFileNote("");
		try {
			const path = await uploadNamedBlob("job-order", docId || "draft", file.name, file);
			if (jobOrder) onJobOrder?.("patch", { poFileName: file.name, poStoragePath: path });
			else {
				setPoFileName(file.name);
				setPoStoragePath(path);
			}
			setFileNote("File stored.");
		} catch (err) {
			setFileNote(err instanceof Error ? err.message : "The PO or NTP file was not stored.");
			if (!jobOrder) {
				setPoFileName("");
				setPoStoragePath("");
			}
		}
	}

	if (!jobOrder) {
		if (!canCreate) return null;
		const selected = picked.length ? picked : (defaults.ceId ? [String(defaults.ceId)] : []);
		return (
			<form
				id="job-order-form"
				className="ce-card wiz-card"
				onSubmit={(event) => {
					event.preventDefault();
					if (!poStoragePath) {
						setFileNote("Upload the PO or the NTP file.");
						return;
					}
					onJobOrder?.("create", {
						type,
						clientCode,
						ceIds: selected,
						poKind,
						poFileName,
						poStoragePath,
						client: fields.client ?? defaults.client ?? "",
						project: fields.project ?? defaults.project ?? "",
						poRef: fields.poRef || "",
						prNo: fields.prNo ?? defaults.prNo ?? "",
						salesPosition: fields.salesPosition || defaults.salesPosition || "Sales Rep",
						inCharge: fields.inCharge || "",
						inChargePosition: fields.inChargePosition || "",
						clientContact: fields.clientContact || "",
						clientContactPosition: fields.clientContactPosition || "",
						duration: fields.duration || "",
						controlNo: defaults.controlNo || "",
						year: defaults.year,
						ceQuantity: defaults.ceQuantity || [],
					});
				}}
			>
				<h3 className="ce-serif">Generate Job Order</h3>
				<p className="wiz-hint">SY3 fields. Type and client code are part of the number. No prices are entered here.</p>
				<div className="wiz-grid">
					<label className="wiz-field">
						<span className="ce-field-label">Type</span>
						<select className="ce-input" value={type} onChange={(event) => setType(event.target.value)}>
							{TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
						</select>
					</label>
					<label className="wiz-field">
						<span className="ce-field-label">Client code</span>
						<input className="ce-input" value={clientCode} onChange={(event) => setClientCode(event.target.value)} required />
					</label>
					<label className="wiz-field">
						<span className="ce-field-label">PO or NTP</span>
						<select className="ce-input" value={poKind} onChange={(event) => setPoKind(event.target.value)}>
							<option value="">Select</option>
							<option value="PO">PO</option>
							<option value="NTP">NTP</option>
						</select>
					</label>
					<label className="wiz-field">
						<span className="ce-field-label">PO or NTP file</span>
						<input className="ce-input" type="file" onChange={(event) => { void storePoFile(event.target.files?.[0], "draft"); }} />
						{fileNote ? <span className="wiz-hint">{fileNote}</span> : null}
					</label>
				</div>
				<div className="wiz-grid">
					{[
						["client", "Client"],
						["project", "Project"],
						["poRef", "PO ref no."],
						["duration", "Duration"],
						["inCharge", "Project in charge"],
						["inChargePosition", "In-charge position"],
						["clientContact", "Client contact"],
						["clientContactPosition", "Contact position"],
						["salesPosition", "Sales position"],
					].map(([key, label]) => (
						<label key={key} className="wiz-field">
							<span className="ce-field-label">{label}</span>
							<input className="ce-input" value={fields[key] ?? (key === "client" ? defaults.client || "" : key === "project" ? defaults.project || "" : key === "salesPosition" ? defaults.salesPosition || "Sales Rep" : "")} onChange={(event) => setFields((prev) => ({ ...prev, [key]: event.target.value }))} />
						</label>
					))}
				</div>
				<fieldset>
					<legend className="ce-field-label">Linked cost estimates</legend>
					{choices.map((choice) => (
						<label key={choice.id}>
							<input
								type="checkbox"
								checked={selected.includes(choice.id)}
								onChange={(event) => {
									setPicked((prev) => {
										const base = prev.length ? prev : selected;
										return event.target.checked ? [...new Set([...base, choice.id])] : base.filter((id) => id !== choice.id);
									});
								}}
							/>
							{" "}{choice.label || choice.id}
						</label>
					))}
				</fieldset>
				<button type="submit" className="ce-btn-primary ce-btn-sm">Generate Job Order</button>
			</form>
		);
	}

	const open = jobOrderEditable(jobOrder);
	const mayDecide = actorMayDecideJobOrder(jobOrder, actorId);
	const holder = jobOrder.status === "Submitted" ? jobOrder.steps?.[jobOrder.currentIndex] : null;
	const linked = Array.isArray(jobOrder.ceIds) ? jobOrder.ceIds : [];

	/** @param {string} key @param {string} value */
	function patch(key, value) {
		onJobOrder?.("patch", { [key]: value });
	}

	return (
		<div className="ce-card wiz-card" id="job-order-form">
			<h3 className="ce-serif">Job order {jobOrder.joNo}</h3>
			<p>Status {jobOrder.status} · Type {jobOrder.type} · Client code {jobOrder.clientCode}</p>
			<p className="wiz-hint">SY3 job order. No prices are shown. The number is shown once.</p>
			{jobOrder.approverFor ? <p className="wiz-hint">Signature {jobOrder.approverFor}</p> : null}
			{open ? (
				<div className="wiz-grid">
					{[
						["dateIssued", "Date issued"],
						["client", "Client"],
						["poRef", "PO ref no."],
						["project", "Project"],
						["prNo", "PR ref no."],
						["salesPosition", "Sales position"],
						["inCharge", "Project in charge"],
						["inChargePosition", "In-charge position"],
						["clientContact", "Client contact"],
						["clientContactPosition", "Contact position"],
						["duration", "Duration"],
					].map(([key, label]) => (
						<label key={key} className="wiz-field">
							<span className="ce-field-label">{label}</span>
							<input className="ce-input" defaultValue={jobOrder[key] || ""} onBlur={(event) => patch(key, event.target.value)} />
						</label>
					))}
					<label className="wiz-field">
						<span className="ce-field-label">PO or NTP</span>
						<select className="ce-input" value={jobOrder.poKind || ""} onChange={(event) => patch("poKind", event.target.value)}>
							<option value="">Select</option>
							<option value="PO">PO</option>
							<option value="NTP">NTP</option>
						</select>
					</label>
					<label className="wiz-field">
						<span className="ce-field-label">PO or NTP file</span>
						<input className="ce-input" type="file" onChange={(event) => { void storePoFile(event.target.files?.[0], jobOrder.id || "draft"); }} />
						<span className="wiz-hint">{jobOrder.poFileName || "No file yet"}{jobOrder.poStoragePath ? " · stored" : ""}{fileNote ? ` · ${fileNote}` : ""}</span>
					</label>
				</div>
			) : <p>{jobOrder.poKind || "PO or NTP"} {jobOrder.poFileName || "—"} · In charge {jobOrder.inCharge || "—"}</p>}
			{open && choices.length ? (
				<fieldset>
					<legend className="ce-field-label">Linked cost estimates</legend>
					{choices.map((choice) => (
						<label key={choice.id}>
							<input
								type="checkbox"
								checked={linked.includes(choice.id)}
								onChange={(event) => {
									const next = event.target.checked ? [...new Set([...linked, choice.id])] : linked.filter((/** @type {string} */ id) => id !== choice.id);
									onJobOrder?.("patch", { ceIds: next });
								}}
							/>
							{" "}{choice.label || choice.id}
						</label>
					))}
				</fieldset>
			) : <p className="wiz-hint">Linked CE {linked.join(", ") || "—"}</p>}
			<p className="wiz-hint">Prepared by {name(jobOrder.salesRepId)} {jobOrder.salesPosition} · Checked and approved by {name(jobOrder.approverId)} {jobOrder.approverFor || ""}</p>
			{holder ? <p className="wiz-hint">Waiting for {name(holder.userId)}{holder.backupUserId ? ` (backup ${name(holder.backupUserId)})` : ""}</p> : null}
			<div className="wiz-grid">
				<button type="button" className="ce-btn-ghost ce-btn-sm" onClick={() => saveFile(jobOrderPdfBytes(jobOrder, users), `${jobOrder.joNo}.pdf`, "application/pdf")}>SY3 PDF</button>
				<button type="button" className="ce-btn-ghost ce-btn-sm" onClick={() => saveFile(quantityAttachmentPdfBytes(jobOrder.ceQuantity), `${jobOrder.joNo}-quantities.pdf`, "application/pdf")}>Quantities PDF</button>
				{open && sales && actorId === jobOrder.ownerId ? (
					<button type="button" className="ce-btn-primary ce-btn-sm" onClick={() => onJobOrder?.("submit")}>Submit job order</button>
				) : null}
				{mayDecide ? <button type="button" className="ce-btn-primary ce-btn-sm" onClick={() => onJobOrder?.("approve")}>Approve job order</button> : null}
				{jobOrder.status === "Approved" && sales ? <button type="button" className="ce-btn-ghost ce-btn-sm" onClick={() => onJobOrder?.("revise")}>Revise</button> : null}
				{jobOrder.status !== "Cancelled" && canCancel ? (
					<button type="button" className="ce-btn-ghost ce-btn-sm" onClick={() => {
						void askReason({ title: "Cancel job order", label: "Cancel reason", required: true }).then((result) => {
							if (!result.ok) return;
							onJobOrder?.("cancel", { remarks: result.text });
						});
					}}>Cancel</button>
				) : null}
			</div>
			<ul>
				{(jobOrder.timeline || []).map((/** @type {any} */ row) => (
					<li key={row.id}>{row.action} · {name(row.who)}{row.remarks ? ` · ${row.remarks}` : ""}</li>
				))}
			</ul>
		</div>
	);
}
