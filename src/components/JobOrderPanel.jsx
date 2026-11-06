// @ts-nocheck
import { useEffect, useState } from "react";
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

const TYPES = [
	["SW", "SW · Shop Work"],
	["F", "F · Field / On-Site"],
	["T", "T · Trading / Supply"],
	["O", "Others"],
];

/**
 * @param {unknown} qty
 */
function quantityLabel(qty) {
	if (typeof qty === "string" && qty.trim()) return qty.trim();
	if (Array.isArray(qty)) {
		const n = qty.length;
		return n ? `${n} task${n === 1 ? "" : "s"} from the cost estimate` : "—";
	}
	return "From the cost estimate";
}

/**
 * Preview only. The real number is claimed when the draft is saved.
 * @param {string} type
 * @param {string} clientCode
 * @param {string | number} year
 * @param {string} controlNo
 */
function previewJoNo(type, clientCode, year, controlNo) {
	const yy = String(year || "").slice(-2) || "YY";
	const code = String(clientCode || "").trim().toUpperCase() || "___";
	const ctrl = String(controlNo || "").trim() || "____";
	return ["JO", "___", type || "SW", code, yy, ctrl];
}

/**
 * @param {{ jobOrder: any, sales: boolean, actorId: string, users?: unknown[], ceOptions?: { id: string, label?: string }[], createDefaults?: any, canCreate?: boolean, canCancel?: boolean, buildPackPdf?: (jo: any) => Promise<Uint8Array>, onJobOrder?: (action: string, payload?: any) => void }} props
 */
function JobOrderPanelV2({ jobOrder, sales, actorId, users, ceOptions, createDefaults, canCreate, canCancel, buildPackPdf, onJobOrder }) {
	const defaults = createDefaults || {};
	const [type, setType] = useState("SW");
	const [clientCode, setClientCode] = useState("");
	const [picked, setPicked] = useState(/** @type {string[]} */ ([]));
	const [fields, setFields] = useState(/** @type {Record<string, string>} */ ({}));
	const [lines, setLines] = useState(/** @type {{ span: string, text: string }[]} */ ([{ span: "", text: "" }]));
	const [annexA, setAnnexA] = useState(true);
	const [poKind, setPoKind] = useState("");
	const [poFileName, setPoFileName] = useState("");
	const [poStoragePath, setPoStoragePath] = useState("");
	const [fileNote, setFileNote] = useState("");
	const [previewUrl, setPreviewUrl] = useState("");
	const [previewNote, setPreviewNote] = useState("");
	const choices = Array.isArray(ceOptions) && ceOptions.length ? ceOptions : (defaults.ceId ? [{ id: String(defaults.ceId) }] : []);
	const name = (/** @type {unknown} */ id) => personName(id, users) || "";
	const ceLabel = String(defaults.ceLabel || defaults.ceId || "");
	const salesperson = String(defaults.salesperson || name(actorId) || "—");

	useEffect(() => () => {
		if (previewUrl) URL.revokeObjectURL(previewUrl);
	}, [previewUrl]);

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

	function draftPayload() {
		return {
			type,
			clientCode,
			ceIds: picked.length ? picked : (defaults.ceId ? [String(defaults.ceId)] : []),
			poKind,
			poFileName,
			poStoragePath,
			client: defaults.client || "",
			project: defaults.project || "",
			poRef: fields.poRef || "",
			prNo: fields.prNo ?? defaults.prNo ?? "",
			salesPosition: fields.salesPosition || defaults.salesPosition || "Sales Rep",
			inCharge: fields.inCharge || "",
			inChargePosition: fields.inChargePosition || "",
			clientContact: fields.clientContact || "",
			clientContactPosition: fields.clientContactPosition || "",
			duration: fields.duration || "",
			mobilization: fields.mobilization || "",
			mobilizationNote: fields.mobilizationNote || "",
			leadtime: lines.filter((row) => row.span || row.text),
			annexA,
			controlNo: defaults.controlNo || "",
			year: defaults.year,
			ceQuantity: defaults.ceQuantity || [],
		};
	}

	function liveJo() {
		if (jobOrder) return { ...jobOrder, annexA: jobOrder.annexA !== false };
		return {
			...draftPayload(),
			joNo: previewJoNo(type, clientCode, defaults.year, defaults.controlNo).join("-"),
			dateIssued: "",
			salesRepId: actorId,
			status: "Draft",
			steps: [],
			timeline: [],
		};
	}

	async function showPreview(jo) {
		if (!buildPackPdf) return;
		setPreviewNote("");
		try {
			const bytes = await buildPackPdf(jo);
			const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
			setPreviewUrl((prev) => {
				if (prev) URL.revokeObjectURL(prev);
				return url;
			});
		} catch (err) {
			setPreviewNote(err instanceof Error ? err.message : "Could not build the PDF preview.");
		}
	}

	const step = !jobOrder ? 1 : jobOrder.status === "Submitted" ? 3 : jobOrder.status === "Approved" ? 4 : jobOrder.status === "Cancelled" ? 1 : 2;
	const stepLabels = ["CE Approved", "Fill JO details", "Submit", "Approval", "Issued"];

	const side = (jo, reserved) => (
		<aside className="jo-side">
			<section className="ce-card">
				<div className="jo-card-h"><h3 className="ce-serif">JO PDF preview</h3></div>
				<div className="jo-thumb">
					{previewUrl ? <iframe title="Job order preview" src={previewUrl} /> : <p className="wiz-hint">Preview PDF to see page 1 here.</p>}
				</div>
				<div className="jo-meta">
					<div><span>Status</span><b>{jo?.status || "Draft"}</b></div>
					<div><span>Annex A</span><b>{(jo?.annexA !== false) ? "Attached" : "Off"}</b></div>
					<div><span>Approver</span><b>{name(jo?.approverId) || "Assigned on submit"}</b></div>
					<div><span>Backup</span><b>{jo?.approverFor ? String(jo.approverFor).replace(/^for\s+/i, "") : "Assigned on submit"}</b></div>
					<div><span>Number</span><b>{reserved || "Preview"}</b></div>
				</div>
				{previewNote ? <p className="wiz-hint">{previewNote}</p> : null}
			</section>
		</aside>
	);

	if (!jobOrder) {
		if (!canCreate) return null;
		const selected = picked.length ? picked : (defaults.ceId ? [String(defaults.ceId)] : []);
		const chips = previewJoNo(type, clientCode, defaults.year, defaults.controlNo);
		const captions = ["Job Order", "JO Ref. #", "Type of Project", "Client's Code", "Year", "Proposal Control No."];
		return (
			<div className="jo-layout" id="job-order-form">
				<div>
					<div className="jo-stepper" aria-label="Job order steps">
						{stepLabels.map((label, index) => (
							<div key={label} className={"jo-step" + (index < step ? " is-done" : index === step ? " is-cur" : "")}>
								<b>{index < step ? "✓" : index + 1}</b>
								<span>{label}</span>
							</div>
						))}
					</div>
					<section className="ce-card">
						<div className="jo-card-h"><h3 className="ce-serif">From the CE / proposal</h3><small>Auto-filled · read only</small></div>
						<div className="jo-grid">
							<label><span className="ce-field-label">Ref. CE No.</span><div className="ce-input jo-ro ce-mono">{ceLabel || "—"}</div></label>
							<label><span className="ce-field-label">Client</span><div className="ce-input jo-ro">{defaults.client || "—"}</div></label>
							<label className="jo-span"><span className="ce-field-label">Project description</span><div className="ce-input jo-ro">{defaults.project || "—"}</div></label>
							<label><span className="ce-field-label">Quantity</span><div className="ce-input jo-ro">{quantityLabel(defaults.ceQuantity)}</div></label>
							<label><span className="ce-field-label">Salesperson</span><div className="ce-input jo-ro">{salesperson} · {fields.salesPosition || defaults.salesPosition || "Sales Rep"}</div></label>
						</div>
					</section>
					<section className="ce-card">
						<div className="jo-card-h"><h3 className="ce-serif">Job order details</h3><small>Fill in before submitting</small></div>
						<div className="jo-grid">
							<label><span className="ce-field-label">PO reference no.</span><input className="ce-input" value={fields.poRef || ""} onChange={(event) => setFields((prev) => ({ ...prev, poRef: event.target.value }))} /></label>
							<label><span className="ce-field-label">PR reference no.</span><input className="ce-input" value={fields.prNo ?? defaults.prNo ?? ""} onChange={(event) => setFields((prev) => ({ ...prev, prNo: event.target.value }))} /></label>
							<label>
								<span className="ce-field-label">Project in-charge · Dept./Position</span>
								<span className="jo-pair">
									<input className="ce-input" value={fields.inCharge || ""} placeholder="Name" onChange={(event) => setFields((prev) => ({ ...prev, inCharge: event.target.value }))} />
									<input className="ce-input" value={fields.inChargePosition || ""} placeholder="Dept. / position" onChange={(event) => setFields((prev) => ({ ...prev, inChargePosition: event.target.value }))} />
								</span>
							</label>
							<label>
								<span className="ce-field-label">Client contact · Position</span>
								<span className="jo-pair">
									<input className="ce-input" value={fields.clientContact || ""} placeholder="Name" onChange={(event) => setFields((prev) => ({ ...prev, clientContact: event.target.value }))} />
									<input className="ce-input" value={fields.clientContactPosition || ""} placeholder="Position" onChange={(event) => setFields((prev) => ({ ...prev, clientContactPosition: event.target.value }))} />
								</span>
							</label>
							<label><span className="ce-field-label">Client code</span><input className="ce-input" value={clientCode} onChange={(event) => setClientCode(event.target.value)} required /></label>
							<label>
								<span className="ce-field-label">PO or NTP</span>
								<select className="ce-input" value={poKind} onChange={(event) => setPoKind(event.target.value)}>
									<option value="">Select</option>
									<option value="PO">PO</option>
									<option value="NTP">NTP</option>
								</select>
							</label>
							<label className="jo-span">
								<span className="ce-field-label">PO or NTP file</span>
								<input className="ce-input" type="file" onChange={(event) => { void storePoFile(event.target.files?.[0], "draft"); }} />
								{fileNote ? <span className="wiz-hint">{fileNote}</span> : null}
							</label>
							<div className="jo-span">
								<span className="ce-field-label">Type of project</span>
								<div className="jo-types">
									{TYPES.map(([code, label]) => (
										<button key={code} type="button" className={"jo-type" + (type === code ? " is-on" : "")} onClick={() => setType(code)}>
											<span>{type === code ? "✓" : ""}</span>{label}
										</button>
									))}
								</div>
							</div>
							<div className="jo-span">
								<span className="ce-field-label">Project lead time {fields.duration ? `· ${fields.duration}` : ""}</span>
								<ul className="jo-lines">
									{lines.map((row, index) => (
										<li key={index}>
											<input className="ce-input" value={row.span} placeholder="One (1) Day" onChange={(event) => setLines((prev) => prev.map((item, i) => i === index ? { ...item, span: event.target.value } : item))} />
											<input className="ce-input" value={row.text} placeholder="What happens in this line" onChange={(event) => setLines((prev) => prev.map((item, i) => i === index ? { ...item, text: event.target.value } : item))} />
											<button type="button" className="ce-btn-ghost ce-btn-sm" onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))} aria-label="Remove lead-time line">×</button>
										</li>
									))}
								</ul>
								<button type="button" className="ce-btn-ghost ce-btn-sm" onClick={() => setLines((prev) => [...prev, { span: "", text: "" }])}>Add lead-time line</button>
							</div>
							<label><span className="ce-field-label">Lead-time total</span><input className="ce-input" value={fields.duration || ""} placeholder="10 working days" onChange={(event) => setFields((prev) => ({ ...prev, duration: event.target.value }))} /></label>
							<label><span className="ce-field-label">Date of mobilization</span><input className="ce-input" type="date" value={fields.mobilization || ""} onChange={(event) => setFields((prev) => ({ ...prev, mobilization: event.target.value }))} /></label>
							<label className="jo-span"><span className="ce-field-label">Mobilization note</span><input className="ce-input" value={fields.mobilizationNote || ""} onChange={(event) => setFields((prev) => ({ ...prev, mobilizationNote: event.target.value }))} /></label>
						</div>
					</section>
					{choices.length > 1 ? (
						<fieldset className="ce-card" style={{ padding: "0.8rem 1rem" }}>
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
					) : null}
					<section className="ce-card">
						<div className="jo-card-h"><h3 className="ce-serif">JO reference no.</h3><small>Built automatically · updates with type</small></div>
						<div className="jo-guide">
							<div className="jo-guide-title">JO REFERENCE NO. GUIDE</div>
							<div className="jo-chips">
								{chips.map((chip, index) => (
									<span key={captions[index]} className="jo-seg">
										{index ? <i>–</i> : null}
										<b className={index === 2 ? "is-flash" : ""}>{chip}</b>
										<small>{captions[index]}</small>
									</span>
								))}
							</div>
							<p className="wiz-hint">Preview only. The final number is reserved when the draft is saved. Saving uses the existing number allocator; submit does not take a second number.</p>
						</div>
						<label className="jo-toggle">
							<input type="checkbox" checked={annexA} onChange={(event) => setAnnexA(event.target.checked)} />
							<span><b>Attach Annex A: Cost Estimate (prices hidden)</b><p className="wiz-hint">The cost estimate is appended after page 1 with all amounts blanked.</p></span>
						</label>
						<div className="jo-actions">
							<button type="button" className="ce-btn-ghost ce-btn-sm" onClick={() => { void showPreview(liveJo()); }}>Preview PDF</button>
							<button type="button" className="ce-btn-ghost ce-btn-sm" onClick={() => {
								if (!poStoragePath) { setFileNote("Upload the PO or the NTP file."); return; }
								onJobOrder?.("create", draftPayload());
							}}>Save Draft</button>
							<button type="button" className="ce-btn-primary ce-btn-sm" onClick={() => {
								if (!poStoragePath) { setFileNote("Upload the PO or the NTP file."); return; }
								onJobOrder?.("create-submit", draftPayload());
							}}>Submit for Approval</button>
						</div>
					</section>
				</div>
				{side(liveJo(), "Preview")}
			</div>
		);
	}

	const open = jobOrderEditable(jobOrder);
	const mayDecide = actorMayDecideJobOrder(jobOrder, actorId);
	const holder = jobOrder.status === "Submitted" ? jobOrder.steps?.[jobOrder.currentIndex] : null;
	const linked = Array.isArray(jobOrder.ceIds) ? jobOrder.ceIds : [];
	const storedLines = Array.isArray(jobOrder.leadtime) && jobOrder.leadtime.length ? jobOrder.leadtime : [{ span: "", text: "" }];
	const chips = String(jobOrder.joNo || "").split("-");
	const captions = ["Job Order", "JO Ref. #", "Type of Project", "Client's Code", "Year", "Proposal Control No."];

	/** @param {string} key @param {string} value */
	function patch(key, value) {
		onJobOrder?.("patch", { [key]: value });
	}

	return (
		<div className="jo-layout" id="job-order-form">
			<div>
				<div className="jo-stepper" aria-label="Job order steps">
					{stepLabels.map((label, index) => (
						<div key={label} className={"jo-step" + (index < step ? " is-done" : index === step ? " is-cur" : "")}>
							<b>{index < step ? "✓" : index + 1}</b>
							<span>{label}</span>
						</div>
					))}
				</div>
				<section className="ce-card">
					<div className="jo-card-h"><h3 className="ce-serif">Job order {jobOrder.joNo}</h3><small>{jobOrder.status}</small></div>
					<div className="jo-grid">
						<label><span className="ce-field-label">Ref. CE No.</span><div className="ce-input jo-ro ce-mono">{linked.join(", ") || ceLabel || "—"}</div></label>
						<label><span className="ce-field-label">Client</span><div className="ce-input jo-ro">{jobOrder.client || "—"}</div></label>
						<label className="jo-span"><span className="ce-field-label">Project description</span><div className="ce-input jo-ro">{jobOrder.project || "—"}</div></label>
						<label><span className="ce-field-label">Type of project</span><div className="ce-input jo-ro">{jobOrder.type || "—"}</div></label>
						<label><span className="ce-field-label">Client code</span><div className="ce-input jo-ro">{jobOrder.clientCode || "—"}</div></label>
					</div>
				</section>
				{open ? (
					<section className="ce-card">
						<div className="jo-card-h"><h3 className="ce-serif">Job order details</h3></div>
						<div className="jo-grid">
							{[
								["poRef", "PO reference no."],
								["prNo", "PR reference no."],
								["inCharge", "Project in-charge"],
								["inChargePosition", "Dept. / position"],
								["clientContact", "Client contact"],
								["clientContactPosition", "Contact position"],
								["duration", "Lead-time total"],
								["mobilization", "Date of mobilization"],
								["mobilizationNote", "Mobilization note"],
							].map(([key, label]) => (
								<label key={key}>
									<span className="ce-field-label">{label}</span>
									<input className="ce-input" defaultValue={jobOrder[key] || ""} onBlur={(event) => patch(key, event.target.value)} />
								</label>
							))}
							<label>
								<span className="ce-field-label">PO or NTP</span>
								<select className="ce-input" value={jobOrder.poKind || ""} onChange={(event) => patch("poKind", event.target.value)}>
									<option value="">Select</option>
									<option value="PO">PO</option>
									<option value="NTP">NTP</option>
								</select>
							</label>
							<label>
								<span className="ce-field-label">PO or NTP file</span>
								<input className="ce-input" type="file" onChange={(event) => { void storePoFile(event.target.files?.[0], jobOrder.id || "draft"); }} />
								<span className="wiz-hint">{jobOrder.poFileName || "No file yet"}{jobOrder.poStoragePath ? " · stored" : ""}{fileNote ? ` · ${fileNote}` : ""}</span>
							</label>
							<div className="jo-span">
								<span className="ce-field-label">Project lead time</span>
								<ul className="jo-lines">
									{storedLines.map((row, index) => (
										<li key={index}>
											<input className="ce-input" defaultValue={row.span || row.days || ""} onBlur={(event) => {
												const next = storedLines.map((item, i) => i === index ? { ...item, span: event.target.value } : item);
												onJobOrder?.("patch", { leadtime: next });
											}} />
											<input className="ce-input" defaultValue={row.text || ""} onBlur={(event) => {
												const next = storedLines.map((item, i) => i === index ? { ...item, text: event.target.value } : item);
												onJobOrder?.("patch", { leadtime: next });
											}} />
										</li>
									))}
								</ul>
								<button type="button" className="ce-btn-ghost ce-btn-sm" onClick={() => onJobOrder?.("patch", { leadtime: [...storedLines, { span: "", text: "" }] })}>Add lead-time line</button>
							</div>
							<label className="jo-toggle jo-span">
								<input type="checkbox" checked={jobOrder.annexA !== false} onChange={(event) => onJobOrder?.("patch", { annexA: event.target.checked })} />
								<span><b>Attach Annex A: Cost Estimate (prices hidden)</b></span>
							</label>
						</div>
					</section>
				) : <p className="wiz-hint">{jobOrder.poKind || "PO or NTP"} {jobOrder.poFileName || "—"} · In charge {jobOrder.inCharge || "—"}</p>}
				<section className="ce-card">
					<div className="jo-guide">
						<div className="jo-guide-title">JO REFERENCE NO. GUIDE</div>
						<div className="jo-chips">
							{captions.map((caption, index) => (
								<span key={caption} className="jo-seg">
									{index ? <i>–</i> : null}
									<b>{chips[index] || "—"}</b>
									<small>{caption}</small>
								</span>
							))}
						</div>
					</div>
					<p className="wiz-hint">Prepared by {name(jobOrder.salesRepId) || "—"} {jobOrder.salesPosition || ""} · Checked and approved by {name(jobOrder.approverId) || "—"} {jobOrder.approverFor || ""}</p>
					{holder ? <p className="wiz-hint">Waiting for {name(holder.userId)}{holder.backupUserId ? ` (backup ${name(holder.backupUserId)})` : ""}</p> : null}
					<div className="jo-actions">
						<button type="button" className="ce-btn-ghost ce-btn-sm" onClick={() => { void showPreview(jobOrder); }}>Preview PDF</button>
						<button type="button" className="ce-btn-ghost ce-btn-sm" onClick={async () => {
							const jo = { ...jobOrder, annexA: jobOrder.annexA !== false };
							if (buildPackPdf) {
								try {
									saveFile(await buildPackPdf(jo), `${jobOrder.joNo}.pdf`, "application/pdf");
									return;
								} catch (err) {
									setPreviewNote(err instanceof Error ? err.message : "Could not build the job order pack.");
								}
							}
						}}>SY3 PDF</button>
						<button type="button" className="ce-btn-ghost ce-btn-sm" onClick={() => saveFile(quantityAttachmentPdfBytes(jobOrder.ceQuantity), `${jobOrder.joNo}-quantities.pdf`, "application/pdf")}>Quantities PDF</button>
						{open && sales && actorId === jobOrder.ownerId ? (
							<button type="button" className="ce-btn-primary ce-btn-sm" onClick={() => onJobOrder?.("submit")}>Submit for Approval</button>
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
				</section>
			</div>
			{side(jobOrder, jobOrder.joNo)}
		</div>
	);
}

const LEGACY_TYPES = ["SW", "F", "T", "O"];

/**
 * @param {{ jobOrder: any, sales: boolean, actorId: string, users?: unknown[], ceOptions?: { id: string, label?: string }[], createDefaults?: any, canCreate?: boolean, canCancel?: boolean, onJobOrder?: (action: string, payload?: any) => void }} props
 */
function JobOrderPanelLegacy({ jobOrder, sales, actorId, users, ceOptions, createDefaults, canCreate, canCancel, onJobOrder }) {
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
							{LEGACY_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
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

export function JobOrderPanel(props) {
	if (props.joScreenV2 === true) return <JobOrderPanelV2 {...props} />;
	return <JobOrderPanelLegacy {...props} />;
}
