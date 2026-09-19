import { o as __toESM } from "../_runtime.mjs";
import { B as require_react, b as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as useCurrentUser } from "./use-current-user-Dv6i8RUO.mjs";
import { A as ChevronDown, C as CloudUpload, D as CircleAlert, E as CircleCheck, M as Calculator, N as Award, O as ChevronUp, P as Activity, S as Copy, T as ClipboardList, _ as Funnel, b as Download, c as Settings, d as Pencil, f as Paperclip, g as HardHat, h as LayoutDashboard, i as Upload, j as Check, k as ChevronRight, l as Search, m as Library, n as Wrench, o as Trash2, p as Package, r as Users, s as Shield, t as X, u as Plus, v as FolderPlus, w as Clock, x as Database, y as FileText } from "../_libs/lucide-react.mjs";
import { t as createClient } from "../_libs/supabase__supabase-js.mjs";
import { t as require_papaparse } from "../_libs/papaparse.mjs";
import { n as useEditor, t as EditorContent } from "../_libs/tiptap__react.mjs";
import { t as StarterKit } from "../_libs/tiptap__starter-kit.mjs";
import { t as Underline } from "../_libs/tiptap__extension-underline.mjs";
import { n as TextStyle, t as Color } from "../_libs/@tiptap/extension-color+[...].mjs";
import { t as Highlight } from "../_libs/tiptap__extension-highlight.mjs";
import { t as require_jspdf_node_min } from "../_libs/jspdf.mjs";
import { t as autoTable } from "../_libs/jspdf-autotable.mjs";
import { n as writeFileSync, t as utils } from "../_libs/xlsx.mjs";
import { n as StandardFonts, r as rgb, t as PDFDocument } from "../_libs/pdf-lib.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-B0xeIcyq.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var import_papaparse = /* @__PURE__ */ __toESM(require_papaparse());
var import_jspdf_node_min = /* @__PURE__ */ __toESM(require_jspdf_node_min());
function emptyMasterlist() {
	return {
		manpower: [],
		equipment: [],
		consumables: [],
		ppe: [],
		misc: [],
		clients: [],
		customCategories: []
	};
}
function defaultWorkspace() {
	return {
		ceList: [
			{
				id: "CE-2025-001",
				client: "ABC Corp",
				status: "Ongoing",
				project: "Turbine Overhaul",
				lastEdited: "2025-01-25",
				lastEditedBy: "Estimator A"
			},
			{
				id: "CE-2025-002",
				client: "XYZ Ltd",
				status: "Pending",
				project: "Piping Fabrication",
				lastEdited: "2025-01-20",
				lastEditedBy: "Estimator B"
			},
			{
				id: "CE-2025-003",
				client: "DEF Inc",
				status: "Done",
				project: "Electrical Upgrade",
				lastEdited: "2025-01-18",
				lastEditedBy: "Estimator A"
			}
		],
		rceList: [{
			id: "RCE-2025-001",
			client: "ABC Corp",
			location: "Bataan",
			description: "Turbine overhaul",
			category: "Onsite",
			status: "Pending",
			attachments: ["Site_Photos.zip", "Scope.pdf"],
			dateReceived: "2025-02-01"
		}, {
			id: "RCE-2025-002",
			client: "XYZ Ltd",
			location: "Laguna",
			description: "Piping fabrication",
			category: "Shop",
			status: "In Review",
			attachments: ["Drawings.pdf"],
			dateReceived: "2025-02-05"
		}],
		masterlist: emptyMasterlist(),
		documents: {},
		schemaConfig: {}
	};
}
function parseJson(value, fallback) {
	if (value == null) return fallback;
	if (typeof value === "string") try {
		return JSON.parse(value);
	} catch {
		return fallback;
	}
	if (typeof value === "object") return value;
	return fallback;
}
function jsonSafe(value) {
	return JSON.parse(JSON.stringify(value, (_key, inner) => {
		if (typeof inner === "bigint") return Number(inner);
		if (typeof File !== "undefined" && inner instanceof File) return {
			name: inner.name,
			size: inner.size,
			type: inner.type
		};
		return inner;
	}));
}
var supabase = createClient("https://rgppzzwitldwbfkgezoz.supabase.co", "sb_publishable_HVw6j79YziCzJfYOheC27g_nTPZz0Jd", { auth: {
	persistSession: false,
	autoRefreshToken: false
} });
var COMPANY_WORKSPACE_ID = "company";
function asRecord(value) {
	return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function asText(value) {
	if (value == null) return null;
	const text = String(value);
	return text.length ? text : null;
}
function asNumber(value) {
	if (value == null || value === "") return null;
	const n = Number(value);
	return Number.isFinite(n) ? n : null;
}
function rowToWorkspace(row) {
	const fallback = defaultWorkspace();
	if (!row) return fallback;
	const masterlist = parseJson(row.masterlist, emptyMasterlist());
	return {
		ceList: parseJson(row.ce_list, fallback.ceList),
		rceList: parseJson(row.rce_list, fallback.rceList),
		masterlist: {
			...emptyMasterlist(),
			...masterlist
		},
		documents: parseJson(row.documents, {}),
		schemaConfig: parseJson(row.schema_config, {})
	};
}
async function loadWorkspaceFromSupabase() {
	const { data, error } = await supabase.from("estimator_workspace").select("ce_list, rce_list, masterlist, documents, schema_config").eq("user_id", COMPANY_WORKSPACE_ID).maybeSingle();
	if (error) throw error;
	return rowToWorkspace(data ?? null);
}
async function saveWorkspaceToSupabase(payload) {
	const data = jsonSafe(payload);
	const { error } = await supabase.from("estimator_workspace").upsert({
		user_id: COMPANY_WORKSPACE_ID,
		ce_list: data.ceList,
		rce_list: data.rceList,
		masterlist: data.masterlist,
		documents: data.documents,
		schema_config: data.schemaConfig,
		updated_at: (/* @__PURE__ */ new Date()).toISOString()
	}, { onConflict: "user_id" });
	if (error) throw error;
	await syncNormalizedTables(data).catch(() => void 0);
}
async function syncNormalizedTables(data) {
	await syncClients(data.masterlist.clients);
	await syncMasterlist(data.masterlist);
	await syncRces(data.rceList);
	const rceIds = new Set(data.rceList.map((rce) => rce.id).filter((id) => Boolean(id)));
	await syncEstimates(data.ceList, data.documents, rceIds);
	await supabase.from("app_settings").upsert({
		key: "db_schema_config",
		value: data.schemaConfig ?? {},
		updated_at: (/* @__PURE__ */ new Date()).toISOString()
	}, { onConflict: "key" });
}
async function syncClients(clients) {
	if (!clients.length) return;
	const rows = clients.map((raw) => {
		const item = asRecord(raw);
		return {
			id: String(item.id || crypto.randomUUID()),
			client_code: asText(item.clientCode),
			full_name: String(item.fullName || ""),
			address: asText(item.address),
			extra: item
		};
	});
	await supabase.from("clients").upsert(rows, { onConflict: "id" });
}
async function syncMasterlist(masterlist) {
	const custom = Array.isArray(masterlist.customCategories) ? masterlist.customCategories : [];
	if (custom.length) await supabase.from("masterlist_categories").upsert(custom.map((raw, index) => {
		const cat = asRecord(raw);
		const key = String(cat.categoryKey || cat.id || `custom-${index}`);
		return {
			id: String(cat.id || key),
			category_key: key,
			category_name: String(cat.categoryName || key),
			is_fixed: false,
			sort_order: 100 + index
		};
	}), { onConflict: "id" });
	const groups = [
		["manpower", masterlist.manpower],
		["equipment", masterlist.equipment],
		["consumables", masterlist.consumables],
		["ppe", masterlist.ppe],
		["misc", masterlist.misc]
	];
	for (const cat of custom) {
		const record = asRecord(cat);
		const key = String(record.categoryKey || "");
		if (!key) continue;
		groups.push([key, Array.isArray(record.items) ? record.items : []]);
	}
	const rows = groups.flatMap(([categoryKey, items]) => (items || []).map((raw) => {
		const item = asRecord(raw);
		return {
			id: String(item.id || crypto.randomUUID()),
			category_key: categoryKey,
			name: asText(item.name),
			role: asText(item.role),
			description: asText(item.description),
			item: asText(item.item),
			unit: asText(item.unit),
			daily_rate: asNumber(item.dailyRate),
			monthly_rate: asNumber(item.monthlyRate),
			rate_per_day: asNumber(item.ratePerDay),
			unit_cost: asNumber(item.unitCost),
			estimated_cost: asNumber(item.estimatedCost),
			per_diem: asNumber(item.perDiem),
			allowance: asNumber(item.allowance),
			attrs: item
		};
	}));
	if (rows.length) await supabase.from("masterlist_items").upsert(rows, { onConflict: "id" });
}
async function syncRces(list) {
	if (!list.length) return;
	const rows = list.map((raw) => {
		const rce = asRecord(raw);
		const id = String(rce.id || rce.rceNo || crypto.randomUUID());
		return {
			id,
			company_name: asText(rce.company),
			client: asText(rce.client || rce.customer),
			customer: asText(rce.customer),
			address: asText(rce.address),
			location: asText(rce.location),
			description: asText(rce.description || rce.projectTitle),
			category: asText(rce.category),
			project_type: asText(rce.projectType),
			project_title: asText(rce.projectTitle || rce.description),
			inquiry_number: asText(rce.inquiryNumber),
			inquiry_date: asText(rce.inquiryDate),
			rce_no: asText(rce.rceNo || id),
			rce_date: asText(rce.rceDate),
			priority_level: asText(rce.priorityLevel),
			ce_deadline: asText(rce.ceDeadline),
			submission_deadline: asText(rce.submissionDeadline),
			shopwork: Boolean(rce.shopwork),
			onsite: Boolean(rce.onsite),
			trading: Boolean(rce.trading),
			mechanical: Boolean(rce.mechanical),
			electrical: Boolean(rce.electrical),
			other_remarks: asText(rce.otherRemarks),
			decline_reason: asText(rce.declineReason),
			prepared_by: asText(rce.preparedBy),
			reviewed_by: asText(rce.reviewedBy),
			approved_by: asText(rce.approvedBy),
			status: String(rce.status || "Pending"),
			date_received: asText(rce.dateReceived || rce.rceDate),
			payload: rce
		};
	});
	await supabase.from("rce_requests").upsert(rows, { onConflict: "id" });
}
async function syncEstimates(list, documents, rceIds) {
	if (!list.length) return;
	const estimates = list.map((ce) => ({
		id: ce.id,
		rce_id: ce.rceId && rceIds.has(ce.rceId) ? ce.rceId : null,
		client: ce.client || null,
		location: ce.location || null,
		project: ce.project || null,
		status: ce.status || "Draft",
		last_edited: ce.lastEdited || null,
		last_edited_by: ce.lastEditedBy || null
	}));
	await supabase.from("cost_estimates").upsert(estimates, { onConflict: "id" });
	const docs = Object.entries(documents || {}).map(([ceId, raw]) => {
		const doc = asRecord(raw);
		return {
			ce_id: ceId,
			meta: doc.meta ?? {},
			sow_text: String(doc.sowText || ""),
			ce_status: asText(doc.ceStatus || doc.status),
			view_type: asText(doc.viewType),
			doc_no: asText(doc.docNo),
			rev_no: asText(doc.revNo),
			rev_date: asText(doc.revDate),
			file_attachments: doc.fileAttachments ?? {},
			summary_task_filters: doc.summaryTaskFilters ?? {},
			document: doc
		};
	});
	if (docs.length) await supabase.from("ce_documents").upsert(docs, { onConflict: "ce_id" });
}
function interpolateDocTokens$1(template, vars) {
	return String(template ?? "").replace(/\{(\w+)\}/g, (_, key) => {
		const value = vars[key];
		return value == null ? "" : String(value);
	});
}
function docVars(data, page) {
	const dc = data.documentControl || {};
	return {
		company: dc.companyName || "",
		rev: data.docRevision || dc.revision || "",
		date: data.docDate || "",
		docNo: data.ceNumber || "",
		page: page == null ? "" : String(page)
	};
}
function resolvedLetterhead(data, page) {
	const dc = data.documentControl || {};
	const vars = docVars(data, page);
	return {
		dc,
		vars,
		headerLeft: interpolateDocTokens$1(dc.headerLeft || "{company}", vars),
		headerRight: interpolateDocTokens$1(dc.headerRight || "Rev {rev}  |  {date}  |  {docNo}", vars),
		footerLeft: interpolateDocTokens$1(dc.footerLeft || "Controlled document", vars),
		footerCenter: interpolateDocTokens$1(dc.footerCenter || "Page {page}", vars),
		footerRight: interpolateDocTokens$1(dc.footerRight || "{company}", vars)
	};
}
function logoFormat(dataUrl) {
	if (!dataUrl) return "PNG";
	if (dataUrl.includes("image/jpeg") || dataUrl.includes("image/jpg")) return "JPEG";
	if (dataUrl.includes("image/webp")) return "WEBP";
	return "PNG";
}
var drawHeaderFooter = (doc, data) => {
	const pageWidth = doc.internal.pageSize.getWidth();
	const pageHeight = doc.internal.pageSize.getHeight();
	const pageNumber = doc.internal.getCurrentPageInfo?.().pageNumber || doc.internal.getNumberOfPages();
	const { dc, headerLeft, headerRight, footerLeft, footerCenter, footerRight } = resolvedLetterhead(data, pageNumber);
	const logo = dc.showLogo !== false ? data.companyLogo || dc.logoDataUrl : "";
	if (logo) try {
		doc.addImage(logo, logoFormat(logo), 12, 8, 18, 18);
	} catch {
		doc.setFontSize(10);
		doc.text(headerLeft || "LOGO", 12, 18);
	}
	else {
		doc.setFontSize(10);
		doc.setFont(void 0, "bold");
		doc.text(headerLeft || "LOGO", 12, 18);
		doc.setFont(void 0, "normal");
	}
	doc.setFontSize(9);
	String(headerRight || "").split("|").map((s) => s.trim()).forEach((line, i) => {
		doc.text(line, pageWidth - 12, 12 + i * 5, { align: "right" });
	});
	doc.setFontSize(8);
	doc.text(footerLeft || "", 12, pageHeight - 8);
	doc.text(footerCenter || `Page ${pageNumber}`, pageWidth / 2, pageHeight - 8, { align: "center" });
	doc.text(footerRight || "", pageWidth - 12, pageHeight - 8, { align: "right" });
};
function exportToPDF(data) {
	const { ceNumber, sections } = data;
	const doc = new import_jspdf_node_min.default({
		orientation: "portrait",
		unit: "mm",
		format: "a4"
	});
	const margin = 12;
	let currentOrientation = "portrait";
	sections.forEach((section, index) => {
		if (section.isTaskBreakdown && currentOrientation === "portrait") {
			doc.addPage("a4", "landscape");
			currentOrientation = "landscape";
		} else if (index > 0) doc.addPage(currentOrientation === "landscape" ? "a4" : "a4", currentOrientation);
		autoTable(doc, {
			head: [section.columns],
			body: section.rows,
			startY: 26,
			margin: {
				top: 26,
				bottom: 18,
				left: margin,
				right: margin
			},
			styles: {
				lineColor: [
					0,
					0,
					0
				],
				lineWidth: .1,
				cellPadding: 1.5,
				fontSize: 9,
				valign: "middle",
				halign: "center"
			},
			headStyles: {
				fillColor: [
					240,
					240,
					240
				],
				textColor: [
					0,
					0,
					0
				],
				fontStyle: "bold",
				lineWidth: .1
			},
			bodyStyles: { lineWidth: .1 },
			didDrawPage: () => {
				drawHeaderFooter(doc, data);
			}
		});
	});
	doc.save(`Cost_Estimate_${ceNumber || "export"}.pdf`);
}
function exportToExcel(data) {
	const { sections, ceNumber } = data;
	const letter = resolvedLetterhead(data, "&P");
	const wb = utils.book_new();
	sections.forEach((section) => {
		const pad = Math.max(0, section.columns.length - 3);
		const headerRow = [
			letter.headerLeft,
			...Array(pad).fill(""),
			letter.headerRight
		];
		const footerRow = [
			letter.footerLeft,
			letter.footerCenter,
			...Array(Math.max(0, section.columns.length - 3)).fill(""),
			letter.footerRight
		];
		const wsData = [
			headerRow,
			[],
			section.columns,
			...section.rows,
			[],
			footerRow
		];
		const ws = utils.aoa_to_sheet(wsData);
		ws["!cols"] = section.columns.map((col, i) => ({ wch: Math.max(col.length, ...section.rows.map((row) => row[i] ? String(row[i]).length : 0)) + 2 }));
		if (!ws["!print"]) ws["!print"] = {};
		ws["!print"].header = `&L${letter.headerLeft}&R${letter.headerRight}`;
		ws["!print"].footer = `&L${letter.footerLeft}&C${letter.footerCenter}&R${letter.footerRight}`;
		ws["!print"].margins = {
			left: .5,
			right: .5,
			top: .5,
			bottom: .5,
			header: .2,
			footer: .2
		};
		utils.book_append_sheet(wb, ws, section.title.slice(0, 31));
	});
	writeFileSync(wb, `Cost_Estimate_${ceNumber || "export"}.xlsx`);
}
function dataUrlToBytes(dataUrl) {
	const parts = String(dataUrl || "").split(",");
	const base64 = parts.length > 1 ? parts[1] : parts[0];
	const bin = atob(base64);
	const bytes = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
	return bytes;
}
function isPdf(file) {
	return String(file.type || "").includes("pdf") || /\.pdf$/i.test(file.name || "");
}
function isImage(file) {
	return String(file.type || "").startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp)$/i.test(file.name || "");
}
async function imageToPngBytes(file) {
	const bytes = dataUrlToBytes(file.dataUrl);
	const type = String(file.type || "").toLowerCase();
	const name = String(file.name || "").toLowerCase();
	if (type.includes("png") || name.endsWith(".png")) return {
		kind: "png",
		bytes
	};
	if (type.includes("jpeg") || type.includes("jpg") || name.endsWith(".jpg") || name.endsWith(".jpeg")) return {
		kind: "jpg",
		bytes
	};
	const blob = await fetch(file.dataUrl).then((r) => r.blob());
	const bmp = await createImageBitmap(blob);
	const canvas = document.createElement("canvas");
	canvas.width = bmp.width;
	canvas.height = bmp.height;
	canvas.getContext("2d").drawImage(bmp, 0, 0);
	return {
		kind: "png",
		bytes: dataUrlToBytes(canvas.toDataURL("image/png"))
	};
}
async function addCoverPage(pdf, font, files, title) {
	const page = pdf.addPage([595, 842]);
	const { height } = page.getSize();
	page.drawText(title || "Compiled Attachments", {
		x: 48,
		y: height - 64,
		size: 18,
		font,
		color: rgb(.1, .1, .08)
	});
	page.drawText(`${files.length} file${files.length === 1 ? "" : "s"} combined`, {
		x: 48,
		y: height - 86,
		size: 10,
		font,
		color: rgb(.35, .34, .3)
	});
	let y = height - 120;
	files.forEach((file, i) => {
		if (y < 48) return;
		page.drawText(`${i + 1}. ${file.name}  —  ${file.sourceLabel || "Attachment"}`, {
			x: 48,
			y,
			size: 9,
			font,
			color: rgb(.15, .14, .1)
		});
		y -= 16;
	});
}
async function addNotePage(pdf, font, file) {
	const page = pdf.addPage([595, 842]);
	const { height } = page.getSize();
	page.drawText("File included by reference", {
		x: 48,
		y: height - 64,
		size: 14,
		font,
		color: rgb(.1, .1, .08)
	});
	page.drawText(file.name || "Untitled", {
		x: 48,
		y: height - 90,
		size: 12,
		font,
		color: rgb(.2, .2, .16)
	});
	page.drawText(file.sourceLabel || "", {
		x: 48,
		y: height - 110,
		size: 10,
		font,
		color: rgb(.4, .38, .32)
	});
	page.drawText("This file type cannot be drawn into the compiled PDF. Keep the original on the ATTCH sheet.", {
		x: 48,
		y: height - 140,
		size: 9,
		font,
		color: rgb(.4, .38, .32)
	});
}
async function compileAttachmentsToPdf(files, title = "Compiled Attachments") {
	const pdf = await PDFDocument.create();
	const font = await pdf.embedFont(StandardFonts.Helvetica);
	await addCoverPage(pdf, font, files, title);
	for (const file of files) {
		if (!file?.dataUrl) {
			await addNotePage(pdf, font, file);
			continue;
		}
		try {
			if (isPdf(file)) {
				const src = await PDFDocument.load(dataUrlToBytes(file.dataUrl), { ignoreEncryption: true });
				(await pdf.copyPages(src, src.getPageIndices())).forEach((p) => pdf.addPage(p));
				continue;
			}
			if (isImage(file)) {
				const img = await imageToPngBytes(file);
				const embedded = img.kind === "jpg" ? await pdf.embedJpg(img.bytes) : await pdf.embedPng(img.bytes);
				const page = pdf.addPage([595, 842]);
				const { width, height } = page.getSize();
				const maxW = width - 72;
				const maxH = height - 96;
				const scale = Math.min(maxW / embedded.width, maxH / embedded.height, 1);
				const w = embedded.width * scale;
				const h = embedded.height * scale;
				page.drawText(file.name || "Image", {
					x: 36,
					y: height - 36,
					size: 9,
					font,
					color: rgb(.35, .34, .3)
				});
				page.drawImage(embedded, {
					x: (width - w) / 2,
					y: (height - h) / 2 - 8,
					width: w,
					height: h
				});
				continue;
			}
			await addNotePage(pdf, font, file);
		} catch {
			await addNotePage(pdf, font, file);
		}
	}
	const bytes = await pdf.save();
	const blob = new Blob([bytes], { type: "application/pdf" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	const slug = String(title || "attachments").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
	a.href = url;
	a.download = `${slug || "compiled-attachments"}.pdf`;
	document.body.appendChild(a);
	a.click();
	a.remove();
	window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
var STANDARD_TEMPLATES = [
	{
		id: "onsite",
		title: "Onsite",
		description: "Site-based cost estimate structure (current working template).",
		enabled: true
	},
	{
		id: "shopwork",
		title: "Shopwork",
		description: "Workshop / fabrication oriented breakdown.",
		enabled: true
	},
	{
		id: "trading",
		title: "Trading",
		description: "Trading / supply-only cost model.",
		enabled: true
	},
	{
		id: "hybrid",
		title: "Hybrid",
		description: "Combination of onsite, shopwork, and trading — coming later.",
		enabled: false
	}
];
var PREBUILT_TEMPLATES = [
	{
		id: "pre-onsite",
		title: "Standard Onsite (with resources)",
		description: "Onsite structure preloaded with typical labor, tools, and PPE.",
		standardId: "onsite"
	},
	{
		id: "pre-shop",
		title: "Shop (with resources)",
		description: "Shopwork structure with common fabrication resources.",
		standardId: "shopwork"
	},
	{
		id: "pre-trading",
		title: "Trading (with resources)",
		description: "Trading structure with typical supply items.",
		standardId: "trading"
	}
];
function rceLabel(rce) {
	return rce?.id || rce?.rceNo || "";
}
function rceProject(rce) {
	return rce?.projectTitle || rce?.project || rce?.description || "";
}
function rceClient(rce) {
	return rce?.client || rce?.customer || "";
}
function NewCostEstimateWizard({ rceList = [], ceList = [], initialRce = null, currentUserName, onCancel, onCreate }) {
	const [step, setStep] = (0, import_react.useState)(initialRce ? 2 : 1);
	const [rceMode, setRceMode] = (0, import_react.useState)(initialRce ? "existing" : "existing");
	const [form, setForm] = (0, import_react.useState)(() => {
		const rce = initialRce;
		return {
			rceId: rceLabel(rce),
			client: rceClient(rce),
			project: rceProject(rce),
			location: rce?.location || rce?.address || "",
			description: rce?.otherRemarks || rce?.description || ""
		};
	});
	const [templateKind, setTemplateKind] = (0, import_react.useState)("standard");
	const [standardId, setStandardId] = (0, import_react.useState)("onsite");
	const [prebuiltId, setPrebuiltId] = (0, import_react.useState)("pre-onsite");
	const [previousCeId, setPreviousCeId] = (0, import_react.useState)("");
	const selectedRce = (rceList || []).find((r) => rceLabel(r) === form.rceId);
	function applyRce(rce) {
		setForm((prev) => ({
			...prev,
			rceId: rceLabel(rce),
			client: rceClient(rce),
			project: rceProject(rce),
			location: rce?.location || rce?.address || prev.location,
			description: rce?.otherRemarks || rce?.description || prev.description
		}));
	}
	function handleCreate() {
		const tpl = templateKind === "prebuilt" ? PREBUILT_TEMPLATES.find((t) => t.id === prebuiltId) : STANDARD_TEMPLATES.find((t) => t.id === standardId);
		const templateType = templateKind === "previous" ? "onsite" : tpl?.standardId || tpl?.id || "onsite";
		if (templateType === "hybrid") return;
		onCreate({
			rceId: form.rceId.trim(),
			client: form.client.trim(),
			project: form.project.trim() || "New Cost Estimate",
			location: form.location.trim(),
			description: form.description.trim(),
			templateKind,
			templateType,
			templateId: templateKind === "previous" ? previousCeId : templateKind === "prebuilt" ? prebuiltId : standardId,
			sourceCeId: templateKind === "previous" ? previousCeId : null,
			assignedTo: currentUserName || "Estimator A"
		});
	}
	const previousCEs = (ceList || []).filter((ce) => ce.status === "Done" || ce.status === "Awarded" || ce.archived === true);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "wiz-wrap",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "wiz-header",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "ce-serif",
					children: "New Cost Estimate"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "wiz-sub",
					children: step === 1 ? "Link an RCE or enter project details, then choose a template." : "Choose the standard, pre-built, or previous CE template."
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "wiz-steps",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: step === 1 ? "wiz-step-on" : "",
							children: "1. Details"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: step === 2 ? "wiz-step-on" : "",
							children: "2. Template"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "3. Fill CE" })
					]
				})]
			}),
			step === 1 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "ce-card wiz-card",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
						className: "ce-field-label",
						children: "RCE source"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "wiz-rce-mode",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: `ce-pill ${rceMode === "existing" ? "ce-pill-active" : ""}`,
							onClick: () => setRceMode("existing"),
							children: "From RCE monitoring"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: `ce-pill ${rceMode === "manual" ? "ce-pill-active" : ""}`,
							onClick: () => setRceMode("manual"),
							children: "Manual RCE #"
						})]
					}),
					rceMode === "existing" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "wiz-field",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "ce-field-label",
							children: "RCE #"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
							className: "ce-input",
							value: form.rceId,
							onChange: (e) => {
								const next = (rceList || []).find((r) => rceLabel(r) === e.target.value);
								if (next) applyRce(next);
								else setForm({
									...form,
									rceId: e.target.value
								});
							},
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "",
								children: "Select an RCE…"
							}), (rceList || []).map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
								value: rceLabel(r),
								children: [
									rceLabel(r),
									" — ",
									rceClient(r) || "No client",
									" /",
									" ",
									rceProject(r) || "No project"
								]
							}, rceLabel(r)))]
						})]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "wiz-field",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "ce-field-label",
							children: "RCE # (manual)"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							className: "ce-input",
							value: form.rceId,
							onChange: (e) => setForm({
								...form,
								rceId: e.target.value
							}),
							placeholder: "RCE-2026-001"
						})]
					}),
					selectedRce && rceMode === "existing" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "wiz-hint",
						children: [
							"Linked to ",
							rceLabel(selectedRce),
							". Client, project, and location were filled from the RCE — edit if needed."
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "wiz-grid",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "wiz-field",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "ce-field-label",
									children: "Client"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									className: "ce-input",
									value: form.client,
									onChange: (e) => setForm({
										...form,
										client: e.target.value
									})
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "wiz-field",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "ce-field-label",
									children: "Location"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									className: "ce-input",
									value: form.location,
									onChange: (e) => setForm({
										...form,
										location: e.target.value
									})
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "wiz-field wiz-span",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "ce-field-label",
									children: "Project description"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									className: "ce-input",
									value: form.project,
									onChange: (e) => setForm({
										...form,
										project: e.target.value
									})
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "wiz-field wiz-span",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "ce-field-label",
									children: "Notes / other remarks"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
									className: "ce-input ce-notes-box",
									rows: 3,
									value: form.description,
									onChange: (e) => setForm({
										...form,
										description: e.target.value
									})
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "wiz-actions",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "ce-btn-ghost",
							onClick: onCancel,
							children: "Cancel"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "ce-btn-primary",
							onClick: () => setStep(2),
							children: "Next — choose template"
						})]
					})
				]
			}),
			step === 2 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "ce-card wiz-card",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "wiz-rce-mode",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: `ce-pill ${templateKind === "standard" ? "ce-pill-active" : ""}`,
								onClick: () => setTemplateKind("standard"),
								children: "Standard"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: `ce-pill ${templateKind === "prebuilt" ? "ce-pill-active" : ""}`,
								onClick: () => setTemplateKind("prebuilt"),
								children: "Pre-built"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: `ce-pill ${templateKind === "previous" ? "ce-pill-active" : ""}`,
								onClick: () => setTemplateKind("previous"),
								children: "Previous CE"
							})
						]
					}),
					templateKind === "standard" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "wiz-tpl-grid",
						children: STANDARD_TEMPLATES.map((tpl) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							className: "wiz-tpl" + (standardId === tpl.id ? " wiz-tpl-on" : "") + (!tpl.enabled ? " wiz-tpl-off" : ""),
							disabled: !tpl.enabled,
							onClick: () => tpl.enabled && setStandardId(tpl.id),
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: tpl.title }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: tpl.description }),
								!tpl.enabled && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("em", { children: "Not functional yet" })
							]
						}, tpl.id))
					}),
					templateKind === "prebuilt" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "wiz-tpl-grid",
						children: PREBUILT_TEMPLATES.map((tpl) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							className: "wiz-tpl" + (prebuiltId === tpl.id ? " wiz-tpl-on" : ""),
							onClick: () => setPrebuiltId(tpl.id),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: tpl.title }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: tpl.description })]
						}, tpl.id))
					}),
					templateKind === "previous" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: previousCEs.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "wiz-hint",
						children: "No completed CEs yet. Finish a CE or pick a Standard template."
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "wiz-tpl-grid",
						children: previousCEs.map((ce) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							className: "wiz-tpl" + (previousCeId === ce.id ? " wiz-tpl-on" : ""),
							onClick: () => setPreviousCeId(ce.id),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: ce.id }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
								ce.client || "—",
								" · ",
								ce.project || "—"
							] })]
						}, ce.id))
					}) }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "wiz-actions",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "ce-btn-ghost",
							onClick: () => initialRce ? onCancel() : setStep(1),
							children: "Back"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "ce-btn-primary",
							disabled: templateKind === "previous" && !previousCeId,
							onClick: handleCreate,
							children: "Create and open editor"
						})]
					})
				]
			})
		]
	});
}
function emptyOif() {
	return {
		id: "",
		oifNo: "",
		date: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
		projectDescription: "",
		rfqNo: "",
		customerName: "",
		customerRep: "",
		onsiteInspector: "",
		contactNo: "",
		photos: [],
		activity: {
			onsite: false,
			shopwork: false,
			supplyOnly: false
		},
		serviceType: {
			repair: false,
			electrical: false,
			thermalSpray: false,
			civilWorks: false,
			ndt: false,
			protectiveCoating: false,
			fabrication: false,
			balancing: false,
			others: false,
			mechanical: false,
			sandblasting: false,
			othersText: ""
		},
		quantity: "",
		length: "",
		width: "",
		thk: "",
		outsideDia: "",
		insideDia: "",
		dimLength: "",
		weightTons: false,
		weightKg: false,
		weightValue: "",
		drawingAvailable: "",
		duration: "",
		manpower: [
			{
				id: "m1",
				designation: "",
				pax: ""
			},
			{
				id: "m2",
				designation: "",
				pax: ""
			},
			{
				id: "m3",
				designation: "",
				pax: ""
			},
			{
				id: "m4",
				designation: "",
				pax: ""
			}
		],
		scopeLeft: "",
		scopeRight: "",
		materialsLeft: "",
		materialsRight: ""
	};
}
function InspectionFormView({ initial, onBack, onSave }) {
	const [form, setForm] = (0, import_react.useState)(() => ({
		...emptyOif(),
		...initial || {}
	}));
	const photoRef = (0, import_react.useRef)(null);
	function patch(partial) {
		setForm((prev) => ({
			...prev,
			...partial
		}));
	}
	async function addPhotos(e) {
		const files = Array.from(e.target.files || []);
		e.target.value = "";
		const records = await Promise.all(files.map((file) => new Promise((resolve) => {
			const reader = new FileReader();
			reader.onload = () => resolve({
				id: `ph-${Date.now()}-${Math.random().toString(16).slice(2)}`,
				name: file.name,
				type: file.type,
				dataUrl: String(reader.result || "")
			});
			reader.readAsDataURL(file);
		})));
		patch({ photos: [...form.photos || [], ...records] });
	}
	function updateManpower(id, field, value) {
		patch({ manpower: form.manpower.map((row) => row.id === id ? {
			...row,
			[field]: value
		} : row) });
	}
	function addManpower() {
		patch({ manpower: [...form.manpower, {
			id: `m-${Date.now()}`,
			designation: "",
			pax: ""
		}] });
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "oif-wrap",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "dash-header",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "ce-serif",
				children: "Onsite Inspection Form"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				style: {
					display: "flex",
					gap: "0.5rem"
				},
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "ce-btn-ghost",
					onClick: onBack,
					children: "Back"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "ce-btn-primary",
					onClick: () => onSave(form),
					children: "Save report"
				})]
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "oif-sheet",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "oif-title",
					children: "ONSITE INSPECTION FORM"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "oif-headgrid",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: ["DATE", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							className: "ce-input",
							type: "date",
							value: form.date,
							onChange: (e) => patch({ date: e.target.value })
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: ["OIF NO.", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							className: "ce-input",
							value: form.oifNo,
							onChange: (e) => patch({ oifNo: e.target.value })
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "oif-span2",
							children: ["PROJECT DESCRIPTION", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								className: "ce-input",
								value: form.projectDescription,
								onChange: (e) => patch({ projectDescription: e.target.value })
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: ["RFQ NO.", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							className: "ce-input",
							value: form.rfqNo,
							onChange: (e) => patch({ rfqNo: e.target.value })
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: ["CUSTOMER NAME", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							className: "ce-input",
							value: form.customerName,
							onChange: (e) => patch({ customerName: e.target.value })
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: ["CUSTOMER REPRESENTATIVE", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							className: "ce-input",
							value: form.customerRep,
							onChange: (e) => patch({ customerRep: e.target.value })
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: ["ONSITE INSPECTOR", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							className: "ce-input",
							value: form.onsiteInspector,
							onChange: (e) => patch({ onsiteInspector: e.target.value })
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: ["CONTACT NO.", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							className: "ce-input",
							value: form.contactNo,
							onChange: (e) => patch({ contactNo: e.target.value })
						})] })
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "oif-banner",
					children: "A. PHOTOS"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "oif-photos",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "ce-btn-ghost ce-btn-sm",
							onClick: () => photoRef.current?.click(),
							children: "Upload photos"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							ref: photoRef,
							type: "file",
							accept: "image/*",
							multiple: true,
							hidden: true,
							onChange: addPhotos
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "oif-photo-grid",
							children: (form.photos || []).map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "oif-photo",
								children: [p.dataUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
									src: p.dataUrl,
									alt: p.name
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: p.name }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => patch({ photos: form.photos.filter((x) => x.id !== p.id) }),
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { size: 12 })
								})]
							}, p.id))
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "oif-split",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "oif-banner",
						children: "B. SCOPE OF WORK"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "oif-block",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "ce-field-label",
								children: "Activity"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "oif-checks",
								children: [
									"onsite",
									"shopwork",
									"supplyOnly"
								].map((k) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "oif-check",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "checkbox",
										checked: !!form.activity[k],
										onChange: () => patch({ activity: {
											...form.activity,
											[k]: !form.activity[k]
										} })
									}), k === "supplyOnly" ? "Supply only" : k[0].toUpperCase() + k.slice(1)]
								}, k))
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "ce-field-label",
								children: "Service type"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "oif-checks oif-checks-grid",
								children: [
									["repair", "Repair"],
									["electrical", "Electrical"],
									["thermalSpray", "Thermal spray"],
									["civilWorks", "Civil works"],
									["ndt", "NDT"],
									["protectiveCoating", "Protective coating"],
									["fabrication", "Fabrication"],
									["balancing", "Balancing"],
									["mechanical", "Mechanical"],
									["sandblasting", "Sandblasting"],
									["others", "Others"]
								].map(([k, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "oif-check",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "checkbox",
										checked: !!form.serviceType[k],
										onChange: () => patch({ serviceType: {
											...form.serviceType,
											[k]: !form.serviceType[k]
										} })
									}), label]
								}, k))
							}),
							form.serviceType.others && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								className: "ce-input",
								placeholder: "Others…",
								value: form.serviceType.othersText,
								onChange: (e) => patch({ serviceType: {
									...form.serviceType,
									othersText: e.target.value
								} })
							})
						]
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "oif-banner",
						children: "C. WORKPIECE MEASUREMENTS"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "oif-block oif-meas",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: ["A. Quantity", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								className: "ce-input",
								value: form.quantity,
								onChange: (e) => patch({ quantity: e.target.value })
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "ce-field-label",
								children: "B. General dimensions"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "oif-meas-row",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										className: "ce-input",
										placeholder: "Length",
										value: form.length,
										onChange: (e) => patch({ length: e.target.value })
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										className: "ce-input",
										placeholder: "Width",
										value: form.width,
										onChange: (e) => patch({ width: e.target.value })
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										className: "ce-input",
										placeholder: "Thk",
										value: form.thk,
										onChange: (e) => patch({ thk: e.target.value })
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "oif-meas-row",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										className: "ce-input",
										placeholder: "Outside Ø",
										value: form.outsideDia,
										onChange: (e) => patch({ outsideDia: e.target.value })
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										className: "ce-input",
										placeholder: "Inside Ø",
										value: form.insideDia,
										onChange: (e) => patch({ insideDia: e.target.value })
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										className: "ce-input",
										placeholder: "Length",
										value: form.dimLength,
										onChange: (e) => patch({ dimLength: e.target.value })
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "ce-field-label",
								children: "C. Estimated weight"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "oif-checks",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
										className: "oif-check",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "checkbox",
											checked: form.weightTons,
											onChange: () => patch({ weightTons: !form.weightTons })
										}), "Tons"]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
										className: "oif-check",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "checkbox",
											checked: form.weightKg,
											onChange: () => patch({ weightKg: !form.weightKg })
										}), "Kg"]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										className: "ce-input",
										placeholder: "Value",
										value: form.weightValue,
										onChange: (e) => patch({ weightValue: e.target.value })
									})
								]
							})
						]
					})] })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "oif-block",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "ce-field-label",
						children: "Customer working drawing available"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "oif-checks",
						children: ["YES", "NO"].map((v) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "oif-check",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "radio",
								name: "drawing",
								checked: form.drawingAvailable === v,
								onChange: () => patch({ drawingAvailable: v })
							}), v]
						}, v))
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "oif-banner",
					children: "D. ONSITE ACTIVITY"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "oif-block",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: ["A. Estimated project duration", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							className: "ce-input",
							value: form.duration,
							onChange: (e) => patch({ duration: e.target.value }),
							placeholder: "e.g. 12 days"
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
							className: "ce-table",
							style: { marginTop: "0.6rem" },
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Manpower designation" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "No. of pax" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Manpower designation" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "No. of pax" })
							] }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: Array.from({ length: Math.ceil(form.manpower.length / 2) }).map((_, i) => {
								const a = form.manpower[i * 2];
								const b = form.manpower[i * 2 + 1];
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										className: "ce-input",
										value: a.designation,
										onChange: (e) => updateManpower(a.id, "designation", e.target.value)
									}) }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										className: "ce-input",
										value: a.pax,
										onChange: (e) => updateManpower(a.id, "pax", e.target.value)
									}) }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: b ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										className: "ce-input",
										value: b.designation,
										onChange: (e) => updateManpower(b.id, "designation", e.target.value)
									}) : null }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: b ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										className: "ce-input",
										value: b.pax,
										onChange: (e) => updateManpower(b.id, "pax", e.target.value)
									}) : null })
								] }, a.id);
							}) })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							className: "ce-btn-ghost ce-btn-sm",
							onClick: addManpower,
							style: { marginTop: "0.5rem" },
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { size: 13 }), " Add manpower row"]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "oif-banner",
					children: "E. SCOPE OF WORK"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "oif-split",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
						className: "ce-input ce-notes-box",
						rows: 10,
						value: form.scopeLeft,
						onChange: (e) => patch({ scopeLeft: e.target.value })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
						className: "ce-input ce-notes-box",
						rows: 10,
						value: form.scopeRight,
						onChange: (e) => patch({ scopeRight: e.target.value })
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "oif-banner",
					children: "F. ESTIMATED MATERIALS, CONSUMABLES, TOOLS AND EQUIPMENT"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "oif-split",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
						className: "ce-input ce-notes-box",
						rows: 10,
						value: form.materialsLeft,
						onChange: (e) => patch({ materialsLeft: e.target.value })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
						className: "ce-input ce-notes-box",
						rows: 10,
						value: form.materialsRight,
						onChange: (e) => patch({ materialsRight: e.target.value })
					})]
				})
			]
		})]
	});
}
var EL_STANDARDS = [
	{
		id: "s1",
		group: "Material",
		name: "Carbon steel density",
		value: "7.85 g/cm³",
		note: "Plates, pipes, bars"
	},
	{
		id: "s2",
		group: "Material",
		name: "Stainless 304 density",
		value: "8.00 g/cm³",
		note: "Austenitic plate"
	},
	{
		id: "s3",
		group: "Welding",
		name: "SMAW deposition efficiency",
		value: "65%",
		note: "Stick electrode"
	},
	{
		id: "s4",
		group: "Welding",
		name: "GMAW deposition efficiency",
		value: "90%",
		note: "Solid wire"
	},
	{
		id: "s5",
		group: "Welding",
		name: "FCAW deposition efficiency",
		value: "85%",
		note: "Flux-cored"
	},
	{
		id: "s6",
		group: "Welding",
		name: "SAW deposition efficiency",
		value: "98%",
		note: "Submerged arc"
	},
	{
		id: "s7",
		group: "Coating",
		name: "Typical epoxy DFT",
		value: "150–250 µm",
		note: "Protective coating"
	},
	{
		id: "s8",
		group: "Coating",
		name: "Volume solids (epoxy)",
		value: "70–80%",
		note: "High-build"
	},
	{
		id: "s9",
		group: "Coating",
		name: "Wastage allowance",
		value: "15–25%",
		note: "Onsite spray"
	},
	{
		id: "s10",
		group: "Pipe",
		name: "Steel pipe weight factor",
		value: "0.02466",
		note: "(OD−WT)×WT×L"
	}
];
function num$1(v) {
	const n = Number(v);
	return Number.isFinite(n) ? n : 0;
}
function ElCalculatorView() {
	const [tool, setTool] = (0, import_react.useState)("weld");
	const [weld, setWeld] = (0, import_react.useState)({
		process: "SMAW",
		jointType: "fillet",
		lengthM: 10,
		sizeMm: 6,
		efficiency: 65,
		wastage: 10,
		density: 7.85
	});
	const [paint, setPaint] = (0, import_react.useState)({
		area: 100,
		coats: 2,
		dft: 200,
		solids: 75,
		wastage: 20
	});
	const [raw, setRaw] = (0, import_react.useState)({
		kind: "plate",
		length: 1.2,
		width: 2.4,
		thick: 12,
		od: 168.3,
		wt: 7.11,
		density: 7.85
	});
	const [stdQuery, setStdQuery] = (0, import_react.useState)("");
	const weldKg = (0, import_react.useMemo)(() => {
		const lengthMm = num$1(weld.lengthM) * 1e3;
		const z = num$1(weld.sizeMm);
		return (weld.jointType === "fillet" ? z * z / 2 : z * z * .7) * lengthMm / 1e3 * num$1(weld.density) / 1e3 / Math.max(num$1(weld.efficiency) / 100, .01) * (1 + num$1(weld.wastage) / 100);
	}, [weld]);
	const paintL = (0, import_react.useMemo)(() => {
		const coverage = num$1(paint.solids) / 100 * (10 / Math.max(num$1(paint.dft), 1));
		return num$1(paint.area) * num$1(paint.coats) / Math.max(coverage, 1e-4) * (1 + num$1(paint.wastage) / 100);
	}, [paint]);
	const rawKg = (0, import_react.useMemo)(() => {
		if (raw.kind === "pipe") return (num$1(raw.od) - num$1(raw.wt)) * num$1(raw.wt) * .02466 * num$1(raw.length);
		return num$1(raw.length) * num$1(raw.width) * num$1(raw.thick) * num$1(raw.density);
	}, [raw]);
	const standards = EL_STANDARDS.filter((s) => !stdQuery || `${s.group} ${s.name} ${s.note}`.toLowerCase().includes(stdQuery.toLowerCase()));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "dash-container",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "dash-header",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "ce-serif",
					children: "EL Calculator"
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "wiz-rce-mode",
				style: { marginBottom: "1rem" },
				children: [
					["weld", "6.1 Welding consumables"],
					["paint", "6.2 Paints & coatings"],
					["raw", "6.3 Raw materials"],
					["std", "6.4 Standards database"]
				].map(([k, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: `ce-pill ${tool === k ? "ce-pill-active" : ""}`,
					onClick: () => setTool(k),
					children: label
				}, k))
			}),
			tool === "weld" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "ce-card wiz-card",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "ce-serif",
						children: "Welding consumables"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "wiz-grid",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "wiz-field",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "ce-field-label",
									children: "Process"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
									className: "ce-input",
									value: weld.process,
									onChange: (e) => {
										const process = e.target.value;
										const eff = {
											SMAW: 65,
											GMAW: 90,
											FCAW: 85,
											SAW: 98,
											GTAW: 100
										}[process];
										setWeld({
											...weld,
											process,
											efficiency: eff
										});
									},
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "SMAW" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "GMAW" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "FCAW" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "SAW" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "GTAW" })
									]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "wiz-field",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "ce-field-label",
									children: "Joint"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
									className: "ce-input",
									value: weld.jointType,
									onChange: (e) => setWeld({
										...weld,
										jointType: e.target.value
									}),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "fillet",
										children: "Fillet"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "groove",
										children: "Groove"
									})]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "wiz-field",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "ce-field-label",
									children: "Weld length (m)"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									className: "ce-input",
									type: "number",
									value: weld.lengthM,
									onChange: (e) => setWeld({
										...weld,
										lengthM: e.target.value
									})
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "wiz-field",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "ce-field-label",
									children: "Size / leg (mm)"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									className: "ce-input",
									type: "number",
									value: weld.sizeMm,
									onChange: (e) => setWeld({
										...weld,
										sizeMm: e.target.value
									})
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "wiz-field",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "ce-field-label",
									children: "Deposition efficiency (%)"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									className: "ce-input",
									type: "number",
									value: weld.efficiency,
									onChange: (e) => setWeld({
										...weld,
										efficiency: e.target.value
									})
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "wiz-field",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "ce-field-label",
									children: "Wastage (%)"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									className: "ce-input",
									type: "number",
									value: weld.wastage,
									onChange: (e) => setWeld({
										...weld,
										wastage: e.target.value
									})
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "el-result",
						children: ["Required consumable ", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("b", { children: [weldKg.toFixed(2), " kg"] })]
					})
				]
			}),
			tool === "paint" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "ce-card wiz-card",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "ce-serif",
						children: "Paints & coatings"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "wiz-grid",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "wiz-field",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "ce-field-label",
									children: "Area (m²)"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									className: "ce-input",
									type: "number",
									value: paint.area,
									onChange: (e) => setPaint({
										...paint,
										area: e.target.value
									})
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "wiz-field",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "ce-field-label",
									children: "Coats"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									className: "ce-input",
									type: "number",
									value: paint.coats,
									onChange: (e) => setPaint({
										...paint,
										coats: e.target.value
									})
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "wiz-field",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "ce-field-label",
									children: "DFT (µm)"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									className: "ce-input",
									type: "number",
									value: paint.dft,
									onChange: (e) => setPaint({
										...paint,
										dft: e.target.value
									})
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "wiz-field",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "ce-field-label",
									children: "Volume solids (%)"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									className: "ce-input",
									type: "number",
									value: paint.solids,
									onChange: (e) => setPaint({
										...paint,
										solids: e.target.value
									})
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "wiz-field",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "ce-field-label",
									children: "Wastage (%)"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									className: "ce-input",
									type: "number",
									value: paint.wastage,
									onChange: (e) => setPaint({
										...paint,
										wastage: e.target.value
									})
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "el-result",
						children: ["Paint required ", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("b", { children: [paintL.toFixed(2), " L"] })]
					})
				]
			}),
			tool === "raw" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "ce-card wiz-card",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "ce-serif",
						children: "Raw materials"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "wiz-rce-mode",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: `ce-pill ${raw.kind === "plate" ? "ce-pill-active" : ""}`,
							onClick: () => setRaw({
								...raw,
								kind: "plate"
							}),
							children: "Plate"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: `ce-pill ${raw.kind === "pipe" ? "ce-pill-active" : ""}`,
							onClick: () => setRaw({
								...raw,
								kind: "pipe"
							}),
							children: "Pipe"
						})]
					}),
					raw.kind === "plate" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "wiz-grid",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "wiz-field",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "ce-field-label",
									children: "Length (m)"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									className: "ce-input",
									type: "number",
									value: raw.length,
									onChange: (e) => setRaw({
										...raw,
										length: e.target.value
									})
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "wiz-field",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "ce-field-label",
									children: "Width (m)"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									className: "ce-input",
									type: "number",
									value: raw.width,
									onChange: (e) => setRaw({
										...raw,
										width: e.target.value
									})
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "wiz-field",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "ce-field-label",
									children: "Thickness (mm)"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									className: "ce-input",
									type: "number",
									value: raw.thick,
									onChange: (e) => setRaw({
										...raw,
										thick: e.target.value
									})
								})]
							})
						]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "wiz-grid",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "wiz-field",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "ce-field-label",
									children: "Outside Ø (mm)"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									className: "ce-input",
									type: "number",
									value: raw.od,
									onChange: (e) => setRaw({
										...raw,
										od: e.target.value
									})
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "wiz-field",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "ce-field-label",
									children: "Wall thickness (mm)"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									className: "ce-input",
									type: "number",
									value: raw.wt,
									onChange: (e) => setRaw({
										...raw,
										wt: e.target.value
									})
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "wiz-field",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "ce-field-label",
									children: "Length (m)"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									className: "ce-input",
									type: "number",
									value: raw.length,
									onChange: (e) => setRaw({
										...raw,
										length: e.target.value
									})
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "el-result",
						children: ["Estimated weight ", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("b", { children: [rawKg.toFixed(2), " kg"] })]
					})
				]
			}),
			tool === "std" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "ce-card wiz-card",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "ce-serif",
						children: "Standards database"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mon-filter",
						style: { marginBottom: "0.8rem" },
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { size: 16 }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							className: "ce-input",
							placeholder: "Search standards…",
							value: stdQuery,
							onChange: (e) => setStdQuery(e.target.value)
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
						className: "ce-table",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Group" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Standard" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Value" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Notes" })
						] }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: standards.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: s.group }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: s.name }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "ce-mono",
								children: s.value
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: s.note })
						] }, s.id)) })]
					})
				]
			})
		]
	});
}
function nextDocNo(prefix, list, field) {
	const year = (/* @__PURE__ */ new Date()).getFullYear();
	const seq = (list || []).length + 1;
	return `${prefix}-${year}-${String(seq).padStart(3, "0")}`;
}
var USER_LEVELS = [
	{
		id: "staff",
		label: "Staff",
		blurb: "Own dashboard, CE editor, inspection filing, EL calculator."
	},
	{
		id: "lead",
		label: "Lead",
		blurb: "Staff plus monitoring (active / RCE) and scope library."
	},
	{
		id: "head",
		label: "Head",
		blurb: "Department view including executive monitoring."
	},
	{
		id: "admin",
		label: "Administrator",
		blurb: "Full access including this Admin console."
	}
];
var DOC_TYPES = [
	{
		id: "ce",
		label: "Cost Estimate"
	},
	{
		id: "rce",
		label: "RCE Request"
	},
	{
		id: "oif",
		label: "Onsite Inspection Form"
	}
];
var ACCESS_MATRIX = [
	{
		area: "Dashboard / User Monitoring",
		staff: true,
		lead: true,
		head: true,
		admin: true
	},
	{
		area: "Create CE & Inspection",
		staff: true,
		lead: true,
		head: true,
		admin: true
	},
	{
		area: "CE / RCE editor",
		staff: true,
		lead: true,
		head: true,
		admin: true
	},
	{
		area: "Monitoring — Active & RCE",
		staff: false,
		lead: true,
		head: true,
		admin: true
	},
	{
		area: "Monitoring — Archive",
		staff: false,
		lead: true,
		head: true,
		admin: true
	},
	{
		area: "Monitoring — Executive",
		staff: false,
		lead: false,
		head: true,
		admin: true
	},
	{
		area: "Scope Library",
		staff: false,
		lead: true,
		head: true,
		admin: true
	},
	{
		area: "Database / masterlist",
		staff: false,
		lead: true,
		head: true,
		admin: true
	},
	{
		area: "EL Calculator",
		staff: true,
		lead: true,
		head: true,
		admin: true
	},
	{
		area: "Approve documents",
		staff: false,
		lead: true,
		head: true,
		admin: true
	},
	{
		area: "Admin console",
		staff: false,
		lead: false,
		head: false,
		admin: true
	}
];
function defaultAdminConfig() {
	return {
		users: [
			{
				id: "u-admin",
				name: "Administrator",
				email: "admin@costing.local",
				designation: "Department Head",
				department: "Costing",
				level: "admin",
				status: "active"
			},
			{
				id: "u-est-a",
				name: "Estimator A",
				email: "estimator.a@costing.local",
				designation: "Cost Estimator",
				department: "Costing",
				level: "lead",
				status: "active"
			},
			{
				id: "u-est-b",
				name: "Estimator B",
				email: "estimator.b@costing.local",
				designation: "Cost Estimator",
				department: "Costing",
				level: "staff",
				status: "active"
			}
		],
		pending: [{
			id: "pend-1",
			name: "Maria Santos",
			email: "m.santos@sales.local",
			requestedAt: "2026-09-14",
			designation: "Sales Representative",
			level: "staff",
			department: "Sales"
		}, {
			id: "pend-2",
			name: "Jon Reyes",
			email: "j.reyes@costing.local",
			requestedAt: "2026-09-15",
			designation: "Cost Estimator",
			level: "staff",
			department: "Costing"
		}],
		designations: [
			"Cost Estimator",
			"Sales Representative",
			"Sales Manager",
			"Document Controller",
			"Department Head"
		],
		approvalFlows: {
			ce: [
				{
					id: "ce-1",
					title: "Prepared by Estimator",
					role: "staff"
				},
				{
					id: "ce-2",
					title: "Reviewed by Lead",
					role: "lead"
				},
				{
					id: "ce-3",
					title: "Approved by Head",
					role: "head"
				}
			],
			rce: [
				{
					id: "rce-1",
					title: "Prepared by Sales",
					role: "staff"
				},
				{
					id: "rce-2",
					title: "Reviewed by Sales Manager",
					role: "lead"
				},
				{
					id: "rce-3",
					title: "Accepted by Costing",
					role: "head"
				}
			],
			oif: [{
				id: "oif-1",
				title: "Prepared by Inspector",
				role: "staff"
			}, {
				id: "oif-2",
				title: "Noted by Lead",
				role: "lead"
			}]
		},
		documentControl: {
			companyName: "Costing Department",
			logoDataUrl: "",
			headerLeft: "{company}",
			headerRight: "Rev {rev}  |  {date}  |  {docNo}",
			footerLeft: "Controlled document",
			footerCenter: "Page {page}",
			footerRight: "{company}",
			revision: "1.0",
			showLogo: true
		}
	};
}
function normalizeAdminConfig(raw) {
	const base = defaultAdminConfig();
	const src = raw && typeof raw === "object" ? raw : {};
	const flows = src.approvalFlows && typeof src.approvalFlows === "object" ? src.approvalFlows : {};
	return {
		users: Array.isArray(src.users) && src.users.length ? src.users : base.users,
		pending: Array.isArray(src.pending) ? src.pending : base.pending,
		designations: Array.isArray(src.designations) && src.designations.length ? src.designations : base.designations,
		approvalFlows: {
			ce: Array.isArray(flows.ce) ? flows.ce : base.approvalFlows.ce,
			rce: Array.isArray(flows.rce) ? flows.rce : base.approvalFlows.rce,
			oif: Array.isArray(flows.oif) ? flows.oif : base.approvalFlows.oif
		},
		documentControl: {
			...base.documentControl,
			...src.documentControl && typeof src.documentControl === "object" ? src.documentControl : {}
		}
	};
}
function interpolateDocTokens(template, vars) {
	return String(template ?? "").replace(/\{(\w+)\}/g, (_, key) => {
		const value = vars[key];
		return value == null ? "" : String(value);
	});
}
function uid$1(prefix) {
	return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 6)}`;
}
function AdminHub({ config, onChange }) {
	const [tab, setTab] = (0, import_react.useState)("users");
	const cfg = normalizeAdminConfig(config);
	function patch(partial) {
		onChange(normalizeAdminConfig({
			...cfg,
			...partial
		}));
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "admin-wrap",
		"data-admin-hub": "true",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "dash-header",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "ce-serif",
					children: "Admin"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "wiz-sub",
					children: "Registration, roles, approval routes, and export letterhead. Login will lock this to Administrators — settings save now."
				})] })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "wiz-rce-mode",
				role: "tablist",
				"aria-label": "Admin sections",
				children: [
					["users", "User access"],
					["flow", "Approval flow"],
					["docs", "Document control"]
				].map(([k, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					role: "tab",
					"aria-selected": tab === k,
					className: `ce-pill ${tab === k ? "ce-pill-active" : ""}`,
					onClick: () => setTab(k),
					children: label
				}, k))
			}),
			tab === "users" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UserAccessPanel, {
				cfg,
				patch
			}),
			tab === "flow" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ApprovalFlowPanel, {
				cfg,
				patch
			}),
			tab === "docs" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DocumentControlPanel, {
				cfg,
				patch
			})
		]
	});
}
function UserAccessPanel({ cfg, patch }) {
	const [draft, setDraft] = (0, import_react.useState)({
		name: "",
		email: "",
		designation: cfg.designations[0] || "Cost Estimator",
		department: "Costing",
		level: "staff"
	});
	const [pendingDraft, setPendingDraft] = (0, import_react.useState)({
		name: "",
		email: ""
	});
	const [newTitle, setNewTitle] = (0, import_react.useState)("");
	function acceptPending(row) {
		const user = {
			id: uid$1("u"),
			name: row.name,
			email: row.email,
			designation: row.designation || cfg.designations[0] || "Cost Estimator",
			department: row.department || "Costing",
			level: row.level || "staff",
			status: "active"
		};
		patch({
			users: [...cfg.users, user],
			pending: cfg.pending.filter((p) => p.id !== row.id)
		});
	}
	function updatePending(id, partial) {
		patch({ pending: cfg.pending.map((p) => p.id === id ? {
			...p,
			...partial
		} : p) });
	}
	function updateUser(id, partial) {
		patch({ users: cfg.users.map((x) => x.id === id ? {
			...x,
			...partial
		} : x) });
	}
	const adminCount = cfg.users.filter((u) => u.level === "admin").length;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "ce-card wiz-card",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
					className: "ce-serif",
					children: "Pending registrations"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "wiz-hint",
					children: "Accept a request, then set designation (job title) and user level (what they can open). When login is live, sign-ups land here automatically."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "wiz-grid",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "wiz-field",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "ce-field-label",
							children: "Name"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							className: "ce-input",
							value: pendingDraft.name,
							onChange: (e) => setPendingDraft({
								...pendingDraft,
								name: e.target.value
							})
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "wiz-field",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "ce-field-label",
							children: "Email"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							className: "ce-input",
							value: pendingDraft.email,
							onChange: (e) => setPendingDraft({
								...pendingDraft,
								email: e.target.value
							})
						})]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "ce-btn-ghost ce-btn-sm",
					style: { marginTop: "0.6rem" },
					onClick: () => {
						if (!pendingDraft.name.trim()) return;
						patch({ pending: [...cfg.pending, {
							id: uid$1("pend"),
							name: pendingDraft.name.trim(),
							email: pendingDraft.email.trim(),
							requestedAt: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
							designation: cfg.designations[0] || "Cost Estimator",
							level: "staff",
							department: "Costing"
						}] });
						setPendingDraft({
							name: "",
							email: ""
						});
					},
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { size: 13 }), " Queue registration"]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "ce-gridwrap",
					style: { marginTop: "0.8rem" },
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
						className: "ce-table",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Name" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Designation" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Level" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Requested" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {})
						] }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tbody", { children: [cfg.pending.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: row.name }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "wiz-hint",
								style: { margin: 0 },
								children: row.email || "—"
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
								className: "ce-input",
								value: row.designation || cfg.designations[0],
								onChange: (e) => updatePending(row.id, { designation: e.target.value }),
								children: cfg.designations.map((d) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: d }, d))
							}) }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
								className: "ce-input",
								value: row.level || "staff",
								onChange: (e) => updatePending(row.id, { level: e.target.value }),
								children: USER_LEVELS.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: l.id,
									children: l.label
								}, l.id))
							}) }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: row.requestedAt || "—" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									className: "ce-btn-primary ce-btn-sm",
									onClick: () => acceptPending(row),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { size: 13 }), " Accept"]
								}),
								" ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									className: "ce-btn-ghost ce-btn-sm",
									onClick: () => patch({ pending: cfg.pending.filter((p) => p.id !== row.id) }),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { size: 13 }), " Reject"]
								})
							] })
						] }, row.id)), cfg.pending.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							colSpan: 5,
							className: "ce-empty",
							children: "No pending registrations."
						}) })] })]
					})
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "ce-card wiz-card",
			style: { marginTop: "1rem" },
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
					className: "ce-serif",
					children: "User directory"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "wiz-hint",
					children: "Designation is their position on paper. User level is the permission set below. Keep at least one Administrator."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "wiz-grid",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "wiz-field",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "ce-field-label",
								children: "Name"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								className: "ce-input",
								value: draft.name,
								onChange: (e) => setDraft({
									...draft,
									name: e.target.value
								})
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "wiz-field",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "ce-field-label",
								children: "Email"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								className: "ce-input",
								value: draft.email,
								onChange: (e) => setDraft({
									...draft,
									email: e.target.value
								})
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "wiz-field",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "ce-field-label",
								children: "Designation"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
								className: "ce-input",
								value: draft.designation,
								onChange: (e) => setDraft({
									...draft,
									designation: e.target.value
								}),
								children: cfg.designations.map((d) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: d }, d))
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "wiz-field",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "ce-field-label",
								children: "User level"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
								className: "ce-input",
								value: draft.level,
								onChange: (e) => setDraft({
									...draft,
									level: e.target.value
								}),
								children: USER_LEVELS.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: l.id,
									children: l.label
								}, l.id))
							})]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "ce-btn-primary ce-btn-sm",
					style: { marginTop: "0.6rem" },
					onClick: () => {
						if (!draft.name.trim()) return;
						patch({ users: [...cfg.users, {
							id: uid$1("u"),
							status: "active",
							...draft
						}] });
						setDraft({
							...draft,
							name: "",
							email: ""
						});
					},
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { size: 13 }), " Add user"]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "ce-gridwrap",
					style: { marginTop: "0.8rem" },
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
						className: "ce-table",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Name" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Designation" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Level" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Status" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {})
						] }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: cfg.users.map((u) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: u.name }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "wiz-hint",
								style: { margin: 0 },
								children: u.email
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
								className: "ce-input",
								value: u.designation,
								onChange: (e) => updateUser(u.id, { designation: e.target.value }),
								children: cfg.designations.map((d) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: d }, d))
							}) }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
								className: "ce-input",
								value: u.level,
								onChange: (e) => {
									if (u.level === "admin" && e.target.value !== "admin" && adminCount <= 1) return;
									updateUser(u.id, { level: e.target.value });
								},
								children: USER_LEVELS.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: l.id,
									children: l.label
								}, l.id))
							}) }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "ce-btn-ghost ce-btn-sm",
								onClick: () => updateUser(u.id, { status: u.status === "active" ? "suspended" : "active" }),
								children: u.status === "active" ? "Active" : "Suspended"
							}) }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "ce-btn-ghost ce-btn-sm",
								title: u.level === "admin" && adminCount <= 1 ? "Keep at least one administrator" : "Remove user",
								disabled: u.level === "admin" && adminCount <= 1,
								onClick: () => {
									if (u.level === "admin" && adminCount <= 1) return;
									patch({ users: cfg.users.filter((x) => x.id !== u.id) });
								},
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { size: 13 })
							}) })
						] }, u.id)) })]
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
					className: "ce-serif admin-subhead",
					children: "Designations"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "wiz-hint",
					children: "Job titles only — they do not grant access. Add the positions your org uses."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "admin-desig-row",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						className: "ce-input",
						placeholder: "New designation",
						value: newTitle,
						onChange: (e) => setNewTitle(e.target.value)
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "ce-btn-ghost ce-btn-sm",
						onClick: () => {
							const title = newTitle.trim();
							if (!title || cfg.designations.includes(title)) return;
							patch({ designations: [...cfg.designations, title] });
							setNewTitle("");
						},
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { size: 13 }), " Add"]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "admin-desig-list",
					children: cfg.designations.map((d) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "admin-chip",
						children: [d, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "admin-chip-x",
							"aria-label": `Remove ${d}`,
							onClick: () => patch({ designations: cfg.designations.filter((x) => x !== d) }),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { size: 11 })
						})]
					}, d))
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "ce-card wiz-card",
			style: { marginTop: "1rem" },
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
					className: "ce-serif",
					children: "User levels"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "wiz-hint",
					children: "Intended access after login. Admin stays open for setup until then."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "admin-levels",
					children: USER_LEVELS.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "admin-level-card",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: l.label }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: l.blurb })]
					}, l.id))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "ce-gridwrap",
					style: { marginTop: "0.9rem" },
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
						className: "ce-table admin-matrix",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Area" }), USER_LEVELS.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: l.label }, l.id))] }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: ACCESS_MATRIX.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: row.area }), USER_LEVELS.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: row[l.id] ? "admin-yes" : "admin-no",
							children: row[l.id] ? "Yes" : "—"
						}) }, l.id))] }, row.area)) })]
					})
				})
			]
		})
	] });
}
function ApprovalFlowPanel({ cfg, patch }) {
	const [docType, setDocType] = (0, import_react.useState)("ce");
	const steps = cfg.approvalFlows?.[docType] || [];
	const current = DOC_TYPES.find((d) => d.id === docType);
	function setSteps(next) {
		patch({ approvalFlows: {
			...cfg.approvalFlows,
			[docType]: next
		} });
	}
	function move(index, dir) {
		const next = [...steps];
		const j = index + dir;
		if (j < 0 || j >= next.length) return;
		const tmp = next[index];
		next[index] = next[j];
		next[j] = tmp;
		setSteps(next);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "ce-card wiz-card",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				className: "ce-serif",
				children: "Approval flow"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "wiz-hint",
				children: "Ordered route for each document. Add, remove, or swap steps — the document follows this list, not hardcoded 1st / 2nd / 3rd titles. Login will walk this list on submit."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "wiz-rce-mode",
				children: DOC_TYPES.map((d) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: `ce-pill ${docType === d.id ? "ce-pill-active" : ""}`,
					onClick: () => setDocType(d.id),
					children: d.label
				}, d.id))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
				className: "admin-flow-list",
				children: steps.map((step, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "admin-flow-num",
						children: i + 1
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						className: "ce-input",
						value: step.title,
						onChange: (e) => setSteps(steps.map((s) => s.id === step.id ? {
							...s,
							title: e.target.value
						} : s))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
						className: "ce-input",
						value: step.role,
						onChange: (e) => setSteps(steps.map((s) => s.id === step.id ? {
							...s,
							role: e.target.value
						} : s)),
						children: USER_LEVELS.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: l.id,
							children: l.label
						}, l.id))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "ce-btn-ghost ce-btn-sm",
						onClick: () => move(i, -1),
						"aria-label": "Move up",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronUp, { size: 14 })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "ce-btn-ghost ce-btn-sm",
						onClick: () => move(i, 1),
						"aria-label": "Move down",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { size: 14 })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "ce-btn-ghost ce-btn-sm",
						onClick: () => setSteps(steps.filter((s) => s.id !== step.id)),
						"aria-label": "Remove step",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { size: 14 })
					})
				] }, step.id))
			}),
			steps.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "ce-empty",
				children: "No steps. Add at least one approver."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				className: "ce-btn-ghost ce-btn-sm",
				onClick: () => setSteps([...steps, {
					id: uid$1("step"),
					title: `Approver ${steps.length + 1}`,
					role: "lead"
				}]),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { size: 13 }), " Add step"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "wiz-hint",
				style: { marginTop: "0.9rem" },
				children: [
					current?.label,
					" currently:",
					" ",
					steps.map((s) => s.title).join(" → ") || "no route"
				]
			})
		]
	});
}
function DocumentControlPanel({ cfg, patch }) {
	const dc = cfg.documentControl;
	const fileRef = (0, import_react.useRef)(null);
	const sample = {
		company: dc.companyName || "",
		rev: dc.revision || "1.0",
		date: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
		docNo: "CE-2026-004",
		page: "1"
	};
	function setDc(partial) {
		patch({ documentControl: {
			...dc,
			...partial
		} });
	}
	function onLogo(e) {
		const file = e.target.files?.[0];
		e.target.value = "";
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => setDc({ logoDataUrl: String(reader.result || "") });
		reader.readAsDataURL(file);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "ce-card wiz-card",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				className: "ce-serif",
				children: "Document control"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "wiz-hint",
				children: [
					"Letterhead used on PDF and Excel export. Tokens: ",
					"{company}",
					", ",
					"{rev}",
					",",
					" ",
					"{date}",
					", ",
					"{docNo}",
					", ",
					"{page}",
					"."
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "wiz-grid",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "wiz-field",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "ce-field-label",
							children: "Company name"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							className: "ce-input",
							value: dc.companyName,
							onChange: (e) => setDc({ companyName: e.target.value })
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "wiz-field",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "ce-field-label",
							children: "Default revision"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							className: "ce-input",
							value: dc.revision,
							onChange: (e) => setDc({ revision: e.target.value })
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "wiz-field wiz-span",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "ce-field-label",
							children: "Header left"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							className: "ce-input",
							value: dc.headerLeft,
							onChange: (e) => setDc({ headerLeft: e.target.value })
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "wiz-field wiz-span",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "ce-field-label",
							children: "Header right"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							className: "ce-input",
							value: dc.headerRight,
							onChange: (e) => setDc({ headerRight: e.target.value })
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "wiz-field",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "ce-field-label",
							children: "Footer left"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							className: "ce-input",
							value: dc.footerLeft,
							onChange: (e) => setDc({ footerLeft: e.target.value })
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "wiz-field",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "ce-field-label",
							children: "Footer center"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							className: "ce-input",
							value: dc.footerCenter,
							onChange: (e) => setDc({ footerCenter: e.target.value })
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "wiz-field wiz-span",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "ce-field-label",
							children: "Footer right"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							className: "ce-input",
							value: dc.footerRight,
							onChange: (e) => setDc({ footerRight: e.target.value })
						})]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "wiz-rce-mode",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "ce-btn-ghost ce-btn-sm",
						onClick: () => fileRef.current?.click(),
						children: "Upload logo"
					}),
					dc.logoDataUrl && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "ce-btn-ghost ce-btn-sm",
						onClick: () => setDc({ logoDataUrl: "" }),
						children: "Remove logo"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "admin-check",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "checkbox",
							checked: !!dc.showLogo,
							onChange: (e) => setDc({ showLogo: e.target.checked })
						}), "Show logo"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						ref: fileRef,
						type: "file",
						accept: "image/*",
						hidden: true,
						onChange: onLogo
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "admin-doc-preview",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "admin-doc-preview-head",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: dc.showLogo && dc.logoDataUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
							src: dc.logoDataUrl,
							alt: "logo"
						}) : interpolateDocTokens(dc.headerLeft, sample) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: interpolateDocTokens(dc.headerRight, sample) })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "admin-doc-preview-body",
						children: "Export preview"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "admin-doc-preview-foot",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: interpolateDocTokens(dc.footerLeft, sample) }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: interpolateDocTokens(dc.footerCenter, sample) }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: interpolateDocTokens(dc.footerRight, sample) })
						]
					})
				]
			})
		]
	});
}
var PHP = new Intl.NumberFormat("en-PH", {
	style: "currency",
	currency: "PHP",
	minimumFractionDigits: 2
});
var fmt = (n) => PHP.format(Number.isFinite(n) ? n : 0);
var num = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;
var DAY_TYPES = [
	"Regular",
	"Sun/Special",
	"Holiday"
];
var DAY_TYPE_MULT = {
	Regular: 1,
	"Sun/Special": 1.3,
	Holiday: 2
};
var NIGHT_DIFF = .1;
var OT_MULT = 1.25;
var CATS = [
	"BOL",
	"BOTE",
	"PPE",
	"BOCM",
	"MISC"
];
var CATEGORY_META = {
	BOL: {
		label: "Bill of Labor",
		short: "BOL",
		icon: Users
	},
	BOTE: {
		label: "Bill of Tools & Equipment",
		short: "BOTE",
		icon: Wrench
	},
	PPE: {
		label: "Personal Protective Equipment",
		short: "PPE",
		icon: HardHat
	},
	BOCM: {
		label: "Bill of Consumables & Materials",
		short: "BOCM",
		icon: Package
	},
	MISC: {
		label: "Miscellaneous",
		short: "MISC",
		icon: FileText
	}
};
var _seq = 0;
var uid = (p) => `${p}-${(_seq++).toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
var FIXED_CATEGORY_KEYS = [
	"manpower",
	"equipment",
	"consumables",
	"ppe",
	"misc"
];
var LEGACY_KEY_MAP = {
	BOL: "manpower",
	BOTE: "equipment",
	BOCM: "consumables",
	PPE: "ppe",
	MISC: "misc"
};
var normalizeCategoryKey = (key) => LEGACY_KEY_MAP[key] || key;
function emptyMasterlistState() {
	return {
		manpower: [],
		equipment: [],
		consumables: [],
		ppe: [],
		misc: [],
		clients: [],
		customCategories: []
	};
}
function isFixedCategory(categoryKey) {
	return FIXED_CATEGORY_KEYS.includes(categoryKey);
}
function labelKeyForCategory(categoryKey) {
	if (categoryKey === "manpower") return "role";
	if (categoryKey === "ppe") return "item";
	if (isFixedCategory(categoryKey)) return "description";
	return "name";
}
function withCategoryItems(state, categoryKey, updater) {
	if (isFixedCategory(categoryKey)) return {
		...state,
		[categoryKey]: updater(state[categoryKey] || [])
	};
	return {
		...state,
		customCategories: state.customCategories.map((c) => c.categoryKey === categoryKey ? {
			...c,
			items: updater(c.items)
		} : c)
	};
}
function slugifyCategoryKey(name, state) {
	const base = String(name || "category").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "category";
	const taken = /* @__PURE__ */ new Set([...FIXED_CATEGORY_KEYS, ...state.customCategories.map((c) => c.categoryKey)]);
	if (!taken.has(base)) return base;
	let i = 2;
	while (taken.has(`${base}-${i}`)) i++;
	return `${base}-${i}`;
}
function emptyClient() {
	return {
		id: uid("cli"),
		clientCode: "",
		fullName: "",
		address: ""
	};
}
function masterlistReducer(state, action) {
	switch (action.type) {
		case "ADD_ITEM": return withCategoryItems(state, action.categoryKey, (items) => [...items, action.item]);
		case "UPDATE_ITEM": return withCategoryItems(state, action.categoryKey, (items) => items.map((i) => i.id === action.id ? {
			...i,
			...action.patch
		} : i));
		case "DELETE_ITEM": return withCategoryItems(state, action.categoryKey, (items) => items.filter((i) => i.id !== action.id));
		case "DUPLICATE_ITEM": return withCategoryItems(state, action.categoryKey, (items) => {
			const idx = items.findIndex((i) => i.id === action.id);
			if (idx === -1) return items;
			const labelKey = labelKeyForCategory(action.categoryKey);
			const clone = {
				...items[idx],
				id: uid("ml")
			};
			if (clone[labelKey]) clone[labelKey] = `${clone[labelKey]} (Copy)`;
			const next = [...items];
			next.splice(idx + 1, 0, clone);
			return next;
		});
		case "BULK_IMPORT_CATEGORY_ITEMS": {
			const safeItems = (action.itemsArray || []).filter((row) => row && typeof row === "object").map((row) => ({
				id: row.id || uid("ml"),
				...row
			}));
			if (!safeItems.length) return state;
			return withCategoryItems(state, action.categoryKey, (items) => [...items, ...safeItems]);
		}
		case "ADD_CATEGORY": {
			const categoryKey = slugifyCategoryKey(action.categoryName, state);
			return {
				...state,
				customCategories: [...state.customCategories, {
					id: uid("cat"),
					categoryKey,
					categoryName: action.categoryName || "Untitled Category",
					items: []
				}]
			};
		}
		case "UPDATE_CATEGORY": return {
			...state,
			customCategories: state.customCategories.map((c) => c.id === action.id ? {
				...c,
				...action.patch
			} : c)
		};
		case "DELETE_CATEGORY": return {
			...state,
			customCategories: state.customCategories.filter((c) => c.id !== action.id)
		};
		case "ADD_CLIENT": return {
			...state,
			clients: [...state.clients, action.client]
		};
		case "UPDATE_CLIENT": return {
			...state,
			clients: state.clients.map((c) => c.id === action.id ? {
				...c,
				...action.patch
			} : c)
		};
		case "DELETE_CLIENT": return {
			...state,
			clients: state.clients.filter((c) => c.id !== action.id)
		};
		default: return state;
	}
}
var MasterlistContext = (0, import_react.createContext)(null);
function MasterlistProvider({ children, initialState, onChange }) {
	const [state, dispatch] = (0, import_react.useReducer)(masterlistReducer, initialState && typeof initialState === "object" ? {
		...emptyMasterlistState(),
		...initialState
	} : emptyMasterlistState());
	const onChangeRef = (0, import_react.useRef)(onChange);
	onChangeRef.current = onChange;
	(0, import_react.useEffect)(() => {
		onChangeRef.current?.(state);
	}, [state]);
	const api = (0, import_react.useMemo)(() => ({
		...state,
		BOL: state.manpower,
		BOTE: state.equipment,
		BOCM: state.consumables,
		PPE: state.ppe,
		MISC: state.misc,
		addItem: (categoryKey, item) => dispatch({
			type: "ADD_ITEM",
			categoryKey: normalizeCategoryKey(categoryKey),
			item
		}),
		updateItem: (categoryKey, id, patch) => dispatch({
			type: "UPDATE_ITEM",
			categoryKey: normalizeCategoryKey(categoryKey),
			id,
			patch
		}),
		deleteItem: (categoryKey, id) => dispatch({
			type: "DELETE_ITEM",
			categoryKey: normalizeCategoryKey(categoryKey),
			id
		}),
		duplicateItem: (categoryKey, id) => dispatch({
			type: "DUPLICATE_ITEM",
			categoryKey: normalizeCategoryKey(categoryKey),
			id
		}),
		bulkImportCategoryItems: (categoryKey, itemsArray) => dispatch({
			type: "BULK_IMPORT_CATEGORY_ITEMS",
			categoryKey: normalizeCategoryKey(categoryKey),
			itemsArray
		}),
		addCategory: (categoryName) => dispatch({
			type: "ADD_CATEGORY",
			categoryName
		}),
		deleteCategory: (id) => dispatch({
			type: "DELETE_CATEGORY",
			id
		}),
		addClient: (client) => dispatch({
			type: "ADD_CLIENT",
			client: {
				...emptyClient(),
				...client
			}
		}),
		updateCategory: (id, patch) => dispatch({
			type: "UPDATE_CATEGORY",
			id,
			patch
		}),
		updateClient: (id, patch) => dispatch({
			type: "UPDATE_CLIENT",
			id,
			patch
		}),
		deleteClient: (id) => dispatch({
			type: "DELETE_CLIENT",
			id
		})
	}), [state]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MasterlistContext.Provider, {
		value: api,
		children
	});
}
function useMasterlist() {
	const ctx = (0, import_react.useContext)(MasterlistContext);
	if (!ctx) throw new Error("useMasterlist must be used within a MasterlistProvider");
	return ctx;
}
function calcBOL(item) {
	const dt = DAY_TYPE_MULT[item.dayType] ?? 1;
	const shiftAdd = item.shift === "Night" ? NIGHT_DIFF : 0;
	const effRate = num(item.rate) * dt * (1 + shiftAdd);
	const otRate = num(item.rate) / 8 * OT_MULT * dt * (1 + shiftAdd);
	const base = num(item.qty) * num(item.days) * effRate;
	const ot = num(item.qty) * num(item.days) * num(item.otHrs) * otRate;
	const perDiemAllow = num(item.qty) * num(item.days) * (num(item.perDiem) + num(item.allowance));
	return {
		base,
		ot,
		otRate,
		perDiemAllow,
		labor: base + ot,
		benefits: perDiemAllow,
		subtotal: base + ot + perDiemAllow
	};
}
var calcBOTE = (i) => num(i.qty) * num(i.days) * num(i.rate);
var calcBOCM = (i) => num(i.qty) * num(i.unitCost);
var calcPPE = (i) => num(i.qty) * num(i.unitCost);
var calcMISC = (i) => num(i.qty) * (num(i.days) || 1) * num(i.unitCost);
function itemSubtotal(cat, item) {
	if (cat === "BOL") return calcBOL(item).subtotal;
	if (cat === "BOTE") return calcBOTE(item);
	if (cat === "BOCM") return calcBOCM(item);
	if (cat === "PPE") return calcPPE(item);
	return calcMISC(item);
}
function categoryTotal(items, cat) {
	return (items || []).reduce((s, it) => s + itemSubtotal(cat, it), 0);
}
function subtaskTotal(subtask) {
	return CATS.reduce((s, c) => s + categoryTotal(subtask.items[c], c), 0);
}
function taskTotal(task) {
	return task.subtasks.reduce((s, st) => s + subtaskTotal(st), 0);
}
function projectTotal(tasks) {
	return tasks.reduce((s, t) => s + taskTotal(t), 0);
}
function emptyItems() {
	return {
		BOL: [],
		BOTE: [],
		PPE: [],
		BOCM: [],
		MISC: []
	};
}
function subtask(title, items) {
	return {
		id: uid("sub"),
		title,
		expanded: true,
		items,
		type: "Sequential",
		predecessor: null,
		notes: "",
		files: []
	};
}
function task(title, subtasks) {
	return {
		id: uid("task"),
		title,
		expanded: true,
		notes: "",
		files: [],
		subtasks,
		duration: 0,
		predecessor: null
	};
}
var ATTACHMENT_SHEETS = [
	"BOL",
	"BOTE",
	"BOCM",
	"PPE",
	"MISC_A",
	"MISC_B",
	"MISC_C",
	"MISC_D",
	"MISC_E"
];
function emptyFileAttachments() {
	return ATTACHMENT_SHEETS.reduce((acc, key) => {
		acc[key] = [];
		return acc;
	}, {});
}
function emptySummaryTaskFilters() {
	return {
		showBreakdown: false,
		selectedTaskIds: []
	};
}
function buildEmptyProject() {
	return {
		meta: {
			client: "",
			location: "",
			date: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
			title: "New Cost Estimate",
			subtitle: ""
		},
		tasks: [],
		fileAttachments: emptyFileAttachments(),
		summaryTaskFilters: emptySummaryTaskFilters()
	};
}
function mapTask(state, taskId, fn) {
	return {
		...state,
		tasks: state.tasks.map((t) => t.id === taskId ? fn(t) : t)
	};
}
function mapSubtask(t, subtaskId, fn) {
	return {
		...t,
		subtasks: t.subtasks.map((s) => s.id === subtaskId ? fn(s) : s)
	};
}
function reducer(state, action) {
	switch (action.type) {
		case "SET_META": return {
			...state,
			meta: {
				...state.meta,
				[action.field]: action.value
			}
		};
		case "ADD_TASK": return {
			...state,
			tasks: [...state.tasks, task(action.title || "Untitled Task", [])]
		};
		case "DELETE_TASK": return {
			...state,
			tasks: state.tasks.filter((t) => t.id !== action.taskId)
		};
		case "RENAME_TASK": return mapTask(state, action.taskId, (t) => ({
			...t,
			title: action.title
		}));
		case "TOGGLE_TASK": return mapTask(state, action.taskId, (t) => ({
			...t,
			expanded: !t.expanded
		}));
		case "SET_TASK_NOTES": return mapTask(state, action.taskId, (t) => ({
			...t,
			notes: action.notes
		}));
		case "ADD_TASK_FILES": return mapTask(state, action.taskId, (t) => ({
			...t,
			files: [...t.files || [], ...action.files || []]
		}));
		case "DELETE_TASK_FILE": return mapTask(state, action.taskId, (t) => ({
			...t,
			files: (t.files || []).filter((f) => f.id !== action.fileId)
		}));
		case "SET_SUBTASK_NOTES": return mapTask(state, action.taskId, (t) => mapSubtask(t, action.subtaskId, (s) => ({
			...s,
			notes: action.notes
		})));
		case "ADD_SUBTASK_FILES": return mapTask(state, action.taskId, (t) => mapSubtask(t, action.subtaskId, (s) => ({
			...s,
			files: [...s.files || [], ...action.files || []]
		})));
		case "DELETE_SUBTASK_FILE": return mapTask(state, action.taskId, (t) => mapSubtask(t, action.subtaskId, (s) => ({
			...s,
			files: (s.files || []).filter((f) => f.id !== action.fileId)
		})));
		case "SET_TASK_DURATION": return mapTask(state, action.taskId, (t) => ({
			...t,
			duration: Number(action.duration) || 0
		}));
		case "SET_TASK_PREDECESSOR": return mapTask(state, action.taskId, (t) => ({
			...t,
			predecessor: action.predecessorId || null
		}));
		case "ADD_SUBTASK": return mapTask(state, action.taskId, (t) => {
			const neu = subtask(action.title || "Untitled Subtask", emptyItems());
			const next = [...t.subtasks];
			if (action.afterId) {
				const i = next.findIndex((s) => s.id === action.afterId);
				next.splice(i >= 0 ? i + 1 : next.length, 0, neu);
			} else next.push(neu);
			return {
				...t,
				subtasks: next
			};
		});
		case "DELETE_SUBTASK": return mapTask(state, action.taskId, (t) => ({
			...t,
			subtasks: t.subtasks.filter((s) => s.id !== action.subtaskId)
		}));
		case "RENAME_SUBTASK": return mapTask(state, action.taskId, (t) => mapSubtask(t, action.subtaskId, (s) => ({
			...s,
			title: action.title
		})));
		case "TOGGLE_SUBTASK": return mapTask(state, action.taskId, (t) => mapSubtask(t, action.subtaskId, (s) => ({
			...s,
			expanded: !s.expanded
		})));
		case "SET_SUBTASK_TYPE": return mapTask(state, action.taskId, (t) => mapSubtask(t, action.subtaskId, (s) => ({
			...s,
			type: action.subtaskType
		})));
		case "SET_SUBTASK_PREDECESSOR": return mapTask(state, action.taskId, (t) => mapSubtask(t, action.subtaskId, (s) => ({
			...s,
			predecessor: action.predecessorId || null
		})));
		case "ADD_ITEMS": return mapTask(state, action.taskId, (t) => mapSubtask(t, action.subtaskId, (s) => ({
			...s,
			items: {
				...s.items,
				[action.category]: [...s.items[action.category], ...action.items]
			}
		})));
		case "DELETE_ITEM": return mapTask(state, action.taskId, (t) => mapSubtask(t, action.subtaskId, (s) => ({
			...s,
			items: {
				...s.items,
				[action.category]: s.items[action.category].filter((i) => i.id !== action.itemId)
			}
		})));
		case "UPDATE_ITEM": return mapTask(state, action.taskId, (t) => mapSubtask(t, action.subtaskId, (s) => ({
			...s,
			items: {
				...s.items,
				[action.category]: s.items[action.category].map((i) => i.id === action.itemId ? {
					...i,
					...action.patch
				} : i)
			}
		})));
		case "REPLACE_CATEGORY_ITEMS": return mapTask(state, action.taskId, (t) => mapSubtask(t, action.subtaskId, (s) => ({
			...s,
			items: {
				...s.items,
				[action.category]: action.items
			}
		})));
		case "IMPORT_PROJECT": {
			const base = buildEmptyProject();
			const incoming = action.project || {};
			return {
				...base,
				...incoming,
				meta: {
					...base.meta,
					...incoming.meta || {}
				},
				fileAttachments: {
					...base.fileAttachments,
					...incoming.fileAttachments || {}
				},
				summaryTaskFilters: {
					...base.summaryTaskFilters,
					...incoming.summaryTaskFilters || {}
				},
				tasks: Array.isArray(incoming.tasks) ? incoming.tasks.map((t) => ({
					...task(t.title || "Untitled Task", t.subtasks || []),
					...t,
					subtasks: (t.subtasks || []).map((s) => ({
						...subtask(s.title || "Untitled Subtask", emptyItems()),
						...s
					}))
				})) : []
			};
		}
		case "ADD_ATTACHMENTS": return {
			...state,
			fileAttachments: {
				...state.fileAttachments,
				[action.sheetKey]: [...state.fileAttachments[action.sheetKey] || [], ...action.files]
			}
		};
		case "DELETE_ATTACHMENT": return {
			...state,
			fileAttachments: {
				...state.fileAttachments,
				[action.sheetKey]: (state.fileAttachments[action.sheetKey] || []).filter((f) => f.id !== action.fileId)
			}
		};
		case "SET_SUMMARY_SHOW_BREAKDOWN": {
			const needsSeed = action.value && !state.summaryTaskFilters.showBreakdown && state.summaryTaskFilters.selectedTaskIds.length === 0;
			return {
				...state,
				summaryTaskFilters: {
					showBreakdown: action.value,
					selectedTaskIds: needsSeed ? state.tasks.map((t) => t.id) : state.summaryTaskFilters.selectedTaskIds
				}
			};
		}
		case "TOGGLE_SUMMARY_TASK": {
			const cur = state.summaryTaskFilters.selectedTaskIds;
			const next = cur.includes(action.taskId) ? cur.filter((id) => id !== action.taskId) : [...cur, action.taskId];
			return {
				...state,
				summaryTaskFilters: {
					...state.summaryTaskFilters,
					selectedTaskIds: next
				}
			};
		}
		case "RESTORE_TASKS": return {
			...state,
			tasks: action.tasks
		};
		case "SET_SUMMARY_TASK_IDS": return {
			...state,
			summaryTaskFilters: {
				...state.summaryTaskFilters,
				selectedTaskIds: action.ids
			}
		};
		default: return state;
	}
}
function Pill({ active, onClick, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		onClick,
		className: "ce-pill" + (active ? " ce-pill-active" : ""),
		children
	});
}
function IconBtn({ onClick, title, danger, confirm, children }) {
	const ask = (0, import_react.useContext)(DeleteConfirmContext);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		onClick: async (e) => {
			e.stopPropagation();
			if (confirm !== false && (danger || confirm)) {
				const message = typeof confirm === "string" ? confirm : `${title || "Delete this item"}? This cannot be undone.`;
				if (!(ask ? await ask(message) : window.confirm(message))) return;
			}
			onClick?.(e);
		},
		title,
		className: "ce-iconbtn" + (danger ? " ce-iconbtn-danger" : ""),
		type: "button",
		children
	});
}
var DeleteConfirmContext = (0, import_react.createContext)(null);
function DeleteConfirmProvider({ children }) {
	const [pending, setPending] = (0, import_react.useState)(null);
	const ask = (message) => new Promise((resolve) => {
		setPending({
			message,
			resolve
		});
	});
	const close = (ok) => {
		pending?.resolve(ok);
		setPending(null);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DeleteConfirmContext.Provider, {
		value: ask,
		children: [children, pending && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "ce-confirm-backdrop",
			role: "dialog",
			"aria-modal": "true",
			"aria-labelledby": "ce-confirm-title",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "ce-confirm",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleAlert, {
						size: 22,
						className: "ce-confirm-icon"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						id: "ce-confirm-title",
						className: "ce-serif",
						children: "Delete this?"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: pending.message }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "ce-confirm-actions",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "ce-btn-ghost",
							onClick: () => close(false),
							children: "Cancel"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "ce-btn-primary ce-confirm-delete",
							onClick: () => close(true),
							children: "Delete"
						})]
					})
				]
			})
		})]
	});
}
function readFilesAsAttachments(fileList) {
	return Promise.all(Array.from(fileList || []).map((file) => new Promise((resolve) => {
		const reader = new FileReader();
		reader.onload = () => resolve({
			id: uid("file"),
			name: file.name,
			type: file.type,
			size: file.size,
			dataUrl: String(reader.result || "")
		});
		reader.onerror = () => resolve({
			id: uid("file"),
			name: file.name,
			type: file.type,
			size: file.size,
			dataUrl: ""
		});
		reader.readAsDataURL(file);
	})));
}
function NotesAndFilesBlock({ notes, files, onNotes, onAddFiles, onRemoveFile, label }) {
	const inputRef = (0, import_react.useRef)(null);
	const list = Array.isArray(files) ? files : [];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "ce-notes-files",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "ce-field-label",
				children: ["Notes — ", label]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
				className: "ce-input ce-notes-box",
				placeholder: "These notes appear on the Summary sheet.",
				value: notes || "",
				onChange: (e) => onNotes(e.target.value)
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "ce-notes-files-row",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "ce-btn-ghost ce-btn-sm",
						onClick: () => inputRef.current?.click(),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Paperclip, { size: 13 }), " Upload files"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "ce-notes-files-count",
						children: [
							list.length,
							" file",
							list.length === 1 ? "" : "s",
							" — compiled on ATTCH"
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						ref: inputRef,
						type: "file",
						multiple: true,
						hidden: true,
						onChange: async (e) => {
							const next = await readFilesAsAttachments(e.target.files);
							e.target.value = "";
							if (next.length) onAddFiles(next);
						}
					})
				]
			}),
			list.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "ce-file-chips",
				children: list.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					title: f.name,
					children: f.name
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					"aria-label": `Remove ${f.name}`,
					onClick: () => onRemoveFile(f.id),
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { size: 12 })
				})] }, f.id))
			})
		]
	});
}
function collectNotes(tasks) {
	const rows = [];
	(tasks || []).forEach((t) => {
		if (String(t.notes || "").trim()) rows.push({
			id: t.id,
			who: t.title,
			notes: t.notes
		});
		(t.subtasks || []).forEach((s) => {
			if (String(s.notes || "").trim()) rows.push({
				id: s.id,
				who: `${t.title} / ${s.title}`,
				notes: s.notes
			});
		});
	});
	return rows;
}
function collectScopeFiles(tasks) {
	const files = [];
	(tasks || []).forEach((t) => {
		(t.files || []).forEach((f) => files.push({
			...f,
			sheet: t.title,
			sourceLabel: t.title
		}));
		(t.subtasks || []).forEach((s) => {
			(s.files || []).forEach((f) => files.push({
				...f,
				sheet: `${t.title} / ${s.title}`,
				sourceLabel: `${t.title} / ${s.title}`
			}));
		});
	});
	return files;
}
function EditableTitle({ value, onSave, className, serif }) {
	const [editing, setEditing] = (0, import_react.useState)(false);
	const [draft, setDraft] = (0, import_react.useState)(value);
	if (editing) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
		autoFocus: true,
		value: draft,
		onChange: (e) => setDraft(e.target.value),
		onBlur: () => {
			setEditing(false);
			if (draft.trim()) onSave(draft.trim());
			else setDraft(value);
		},
		onKeyDown: (e) => {
			if (e.key === "Enter") e.currentTarget.blur();
			if (e.key === "Escape") {
				setDraft(value);
				setEditing(false);
			}
		},
		className: "ce-input " + (className || ""),
		style: serif ? { fontFamily: "var(--font-serif)" } : void 0
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: "ce-editable-title " + (className || ""),
		onClick: () => {
			setDraft(value);
			setEditing(true);
		},
		style: serif ? { fontFamily: "var(--font-serif)" } : void 0,
		children: value
	});
}
function emptyBOLDraft(id) {
	return {
		id,
		masterlistId: null,
		role: "",
		dayType: "Regular",
		shift: "Day",
		qty: "",
		days: "",
		rate: "",
		otHrs: "",
		perDiem: "",
		allowance: ""
	};
}
function useResizableColumns(storageKey, defaults) {
	const [widths, setWidths] = (0, import_react.useState)(() => {
		if (typeof window === "undefined") return defaults;
		try {
			const stored = localStorage.getItem(storageKey);
			return stored ? {
				...defaults,
				...JSON.parse(stored)
			} : defaults;
		} catch {
			return defaults;
		}
	});
	const updateWidth = (key, value) => {
		setWidths((prev) => {
			const next = {
				...prev,
				[key]: value
			};
			try {
				localStorage.setItem(storageKey, JSON.stringify(next));
			} catch {}
			return next;
		});
	};
	return {
		widths,
		updateWidth
	};
}
function ResizableTh({ colKey, width, onResize, children, style }) {
	const handleMouseDown = (e) => {
		e.preventDefault();
		const startX = e.clientX;
		const startWidth = width;
		const onMouseMove = (moveEvent) => {
			onResize(colKey, Math.max(50, startWidth + (moveEvent.clientX - startX)));
		};
		const onMouseUp = () => {
			document.removeEventListener("mousemove", onMouseMove);
			document.removeEventListener("mouseup", onMouseUp);
		};
		document.addEventListener("mousemove", onMouseMove);
		document.addEventListener("mouseup", onMouseUp);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("th", {
		style: {
			position: "relative",
			width: `${width}px`,
			...style
		},
		children: [children, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "ce-col-resize-handle",
			onMouseDown: handleMouseDown
		})]
	});
}
function BOLGrid({ task, subtask, dispatch }) {
	const { BOL: masterlistBOL } = useMasterlist();
	const datalistId = (0, import_react.useState)(() => uid("dl"))[0];
	const [draftRows, setDraftRows] = (0, import_react.useState)([emptyBOLDraft(uid("bol-draft"))]);
	const { widths, updateWidth } = useResizableColumns("bol-bd-col-widths", {
		role: 180,
		dayType: 110,
		shift: 90,
		qty: 70,
		days: 70,
		rate: 100,
		otHrs: 80,
		perDiem: 90,
		allowance: 90,
		subtotal: 110,
		action: 50
	});
	const allRows = (0, import_react.useMemo)(() => {
		const existing = subtask.items.BOL.map((it) => ({
			...it,
			isDraft: false
		}));
		const drafts = draftRows.map((r) => ({
			...r,
			isDraft: true
		}));
		return [...existing, ...drafts];
	}, [subtask.items.BOL, draftRows]);
	const updateRow = (row, field, value) => {
		if (!row.isDraft) dispatch({
			type: "UPDATE_ITEM",
			taskId: task.id,
			subtaskId: subtask.id,
			category: "BOL",
			itemId: row.id,
			patch: { [field]: value }
		});
		else setDraftRows((prev) => prev.map((r) => r.id === row.id ? {
			...r,
			[field]: value
		} : r));
	};
	const appendRowIfLast = (row) => {
		if (!row.isDraft) return;
		const lastDraft = draftRows[draftRows.length - 1];
		if (row.id === lastDraft.id) setDraftRows((prev) => [...prev, emptyBOLDraft(uid("bol-draft"))]);
	};
	const removeRow = (row) => {
		if (row.isDraft) setDraftRows((prev) => {
			if (prev.length === 1) return prev;
			return prev.filter((r) => r.id !== row.id);
		});
		else dispatch({
			type: "DELETE_ITEM",
			taskId: task.id,
			subtaskId: subtask.id,
			category: "BOL",
			itemId: row.id
		});
	};
	const handleSave = () => {
		const newItems = draftRows.filter((r) => r.role.trim() && Number(r.qty) > 0 && Number(r.days) > 0 && Number(r.rate) > 0).map((r) => ({
			id: uid("bol-item"),
			masterlistId: r.masterlistId,
			role: r.role.trim(),
			dayType: r.dayType,
			shift: r.shift,
			qty: Number(r.qty),
			days: Number(r.days),
			rate: Number(r.rate),
			otHrs: Number(r.otHrs) || 0,
			perDiem: Number(r.perDiem) || 0,
			allowance: Number(r.allowance) || 0
		}));
		if (newItems.length > 0) dispatch({
			type: "ADD_ITEMS",
			taskId: task.id,
			subtaskId: subtask.id,
			category: "BOL",
			items: newItems
		});
		setDraftRows([emptyBOLDraft(uid("bol-draft"))]);
	};
	const totals = subtask.items.BOL.reduce((acc, it) => {
		const c = calcBOL(it);
		acc.labor += c.labor;
		acc.benefits += c.benefits;
		acc.total += c.subtotal;
		return acc;
	}, {
		labor: 0,
		benefits: 0,
		total: 0
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "ce-card ce-bol-card",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "ce-card-header",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "ce-chip",
					children: "BOL — BILL OF LABOR"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "ce-card-header-stats",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Labor: ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
							className: "ce-mono",
							children: fmt(totals.labor)
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Benefits: ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
							className: "ce-mono",
							children: fmt(totals.benefits)
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
							className: "ce-mono ce-total",
							children: fmt(totals.total)
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("datalist", {
				id: datalistId,
				children: masterlistBOL.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: l.role }, l.id))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "ce-gridwrap",
				style: {
					maxHeight: "300px",
					overflowY: "auto",
					overflowX: "auto"
				},
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
					className: "ce-grid ce-bol-breakdown-table",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResizableTh, {
								colKey: "role",
								width: widths.role,
								onResize: updateWidth,
								children: "Role / Position"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResizableTh, {
								colKey: "dayType",
								width: widths.dayType,
								onResize: updateWidth,
								children: "Day Type"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResizableTh, {
								colKey: "shift",
								width: widths.shift,
								onResize: updateWidth,
								children: "Shift"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResizableTh, {
								colKey: "qty",
								width: widths.qty,
								onResize: updateWidth,
								children: "Qty"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResizableTh, {
								colKey: "days",
								width: widths.days,
								onResize: updateWidth,
								children: "Days"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResizableTh, {
								colKey: "rate",
								width: widths.rate,
								onResize: updateWidth,
								children: "Rate/Day"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResizableTh, {
								colKey: "otHrs",
								width: widths.otHrs,
								onResize: updateWidth,
								children: "OT Hrs"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResizableTh, {
								colKey: "perDiem",
								width: widths.perDiem,
								onResize: updateWidth,
								children: "Per Diem"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResizableTh, {
								colKey: "allowance",
								width: widths.allowance,
								onResize: updateWidth,
								children: "Allowance"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResizableTh, {
								colKey: "subtotal",
								width: widths.subtotal,
								onResize: updateWidth,
								children: "Subtotal"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResizableTh, {
								colKey: "action",
								width: widths.action,
								onResize: updateWidth
							})
						] }) }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: allRows.map((row, index) => {
							const isLast = index === allRows.length - 1;
							row.isDraft || calcBOL(row);
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
								className: isLast && row.isDraft ? "ce-grid-row-ghost" : void 0,
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										className: "ce-grid-input",
										list: datalistId,
										value: row.role,
										placeholder: row.isDraft ? "Type role…" : "",
										onChange: (e) => {
											updateRow(row, "role", e.target.value);
											appendRowIfLast(row);
										},
										onFocus: () => appendRowIfLast(row)
									}) }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
										className: "ce-grid-select",
										value: row.dayType,
										onChange: (e) => {
											updateRow(row, "dayType", e.target.value);
											appendRowIfLast(row);
										},
										onFocus: () => appendRowIfLast(row),
										children: DAY_TYPES.map((d) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: d,
											children: d
										}, d))
									}) }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
										className: "ce-grid-select",
										value: row.shift,
										onChange: (e) => {
											updateRow(row, "shift", e.target.value);
											appendRowIfLast(row);
										},
										onFocus: () => appendRowIfLast(row),
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: "Day",
											children: "Day"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: "Night",
											children: "Night"
										})]
									}) }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										min: "0",
										className: "ce-grid-input",
										value: row.qty,
										onChange: (e) => {
											updateRow(row, "qty", e.target.value);
											appendRowIfLast(row);
										},
										onFocus: () => appendRowIfLast(row)
									}) }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										min: "0",
										className: "ce-grid-input",
										value: row.days,
										onChange: (e) => {
											updateRow(row, "days", e.target.value);
											appendRowIfLast(row);
										},
										onFocus: () => appendRowIfLast(row)
									}) }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										min: "0",
										className: "ce-grid-input",
										value: row.rate,
										onChange: (e) => {
											updateRow(row, "rate", e.target.value);
											appendRowIfLast(row);
										},
										onFocus: () => appendRowIfLast(row)
									}) }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										min: "0",
										className: "ce-grid-input",
										value: row.otHrs,
										onChange: (e) => {
											updateRow(row, "otHrs", e.target.value);
											appendRowIfLast(row);
										},
										onFocus: () => appendRowIfLast(row)
									}) }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										min: "0",
										className: "ce-grid-input",
										value: row.perDiem,
										onChange: (e) => {
											updateRow(row, "perDiem", e.target.value);
											appendRowIfLast(row);
										},
										onFocus: () => appendRowIfLast(row)
									}) }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										min: "0",
										className: "ce-grid-input",
										value: row.allowance,
										onChange: (e) => {
											updateRow(row, "allowance", e.target.value);
											appendRowIfLast(row);
										},
										onFocus: () => appendRowIfLast(row)
									}) }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "ce-grid-subtotal",
										children: row.isDraft ? "—" : fmt(calcBOL(row).subtotal)
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "ce-grid-del",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconBtn, {
											danger: true,
											title: "Remove row",
											confirm: row.isDraft ? false : "Remove this labor row? This cannot be undone.",
											onClick: () => removeRow(row),
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { size: 14 })
										})
									})
								]
							}, row.id);
						}) }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("tfoot", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "ce-grid-foot",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									colSpan: 9,
									children: "Labor Total"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "ce-grid-subtotal",
									children: fmt(totals.total)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {})
							]
						}) })
					]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "ce-form-footer",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "ce-form-footer-actions",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						className: "ce-btn-primary",
						onClick: handleSave,
						type: "button",
						children: "Save"
					})
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "ce-assumption",
				style: { padding: "0 0.9rem 0.7rem" },
				children: "Sun/Special ×1.30 · Holiday ×2.00 · Night differential +10% · OT premium ×1.25"
			})
		]
	});
}
function BOTEForm({ task, subtask, dispatch, items }) {
	const { BOTE: masterlistBOTE } = useMasterlist();
	const datalistId = (0, import_react.useState)(() => uid("dl"))[0];
	const [draftRows, setDraftRows] = (0, import_react.useState)([{
		id: uid("bote-draft"),
		description: "",
		qty: "",
		days: "",
		rate: ""
	}]);
	const { widths, updateWidth } = useResizableColumns("bote-col-widths", {
		itemNo: 55,
		description: 250,
		qty: 80,
		days: 80,
		rate: 110,
		subtotal: 120,
		action: 50
	});
	const allRows = (0, import_react.useMemo)(() => {
		const existing = items.map((it) => ({
			...it,
			isDraft: false
		}));
		const drafts = draftRows.map((r) => ({
			...r,
			isDraft: true
		}));
		return [...existing, ...drafts];
	}, [items, draftRows]);
	const updateRow = (row, field, value) => {
		if (!row.isDraft) dispatch({
			type: "UPDATE_ITEM",
			taskId: task.id,
			subtaskId: subtask.id,
			category: "BOTE",
			itemId: row.id,
			patch: { [field]: value }
		});
		else setDraftRows((prev) => prev.map((r) => r.id === row.id ? {
			...r,
			[field]: value
		} : r));
	};
	const appendRowIfLast = (row) => {
		if (!row.isDraft) return;
		const lastDraft = draftRows[draftRows.length - 1];
		if (row.id === lastDraft.id) setDraftRows((prev) => [...prev, {
			id: uid("bote-draft"),
			description: "",
			qty: "",
			days: "",
			rate: ""
		}]);
	};
	const removeRow = (row) => {
		if (row.isDraft) setDraftRows((prev) => {
			if (prev.length === 1) return prev;
			return prev.filter((r) => r.id !== row.id);
		});
		else dispatch({
			type: "DELETE_ITEM",
			taskId: task.id,
			subtaskId: subtask.id,
			category: "BOTE",
			itemId: row.id
		});
	};
	const handleSave = () => {
		const newItems = draftRows.filter((r) => r.description.trim() && Number(r.qty) > 0 && Number(r.days) > 0 && Number(r.rate) > 0).map((r) => ({
			id: uid("bote-item"),
			description: r.description.trim(),
			qty: Number(r.qty),
			days: Number(r.days),
			rate: Number(r.rate)
		}));
		if (newItems.length > 0) dispatch({
			type: "ADD_ITEMS",
			taskId: task.id,
			subtaskId: subtask.id,
			category: "BOTE",
			items: newItems
		});
		setDraftRows([{
			id: uid("bote-draft"),
			description: "",
			qty: "",
			days: "",
			rate: ""
		}]);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "ce-form",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("datalist", {
				id: datalistId,
				children: masterlistBOTE.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: l.description }, l.id))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "ce-gridwrap",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
					className: "ce-grid",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ResizableTh, {
							colKey: "itemNo",
							width: widths.itemNo,
							onResize: updateWidth,
							style: { textAlign: "center" },
							children: [
								"Item",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
								"No."
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResizableTh, {
							colKey: "description",
							width: widths.description,
							onResize: updateWidth,
							children: "Item Description"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResizableTh, {
							colKey: "qty",
							width: widths.qty,
							onResize: updateWidth,
							children: "Qty"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResizableTh, {
							colKey: "days",
							width: widths.days,
							onResize: updateWidth,
							children: "No. of Days"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResizableTh, {
							colKey: "rate",
							width: widths.rate,
							onResize: updateWidth,
							children: "Daily Rate"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResizableTh, {
							colKey: "subtotal",
							width: widths.subtotal,
							onResize: updateWidth,
							children: "Subtotal"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResizableTh, {
							colKey: "action",
							width: widths.action,
							onResize: updateWidth
						})
					] }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: allRows.map((row, index) => {
						const lineTotal = Number(row.qty) * Number(row.days) * Number(row.rate);
						const isLast = index === allRows.length - 1;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: isLast && row.isDraft ? "ce-grid-row-ghost" : void 0,
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "ce-center",
									style: { fontWeight: "bold" },
									children: index + 1
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									className: "ce-grid-input",
									list: datalistId,
									value: row.description,
									placeholder: row.isDraft ? "Type item…" : "",
									onChange: (e) => {
										updateRow(row, "description", e.target.value);
										appendRowIfLast(row);
									},
									onFocus: () => appendRowIfLast(row)
								}) }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "number",
									min: "0",
									className: "ce-grid-input",
									value: row.qty,
									onChange: (e) => {
										updateRow(row, "qty", e.target.value);
										appendRowIfLast(row);
									},
									onFocus: () => appendRowIfLast(row)
								}) }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "number",
									min: "0",
									className: "ce-grid-input",
									value: row.days,
									onChange: (e) => {
										updateRow(row, "days", e.target.value);
										appendRowIfLast(row);
									},
									onFocus: () => appendRowIfLast(row)
								}) }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "number",
									min: "0",
									className: "ce-grid-input",
									value: row.rate,
									onChange: (e) => {
										updateRow(row, "rate", e.target.value);
										appendRowIfLast(row);
									},
									onFocus: () => appendRowIfLast(row)
								}) }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "ce-grid-subtotal",
									children: fmt(lineTotal)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "ce-grid-del",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconBtn, {
										danger: true,
										title: "Remove row",
										onClick: () => removeRow(row),
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { size: 14 })
									})
								})
							]
						}, row.id);
					}) })]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "ce-form-footer",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "ce-form-footer-actions",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						className: "ce-btn-primary",
						onClick: handleSave,
						children: "Save"
					})
				})
			})
		]
	});
}
function BOCMForm({ task, subtask, dispatch, items }) {
	const { BOCM: masterlistBOCM } = useMasterlist();
	const datalistId = (0, import_react.useState)(() => uid("dl"))[0];
	const [draftRows, setDraftRows] = (0, import_react.useState)([{
		id: uid("bocm-draft"),
		description: "",
		qty: "",
		unit: "",
		unitCost: ""
	}]);
	const { widths, updateWidth } = useResizableColumns("bocm-col-widths", {
		itemNo: 55,
		description: 250,
		qty: 80,
		unit: 90,
		unitCost: 110,
		subtotal: 120,
		action: 50
	});
	const allRows = (0, import_react.useMemo)(() => {
		const existing = items.map((it) => ({
			...it,
			isDraft: false
		}));
		const drafts = draftRows.map((r) => ({
			...r,
			isDraft: true
		}));
		return [...existing, ...drafts];
	}, [items, draftRows]);
	const updateRow = (row, field, value) => {
		if (!row.isDraft) dispatch({
			type: "UPDATE_ITEM",
			taskId: task.id,
			subtaskId: subtask.id,
			category: "BOCM",
			itemId: row.id,
			patch: { [field]: value }
		});
		else setDraftRows((prev) => prev.map((r) => r.id === row.id ? {
			...r,
			[field]: value
		} : r));
	};
	const appendRowIfLast = (row) => {
		if (!row.isDraft) return;
		const lastDraft = draftRows[draftRows.length - 1];
		if (row.id === lastDraft.id) setDraftRows((prev) => [...prev, {
			id: uid("bocm-draft"),
			description: "",
			qty: "",
			unit: "",
			unitCost: ""
		}]);
	};
	const removeRow = (row) => {
		if (row.isDraft) setDraftRows((prev) => {
			if (prev.length === 1) return prev;
			return prev.filter((r) => r.id !== row.id);
		});
		else dispatch({
			type: "DELETE_ITEM",
			taskId: task.id,
			subtaskId: subtask.id,
			category: "BOCM",
			itemId: row.id
		});
	};
	const handleSave = () => {
		const newItems = draftRows.filter((r) => r.description.trim() && Number(r.qty) > 0 && Number(r.unitCost) > 0).map((r) => ({
			id: uid("bocm-item"),
			description: r.description.trim(),
			qty: Number(r.qty),
			unit: r.unit.trim() || "unit",
			unitCost: Number(r.unitCost)
		}));
		if (newItems.length > 0) dispatch({
			type: "ADD_ITEMS",
			taskId: task.id,
			subtaskId: subtask.id,
			category: "BOCM",
			items: newItems
		});
		setDraftRows([{
			id: uid("bocm-draft"),
			description: "",
			qty: "",
			unit: "",
			unitCost: ""
		}]);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "ce-form",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("datalist", {
				id: datalistId,
				children: masterlistBOCM.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: l.description }, l.id))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "ce-gridwrap",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
					className: "ce-grid",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ResizableTh, {
							colKey: "itemNo",
							width: widths.itemNo,
							onResize: updateWidth,
							style: { textAlign: "center" },
							children: [
								"Item",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
								"No."
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResizableTh, {
							colKey: "description",
							width: widths.description,
							onResize: updateWidth,
							children: "Item Description"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResizableTh, {
							colKey: "qty",
							width: widths.qty,
							onResize: updateWidth,
							children: "Qty"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResizableTh, {
							colKey: "unit",
							width: widths.unit,
							onResize: updateWidth,
							children: "Unit"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResizableTh, {
							colKey: "unitCost",
							width: widths.unitCost,
							onResize: updateWidth,
							children: "Unit Cost"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResizableTh, {
							colKey: "subtotal",
							width: widths.subtotal,
							onResize: updateWidth,
							children: "Subtotal"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResizableTh, {
							colKey: "action",
							width: widths.action,
							onResize: updateWidth
						})
					] }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: allRows.map((row, index) => {
						const lineTotal = Number(row.qty) * Number(row.unitCost);
						const isLast = index === allRows.length - 1;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: isLast && row.isDraft ? "ce-grid-row-ghost" : void 0,
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "ce-center",
									style: { fontWeight: "bold" },
									children: index + 1
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									className: "ce-grid-input",
									list: datalistId,
									value: row.description,
									placeholder: row.isDraft ? "Type item…" : "",
									onChange: (e) => {
										updateRow(row, "description", e.target.value);
										appendRowIfLast(row);
									},
									onFocus: () => appendRowIfLast(row)
								}) }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "number",
									min: "0",
									className: "ce-grid-input",
									value: row.qty,
									onChange: (e) => {
										updateRow(row, "qty", e.target.value);
										appendRowIfLast(row);
									},
									onFocus: () => appendRowIfLast(row)
								}) }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									className: "ce-grid-input",
									value: row.unit,
									placeholder: row.isDraft ? "kg / gal / pc" : "",
									onChange: (e) => {
										updateRow(row, "unit", e.target.value);
										appendRowIfLast(row);
									},
									onFocus: () => appendRowIfLast(row)
								}) }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "number",
									min: "0",
									className: "ce-grid-input",
									value: row.unitCost,
									onChange: (e) => {
										updateRow(row, "unitCost", e.target.value);
										appendRowIfLast(row);
									},
									onFocus: () => appendRowIfLast(row)
								}) }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "ce-grid-subtotal",
									children: fmt(lineTotal)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "ce-grid-del",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconBtn, {
										danger: true,
										title: "Remove row",
										onClick: () => removeRow(row),
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { size: 14 })
									})
								})
							]
						}, row.id);
					}) })]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "ce-form-footer",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "ce-form-footer-actions",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						className: "ce-btn-primary",
						onClick: handleSave,
						children: "Save"
					})
				})
			})
		]
	});
}
function PPEForm({ task, subtask, dispatch, items }) {
	const { PPE: masterlistPPE } = useMasterlist();
	const datalistId = (0, import_react.useState)(() => uid("dl"))[0];
	const [draftRows, setDraftRows] = (0, import_react.useState)([{
		id: uid("ppe-draft"),
		item: "",
		qty: "",
		unitCost: ""
	}]);
	const { widths, updateWidth } = useResizableColumns("ppe-col-widths", {
		itemNo: 55,
		item: 250,
		qty: 80,
		unitCost: 110,
		subtotal: 120,
		action: 50
	});
	const allRows = (0, import_react.useMemo)(() => {
		const existing = items.map((it) => ({
			...it,
			isDraft: false
		}));
		const drafts = draftRows.map((r) => ({
			...r,
			isDraft: true
		}));
		return [...existing, ...drafts];
	}, [items, draftRows]);
	const updateRow = (row, field, value) => {
		if (!row.isDraft) dispatch({
			type: "UPDATE_ITEM",
			taskId: task.id,
			subtaskId: subtask.id,
			category: "PPE",
			itemId: row.id,
			patch: { [field]: value }
		});
		else setDraftRows((prev) => prev.map((r) => r.id === row.id ? {
			...r,
			[field]: value
		} : r));
	};
	const appendRowIfLast = (row) => {
		if (!row.isDraft) return;
		const lastDraft = draftRows[draftRows.length - 1];
		if (row.id === lastDraft.id) setDraftRows((prev) => [...prev, {
			id: uid("ppe-draft"),
			item: "",
			qty: "",
			unitCost: ""
		}]);
	};
	const removeRow = (row) => {
		if (row.isDraft) setDraftRows((prev) => {
			if (prev.length === 1) return prev;
			return prev.filter((r) => r.id !== row.id);
		});
		else dispatch({
			type: "DELETE_ITEM",
			taskId: task.id,
			subtaskId: subtask.id,
			category: "PPE",
			itemId: row.id
		});
	};
	const handleSave = () => {
		const newItems = draftRows.filter((r) => r.item.trim() && Number(r.qty) > 0 && Number(r.unitCost) > 0).map((r) => ({
			id: uid("ppe-item"),
			item: r.item.trim(),
			qty: Number(r.qty),
			unitCost: Number(r.unitCost)
		}));
		if (newItems.length > 0) dispatch({
			type: "ADD_ITEMS",
			taskId: task.id,
			subtaskId: subtask.id,
			category: "PPE",
			items: newItems
		});
		setDraftRows([{
			id: uid("ppe-draft"),
			item: "",
			qty: "",
			unitCost: ""
		}]);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "ce-form",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("datalist", {
				id: datalistId,
				children: masterlistPPE.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: l.item }, l.id))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "ce-gridwrap",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
					className: "ce-grid",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ResizableTh, {
							colKey: "itemNo",
							width: widths.itemNo,
							onResize: updateWidth,
							style: { textAlign: "center" },
							children: [
								"Item",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
								"No."
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResizableTh, {
							colKey: "item",
							width: widths.item,
							onResize: updateWidth,
							children: "Item Description"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResizableTh, {
							colKey: "qty",
							width: widths.qty,
							onResize: updateWidth,
							children: "Qty (pax)"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResizableTh, {
							colKey: "unitCost",
							width: widths.unitCost,
							onResize: updateWidth,
							children: "Unit Cost"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResizableTh, {
							colKey: "subtotal",
							width: widths.subtotal,
							onResize: updateWidth,
							children: "Subtotal"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResizableTh, {
							colKey: "action",
							width: widths.action,
							onResize: updateWidth
						})
					] }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: allRows.map((row, index) => {
						const lineTotal = Number(row.qty) * Number(row.unitCost);
						const isLast = index === allRows.length - 1;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: isLast && row.isDraft ? "ce-grid-row-ghost" : void 0,
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "ce-center",
									style: { fontWeight: "bold" },
									children: index + 1
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									className: "ce-grid-input",
									list: datalistId,
									value: row.item,
									placeholder: row.isDraft ? "Type PPE item…" : "",
									onChange: (e) => {
										updateRow(row, "item", e.target.value);
										appendRowIfLast(row);
									},
									onFocus: () => appendRowIfLast(row)
								}) }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "number",
									min: "0",
									className: "ce-grid-input",
									value: row.qty,
									onChange: (e) => {
										updateRow(row, "qty", e.target.value);
										appendRowIfLast(row);
									},
									onFocus: () => appendRowIfLast(row)
								}) }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "number",
									min: "0",
									className: "ce-grid-input",
									value: row.unitCost,
									onChange: (e) => {
										updateRow(row, "unitCost", e.target.value);
										appendRowIfLast(row);
									},
									onFocus: () => appendRowIfLast(row)
								}) }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "ce-grid-subtotal",
									children: fmt(lineTotal)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "ce-grid-del",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconBtn, {
										danger: true,
										title: "Remove row",
										onClick: () => removeRow(row),
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { size: 14 })
									})
								})
							]
						}, row.id);
					}) })]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "ce-form-footer",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "ce-form-footer-actions",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						className: "ce-btn-primary",
						onClick: handleSave,
						children: "Save"
					})
				})
			})
		]
	});
}
var MISC_PRELOAD = [
	{
		section: "A",
		title: "ACCOMMODATION",
		items: [
			"House Rental (Admin)",
			"House Rental (Manpower)",
			"Electric Fan",
			"Dispenser",
			"Refill",
			"Dues",
			"Hotel",
			"Foam",
			"Water",
			"Meal Allowance"
		]
	},
	{
		section: "B",
		title: "TRANSPORTATION (DAILY)",
		items: [
			"Diesel",
			"Vehicle Hilux/Pickup (PM)",
			"Vehicle Hilux/Pickup (Admin)",
			"Vehicle Van (Admin)",
			"Vehicle Traviz/L300 (Admin) — Isuzu Traviz",
			"Vehicle Traviz/L300 (Manpower) — Isuzu Traviz"
		]
	},
	{
		section: "C",
		title: "REQUIREMENTS",
		items: [
			"Medical",
			"Brgy. Clearance",
			"Police Clearance",
			"NBI Clearance"
		]
	},
	{
		section: "D",
		title: "ADMIN COST",
		items: [
			"Office Supplies",
			"Janitorial Supplies",
			"Site Inspection (Pre-Bid)",
			"Vehicle Traviz (Site Inspection) — Isuzu Traviz",
			"Diesel (Site Inspection)",
			"Toll Fee (Site Inspection)",
			"Meal Allowance",
			"Representation",
			"Bank Charges"
		]
	},
	{
		section: "E",
		title: "THIRD PARTY SERVICES",
		items: ["Third Party Services (as required)"]
	}
];
function BreakdownMiscPanel({ task, subtask, dispatch, open, onToggle }) {
	const { widths, updateWidth } = useResizableColumns("misc-breakdown-col-widths", {
		itemNo: 55,
		description: 250,
		qty: 80,
		unit: 90,
		unitPrice: 110,
		total: 120,
		action: 50
	});
	const [draftRows, setDraftRows] = (0, import_react.useState)(() => {
		const existing = subtask.items.MISC || [];
		if (existing.length > 0 && existing[0].section) return existing;
		const flat = [];
		MISC_PRELOAD.forEach((sec) => sec.items.forEach((desc, idx) => flat.push({
			id: uid(`misc-${sec.section}-${idx}`),
			section: sec.section,
			sectionTitle: sec.title,
			description: desc,
			qty: 0,
			unitCost: 0,
			days: 1
		})));
		return flat;
	});
	const [hideSections, setHideSections] = (0, import_react.useState)({});
	const [expandedSections, setExpandedSections] = (0, import_react.useState)({});
	const updateRow = (id, patch) => {
		setDraftRows((rows) => rows.map((r) => r.id === id ? {
			...r,
			...patch
		} : r));
	};
	const insertRowBelow = (afterId) => {
		setDraftRows((rows) => {
			const idx = rows.findIndex((r) => r.id === afterId);
			if (idx === -1) return rows;
			const afterRow = rows[idx];
			const newRow = {
				id: uid(`misc-insert-${afterRow.section}`),
				section: afterRow.section,
				sectionTitle: afterRow.sectionTitle,
				description: "",
				qty: 0,
				unitCost: 0,
				days: 1
			};
			const next = [...rows];
			next.splice(idx + 1, 0, newRow);
			return next;
		});
	};
	const saveGroup = (section) => {
		const groupRows = draftRows.filter((r) => r.section === section);
		dispatch({
			type: "REPLACE_CATEGORY_ITEMS",
			taskId: task.id,
			subtaskId: subtask.id,
			category: "MISC",
			items: groupRows
		});
	};
	const grouped = MISC_PRELOAD.map((sec) => {
		const allRows = draftRows.filter((r) => r.section === sec.section);
		const visibleRows = hideSections[sec.section] ? allRows.filter((r) => num(r.qty) !== 0 || num(r.unitCost) !== 0 || num(r.days) !== 1) : allRows;
		const isExpanded = expandedSections[sec.section] || false;
		const displayRows = isExpanded ? visibleRows : [];
		return {
			...sec,
			rows: displayRows,
			totalRows: visibleRows.length,
			isExpanded
		};
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "ce-card",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "ce-card-header ce-card-header-compact ce-accordion-header",
			onClick: onToggle,
			style: { cursor: "pointer" },
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "ce-chip",
				children: "MISC — BREAKDOWN"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				style: {
					display: "flex",
					alignItems: "center",
					gap: "0.5rem"
				},
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
					className: "ce-mono",
					children: fmt(categoryTotal(draftRows, "MISC"))
				}), open ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { size: 16 }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { size: 16 })]
			})]
		}), open && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "ce-subtask-body",
			style: { padding: "0.85rem" },
			children: grouped.map((sec) => {
				const showDays = sec.section === "B" || sec.section === "D" || sec.section === "E";
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "misc-group",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "misc-group-header",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							className: "misc-expand-btn",
							onClick: () => setExpandedSections((prev) => ({
								...prev,
								[sec.section]: !prev[sec.section]
							})),
							type: "button",
							children: [
								sec.isExpanded ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { size: 16 }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { size: 16 }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "ce-serif misc-group-title",
									children: [
										sec.section,
										". ",
										sec.title
									]
								}),
								!sec.isExpanded && sec.totalRows > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "misc-collapsed-hint",
									children: [
										"+",
										sec.totalRows,
										" more"
									]
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "misc-group-actions",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								className: "ce-btn-ghost ce-btn-sm",
								onClick: () => saveGroup(sec.section),
								type: "button",
								children: "Save Group"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								className: "ce-btn-ghost ce-btn-sm misc-hide-btn",
								onClick: () => setHideSections((prev) => ({
									...prev,
									[sec.section]: !prev[sec.section]
								})),
								type: "button",
								children: hideSections[sec.section] ? "Show All" : "Hide Unused"
							})]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "ce-table-scroll",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
							className: "ce-table misc-table",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ResizableTh, {
									colKey: "itemNo",
									width: widths.itemNo,
									onResize: updateWidth,
									style: { textAlign: "center" },
									children: [
										"Item",
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
										"No."
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResizableTh, {
									colKey: "description",
									width: widths.description,
									onResize: updateWidth,
									children: "Description"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResizableTh, {
									colKey: "qty",
									width: widths.qty,
									onResize: updateWidth,
									children: "QTY"
								}),
								sec.section === "A" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResizableTh, {
									colKey: "unit",
									width: widths.unit,
									onResize: updateWidth,
									children: "UNIT"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResizableTh, {
									colKey: "unitPrice",
									width: widths.unitPrice,
									onResize: updateWidth,
									children: "Unit Price"
								}),
								showDays && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "ce-right",
									style: { width: "100px" },
									children: "No. of Days"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResizableTh, {
									colKey: "total",
									width: widths.total,
									onResize: updateWidth,
									children: "Total"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResizableTh, {
									colKey: "action",
									width: widths.action,
									onResize: updateWidth
								})
							] }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: sec.rows.map((r, idx) => {
								const lineTotal = showDays ? num(r.qty) * num(r.days) * num(r.unitCost) : num(r.qty) * num(r.unitCost);
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "ce-center",
										children: idx + 1
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										className: "ce-input misc-desc-input",
										value: r.description,
										onChange: (e) => updateRow(r.id, { description: e.target.value }),
										placeholder: "Description"
									}) }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										min: "0",
										className: "ce-input ce-right misc-qty-input",
										value: r.qty,
										onChange: (e) => updateRow(r.id, { qty: e.target.value })
									}) }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										min: "0",
										className: "ce-input ce-right misc-unit-input",
										value: r.unitCost,
										onChange: (e) => updateRow(r.id, { unitCost: e.target.value })
									}) }),
									showDays && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										min: "0",
										className: "ce-input ce-right misc-days-input",
										value: r.days,
										onChange: (e) => updateRow(r.id, { days: e.target.value })
									}) }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "ce-right ce-mono misc-total-cell",
										children: fmt(lineTotal)
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										className: "ce-btn-ghost ce-btn-sm misc-insert-btn",
										onClick: () => insertRowBelow(r.id),
										type: "button",
										title: "Insert row below",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { size: 13 }), " Insert"]
									}) })
								] }, r.id);
							}) })]
						})
					})]
				}, sec.section);
			})
		})]
	});
}
function CategoryCard({ category, task, subtask, dispatch }) {
	const meta = CATEGORY_META[category];
	const Icon = meta.icon;
	const items = subtask.items[category];
	const total = categoryTotal(items, category);
	const [open, setOpen] = (0, import_react.useState)(false);
	const toggleOpen = () => setOpen(!open);
	if ([
		"BOL",
		"BOTE",
		"BOCM",
		"PPE"
	].includes(category)) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "ce-card",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "ce-card-header ce-card-header-compact ce-accordion-header",
			onClick: toggleOpen,
			style: { cursor: "pointer" },
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "ce-chip",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
					size: 11,
					style: {
						marginRight: 4,
						verticalAlign: -2
					}
				}), meta.short]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				style: {
					display: "flex",
					alignItems: "center",
					gap: "0.5rem"
				},
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
					className: "ce-mono",
					children: fmt(total)
				}), open ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { size: 16 }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { size: 16 })]
			})]
		}), open && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
			category === "BOL" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BOLGrid, {
				task,
				subtask,
				dispatch
			}),
			category === "BOTE" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BOTEForm, {
				task,
				subtask,
				dispatch,
				items
			}),
			category === "BOCM" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BOCMForm, {
				task,
				subtask,
				dispatch,
				items
			}),
			category === "PPE" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PPEForm, {
				task,
				subtask,
				dispatch,
				items
			})
		] })]
	});
	if (category === "MISC") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BreakdownMiscPanel, {
		task,
		subtask,
		dispatch,
		open,
		onToggle: toggleOpen
	});
	return null;
}
function SubtaskCard({ task, subtask, dispatch }) {
	const total = subtaskTotal(subtask);
	const duration = (0, import_react.useMemo)(() => {
		let maxDays = 0;
		CATS.forEach((c) => {
			(subtask.items[c] || []).forEach((it) => {
				if (num(it.days) > maxDays) maxDays = num(it.days);
			});
		});
		return maxDays || 1;
	}, [subtask.items]);
	const parentSubtasks = task.subtasks.filter((s) => s.id !== subtask.id);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "ce-subtask",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "ce-subtask-header",
			onClick: () => dispatch({
				type: "TOGGLE_SUBTASK",
				taskId: task.id,
				subtaskId: subtask.id
			}),
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "ce-subtask-header-left",
				children: [
					subtask.expanded ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { size: 16 }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { size: 16 }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						onClick: (e) => e.stopPropagation(),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EditableTitle, {
							value: subtask.title,
							onSave: (v) => dispatch({
								type: "RENAME_SUBTASK",
								taskId: task.id,
								subtaskId: subtask.id,
								title: v
							}),
							className: "ce-subtask-title"
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "ce-task-count",
						children: [
							"(",
							duration,
							" day",
							duration !== 1 ? "s" : "",
							")"
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "ce-subtask-meta",
						onClick: (e) => e.stopPropagation(),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
							value: subtask.type,
							onChange: (e) => dispatch({
								type: "SET_SUBTASK_TYPE",
								taskId: task.id,
								subtaskId: subtask.id,
								subtaskType: e.target.value
							}),
							className: "ce-task-type-select",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "Sequential",
								children: "Sequential"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "Parallel",
								children: "Parallel"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
							value: subtask.predecessor || "",
							onChange: (e) => dispatch({
								type: "SET_SUBTASK_PREDECESSOR",
								taskId: task.id,
								subtaskId: subtask.id,
								predecessorId: e.target.value || null
							}),
							className: "ce-task-type-select",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "",
								children: "None"
							}), parentSubtasks.map((ps) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: ps.id,
								children: ps.title
							}, ps.id))]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
						className: "ce-mono ce-total",
						children: fmt(total)
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "ce-subtask-header-right",
				onClick: (e) => e.stopPropagation(),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					className: "ce-btn-ghost ce-btn-sm ce-add-t",
					type: "button",
					title: "Add a subtask after this one",
					"aria-label": "Add subtask after this one",
					onClick: () => dispatch({
						type: "ADD_SUBTASK",
						taskId: task.id,
						afterId: subtask.id,
						title: `Sub task ${task.subtasks.length + 1}`
					}),
					children: "+t"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconBtn, {
					danger: true,
					title: "Delete subtask",
					confirm: "Delete this subtask and all of its filled resources? This cannot be undone.",
					onClick: () => dispatch({
						type: "DELETE_SUBTASK",
						taskId: task.id,
						subtaskId: subtask.id
					}),
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { size: 15 })
				})]
			})]
		}), subtask.expanded && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "ce-subtask-body",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "ce-cat-stack",
				children: [
					"BOL",
					"BOTE",
					"BOCM",
					"PPE",
					"MISC"
				].map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "ce-cat-item",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CategoryCard, {
						category: c,
						task,
						subtask,
						dispatch
					})
				}, c))
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NotesAndFilesBlock, {
				label: subtask.title || "subtask",
				notes: subtask.notes,
				files: subtask.files,
				onNotes: (notes) => dispatch({
					type: "SET_SUBTASK_NOTES",
					taskId: task.id,
					subtaskId: subtask.id,
					notes
				}),
				onAddFiles: (files) => dispatch({
					type: "ADD_SUBTASK_FILES",
					taskId: task.id,
					subtaskId: subtask.id,
					files
				}),
				onRemoveFile: (fileId) => dispatch({
					type: "DELETE_SUBTASK_FILE",
					taskId: task.id,
					subtaskId: subtask.id,
					fileId
				})
			})]
		})]
	});
}
function TaskAccordion({ t, dispatch, allTasks }) {
	const total = taskTotal(t);
	function addSubtask(afterId) {
		dispatch({
			type: "ADD_SUBTASK",
			taskId: t.id,
			afterId: afterId || null,
			title: `Sub task ${t.subtasks.length + 1}`
		});
		if (!t.expanded) dispatch({
			type: "TOGGLE_TASK",
			taskId: t.id
		});
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "ce-card ce-task",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "ce-task-header",
			onClick: () => dispatch({
				type: "TOGGLE_TASK",
				taskId: t.id
			}),
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "ce-task-header-left",
				children: [
					t.expanded ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { size: 18 }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { size: 18 }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						onClick: (e) => e.stopPropagation(),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EditableTitle, {
							value: t.title,
							onSave: (v) => dispatch({
								type: "RENAME_TASK",
								taskId: t.id,
								title: v
							}),
							className: "ce-task-title",
							serif: true
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "ce-task-count",
						children: [
							t.subtasks.length,
							" item",
							t.subtasks.length === 1 ? "" : "s"
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "ce-subtask-meta",
						onClick: (e) => e.stopPropagation(),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "number",
							min: "0",
							value: t.duration,
							onChange: (e) => dispatch({
								type: "SET_TASK_DURATION",
								taskId: t.id,
								duration: e.target.value
							}),
							placeholder: "Days",
							className: "ce-task-duration-input"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
							value: t.predecessor || "",
							onChange: (e) => dispatch({
								type: "SET_TASK_PREDECESSOR",
								taskId: t.id,
								predecessorId: e.target.value || null
							}),
							className: "ce-task-type-select",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "",
								children: "None"
							}), allTasks.filter((other) => other.id !== t.id).map((other) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: other.id,
								children: other.title
							}, other.id))]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
						className: "ce-mono ce-total ce-total-lg",
						children: fmt(total)
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "ce-task-header-right",
				onClick: (e) => e.stopPropagation(),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					className: "ce-btn-ghost ce-btn-sm ce-add-t",
					onClick: () => addSubtask(),
					type: "button",
					title: "Add subtask",
					"aria-label": "Add subtask",
					children: "+t"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconBtn, {
					danger: true,
					title: "Delete task",
					confirm: "Delete this main task and all of its subtasks and resources? This cannot be undone.",
					onClick: () => dispatch({
						type: "DELETE_TASK",
						taskId: t.id
					}),
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { size: 16 })
				})]
			})]
		}), t.expanded && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "ce-task-body",
			children: [t.subtasks.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SubtaskCard, {
				task: t,
				subtask: s,
				dispatch
			}, s.id)), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NotesAndFilesBlock, {
				label: t.title || "main task",
				notes: t.notes,
				files: t.files,
				onNotes: (notes) => dispatch({
					type: "SET_TASK_NOTES",
					taskId: t.id,
					notes
				}),
				onAddFiles: (files) => dispatch({
					type: "ADD_TASK_FILES",
					taskId: t.id,
					files
				}),
				onRemoveFile: (fileId) => dispatch({
					type: "DELETE_TASK_FILE",
					taskId: t.id,
					fileId
				})
			})]
		})]
	});
}
function BreakdownView({ tasks, dispatch, goToLibrary, goToSearch }) {
	const [addingTask, setAddingTask] = (0, import_react.useState)(false);
	const [titleDraft, setTitleDraft] = (0, import_react.useState)("");
	function submitTask() {
		const title = titleDraft.trim();
		if (!title) {
			setAddingTask(false);
			return;
		}
		dispatch({
			type: "ADD_TASK",
			title
		});
		setTitleDraft("");
		setAddingTask(false);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "ce-section-header",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
			className: "ce-serif ce-section-title",
			children: "Task breakdown"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			className: "ce-btn-ghost",
			onClick: () => setAddingTask(true),
			type: "button",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { size: 15 }), " Add task"]
		})]
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "ce-tasks",
		children: [
			tasks.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TaskAccordion, {
				t,
				dispatch,
				allTasks: tasks
			}, t.id)),
			tasks.length === 0 && !addingTask && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "ce-empty ce-empty-lg",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "No tasks yet — add your first task to begin the breakdown." }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					style: {
						display: "flex",
						gap: "0.75rem",
						justifyContent: "center",
						marginTop: "0.75rem"
					},
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						className: "ce-btn-ghost ce-btn-sm",
						onClick: goToLibrary,
						type: "button",
						children: "Load from Scope Library"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						className: "ce-btn-ghost ce-btn-sm",
						onClick: goToSearch,
						type: "button",
						children: "Import from Previous CE"
					})]
				})]
			}),
			addingTask && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "ce-card ce-inline-add ce-inline-add-lg",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						autoFocus: true,
						className: "ce-input",
						placeholder: "Task title (e.g. Turbine Overhaul)",
						value: titleDraft,
						onChange: (e) => setTitleDraft(e.target.value),
						onKeyDown: (e) => {
							if (e.key === "Enter") submitTask();
							if (e.key === "Escape") setAddingTask(false);
						}
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						className: "ce-btn-primary ce-btn-sm",
						onClick: submitTask,
						type: "button",
						children: "Add"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						className: "ce-btn-ghost ce-btn-sm",
						onClick: () => setAddingTask(false),
						type: "button",
						children: "Cancel"
					})
				]
			})
		]
	})] });
}
function computeSchedule(tasks) {
	const visitedTasks = /* @__PURE__ */ new Set();
	const visitingTasks = /* @__PURE__ */ new Set();
	const taskSchedule = {};
	function visitTask(taskId) {
		if (visitedTasks.has(taskId)) return;
		if (visitingTasks.has(taskId)) return;
		visitingTasks.add(taskId);
		const task = tasks.find((t) => t.id === taskId);
		if (!task) {
			visitingTasks.delete(taskId);
			return;
		}
		if (task.predecessor) visitTask(task.predecessor);
		visitingTasks.delete(taskId);
		visitedTasks.add(taskId);
		const start = (task.predecessor ? taskSchedule[task.predecessor]?.end ?? 0 : 0) + 1;
		const duration = Math.max(1, Number(task.duration) || 1);
		taskSchedule[task.id] = {
			start,
			end: start + duration - 1,
			duration
		};
	}
	tasks.forEach((t) => visitTask(t.id));
	const subtaskSchedule = {};
	tasks.forEach((task) => {
		const tStart = taskSchedule[task.id]?.start || 0;
		const visitedSub = /* @__PURE__ */ new Set();
		const visitingSub = /* @__PURE__ */ new Set();
		function visitSubtask(subtaskId) {
			if (visitedSub.has(subtaskId)) return;
			if (visitingSub.has(subtaskId)) return;
			visitingSub.add(subtaskId);
			const subtask = task.subtasks.find((s) => s.id === subtaskId);
			if (!subtask) {
				visitingSub.delete(subtaskId);
				return;
			}
			if (subtask.predecessor) visitSubtask(subtask.predecessor);
			visitingSub.delete(subtaskId);
			visitedSub.add(subtaskId);
			const predEnd = subtask.predecessor ? subtaskSchedule[`${task.id}:${subtask.predecessor}`]?.end ?? tStart - 1 : tStart - 1;
			let start;
			if (subtask.type === "Parallel") {
				start = predEnd + 1;
				start = subtask.predecessor ? subtaskSchedule[`${task.id}:${subtask.predecessor}`]?.start ?? tStart : tStart;
			} else start = predEnd + 1;
			let duration = 0;
			CATS.forEach((c) => {
				(subtask.items[c] || []).forEach((it) => {
					if (num(it.days) > duration) duration = num(it.days);
				});
			});
			if (duration < 1) duration = 1;
			subtaskSchedule[`${task.id}:${subtask.id}`] = {
				start,
				end: start + duration - 1,
				duration,
				taskId: task.id
			};
		}
		task.subtasks.forEach((s) => visitSubtask(s.id));
	});
	return {
		taskSchedule,
		subtaskSchedule
	};
}
function computePeakByCategory(tasks, category) {
	const { subtaskSchedule } = computeSchedule(tasks);
	let maxCost = 0;
	const days = {};
	tasks.forEach((t) => {
		t.subtasks.forEach((s) => {
			const sched = subtaskSchedule[`${t.id}:${s.id}`];
			if (!sched) return;
			const cost = categoryTotal(s.items[category] || [], category);
			for (let d = sched.start; d <= sched.end; d++) {
				days[d] = (days[d] || 0) + cost;
				if (days[d] > maxCost) maxCost = days[d];
			}
		});
	});
	return maxCost;
}
function getScheduledItemMap(tasks, category) {
	const { subtaskSchedule } = computeSchedule(tasks);
	const maxDay = Object.values(subtaskSchedule).reduce((max, s) => Math.max(max, s.end), 0);
	const itemMap = {};
	tasks.forEach((t) => {
		t.subtasks.forEach((st) => {
			const sched = subtaskSchedule[`${t.id}:${st.id}`];
			if (!sched) return;
			(st.items[category] || []).forEach((it) => {
				const key = category === "BOL" ? `${it.role}~${it.dayType || "Regular"}~${it.shift || "Day"}` : category === "PPE" ? it.item : it.description;
				if (!key) return;
				if (!itemMap[key]) itemMap[key] = {
					dailyQty: Array(maxDay).fill(0),
					days: /* @__PURE__ */ new Set()
				};
				const qty = num(it.qty);
				for (let d = sched.start; d <= sched.end; d++) {
					itemMap[key].dailyQty[d - 1] += qty;
					itemMap[key].days.add(d);
				}
			});
		});
	});
	const result = {};
	Object.entries(itemMap).forEach(([key, data]) => {
		result[key] = {
			maxDailyQty: Math.max(0, ...data.dailyQty),
			activeDays: data.days.size,
			totalQty: data.dailyQty.reduce((s, q) => s + q, 0)
		};
	});
	return result;
}
function SummaryView({ tasks, viewType }) {
	const [expandedTaskId, setExpandedTaskId] = (0, import_react.useState)(null);
	const noteRows = collectNotes(tasks);
	const standardCategories = [
		"A. Mobilization",
		"B. Regular",
		"C. Overtime",
		"D. Tools & Equipment",
		"E. Consumables",
		"F. PPE",
		"G. Misc"
	];
	const displayCategories = viewType === "Breakdown" ? standardCategories.map((stdLabel, index) => {
		if (index >= 2 && index <= 5 && tasks[index - 2]) return tasks[index - 2].title;
		return stdLabel;
	}) : standardCategories;
	const grandTotal = tasks.reduce((s, t) => s + taskTotal(t), 0);
	const catTotals = CATS.map((c) => ({
		cat: c,
		total: tasks.reduce((s, t) => s + t.subtasks.reduce((s2, st) => s2 + categoryTotal(st.items[c], c), 0), 0),
		peak: computePeakByCategory(tasks, c)
	}));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "ce-card ce-summary-hero",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "ce-field-label",
				children: "Project Total Cost"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "ce-mono ce-summary-grand" })]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "ce-card ce-summary-block",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				className: "ce-serif ce-summary-heading",
				children: "Cost by category"
			}), viewType === "Breakdown" ? tasks.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "ce-empty ce-empty-lg",
				children: "No tasks available. Please add tasks in the Breakdown tab."
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "ce-accordion",
				children: tasks.map((task) => {
					const isExpanded = expandedTaskId === task.id;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "ce-accordion-item",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								className: "ce-accordion-header",
								onClick: () => setExpandedTaskId(isExpanded ? null : task.id),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "ce-accordion-title",
									children: task.title
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "ce-accordion-icon",
									children: isExpanded ? "▲" : "▼"
								})]
							}),
							isExpanded && task.subtasks.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
								className: "ce-accordion-subtasks",
								children: task.subtasks.map((sub) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: sub.title }, sub.id))
							}),
							isExpanded && task.subtasks.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "ce-accordion-empty",
								children: "No subtasks yet."
							})
						]
					}, task.id);
				})
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
				className: "ce-table ce-summary-category-table",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "CATEGORY" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "DESCRIPTION" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "TOTAL" })
				] }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: catTotals.map(({ cat, total }, index) => {
					const label = String(displayCategories[index] || CATEGORY_META[cat].short || "");
					const letter = label.match(/^[A-Z]\./) ? label[0] : String.fromCharCode(65 + index);
					const description = label.replace(/^[A-Z]\.\s*/, "");
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: letter }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: description }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "ce-right ce-mono",
							children: fmt(total)
						})
					] }, cat);
				}) })]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "ce-card ce-summary-block",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				className: "ce-serif ce-summary-heading",
				children: "Cost by task"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
				className: "ce-table",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Task" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Subtasks" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "ce-right",
							children: "Total"
						})
					] }) }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: tasks.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: t.title }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: t.subtasks.length }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "ce-right ce-mono",
							children: fmt(taskTotal(t))
						})
					] }, t.id)) }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("tfoot", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { colSpan: 2 }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "ce-right ce-mono ce-total",
						children: fmt(grandTotal)
					})] }) })
				]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "ce-card ce-summary-block",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				className: "ce-serif ce-summary-heading",
				children: "Notes"
			}), noteRows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "ce-empty",
				children: "No notes yet. Add them under each task or subtask in Breakdown."
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
				className: "ce-table",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "From" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Notes" })] }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: noteRows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: row.who }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
					className: "ce-summary-notes-cell",
					children: row.notes
				})] }, row.id)) })]
			})]
		})
	] });
}
function BOLMasterSummary({ tasks }) {
	const allBOL = [];
	tasks.forEach((t) => t.subtasks.forEach((s) => (s.items.BOL || []).forEach((it) => allBOL.push(it))));
	const scheduleMap = getScheduledItemMap(tasks, "BOL");
	const groups = {};
	DAY_TYPES.forEach((dt) => {
		groups[dt] = {
			Day: {},
			Night: {}
		};
	});
	allBOL.forEach((it) => {
		const dt = it.dayType || "Regular";
		const shift = it.shift || "Day";
		const role = it.role || "Unnamed";
		const key = `${role}~${dt}~${shift}`;
		const sched = scheduleMap[key] || {
			maxDailyQty: 0,
			activeDays: 0
		};
		if (!groups[dt]) groups[dt] = {
			Day: {},
			Night: {}
		};
		if (!groups[dt][shift]) groups[dt][shift] = {};
		if (!groups[dt][shift][role]) groups[dt][shift][role] = {
			role,
			qty: 0,
			days: 0,
			rate: num(it.rate),
			otHrs: num(it.otHrs),
			subtotal: 0,
			count: 0
		};
		const entry = groups[dt][shift][role];
		entry.qty = Math.max(entry.qty, sched.maxDailyQty);
		entry.days = Math.max(entry.days, sched.activeDays);
		entry.rate = entry.count === 0 ? num(it.rate) : entry.rate;
		entry.otHrs = entry.count === 0 ? num(it.otHrs) : entry.otHrs;
		entry.subtotal += calcBOL(it).subtotal;
		entry.count += 1;
	});
	DAY_TYPES.forEach((dt) => {
		["Day", "Night"].forEach((shift) => {
			Object.values(groups[dt][shift] || {}).forEach((r) => {
				const dtMult = DAY_TYPE_MULT[dt] || 1;
				const shiftAdd = shift === "Night" ? NIGHT_DIFF : 0;
				const effRate = r.rate * dtMult * (1 + shiftAdd);
				const otRate = r.rate / 8 * OT_MULT * dtMult * (1 + shiftAdd);
				r.subtotal = r.qty * r.days * effRate + r.qty * r.days * r.otHrs * otRate;
			});
		});
	});
	const dayTypeTotals = {};
	DAY_TYPES.forEach((dt) => {
		let total = 0;
		Object.values(groups[dt] || {}).forEach((shiftGroup) => Object.values(shiftGroup).forEach((r) => {
			total += r.subtotal;
		}));
		dayTypeTotals[dt] = total;
	});
	const grandTotal = DAY_TYPES.reduce((s, dt) => s + dayTypeTotals[dt], 0);
	const dayTypeLabels = {
		Regular: "A. Regular",
		"Sun/Special": "B. Sun/Special",
		Holiday: "C. Holiday"
	};
	const benefitsMap = {};
	allBOL.forEach((it) => {
		const role = it.role || "Unnamed";
		if (!benefitsMap[role]) benefitsMap[role] = {
			role,
			maxDailyQty: 0,
			activeDays: 0,
			rate: num(it.rate)
		};
		if (benefitsMap[role].rate === 0) benefitsMap[role].rate = num(it.rate);
		Object.keys(scheduleMap).forEach((key) => {
			if (key.startsWith(`${role}~`)) {
				const sched = scheduleMap[key];
				benefitsMap[role].maxDailyQty = Math.max(benefitsMap[role].maxDailyQty, sched.maxDailyQty);
				benefitsMap[role].activeDays = Math.max(benefitsMap[role].activeDays, sched.activeDays);
			}
		});
	});
	const benefitsData = Object.values(benefitsMap).map((b) => {
		const monthlyRate = b.rate * 26;
		const thirteenth = monthlyRate / 12;
		const sss = monthlyRate * .045;
		const hdmf = monthlyRate * .02;
		const phic = monthlyRate * .03;
		const perDiem = 500 * b.activeDays;
		const totalBenefits = thirteenth + sss + hdmf + phic + perDiem;
		return {
			...b,
			monthlyRate,
			thirteenth,
			sss,
			hdmf,
			phic,
			perDiem,
			totalBenefits
		};
	});
	const displayBenefitsData = benefitsData.length > 0 ? benefitsData : [{
		role: "No manpower data",
		maxDailyQty: 0,
		activeDays: 0,
		monthlyRate: 0,
		thirteenth: 0,
		sss: 0,
		hdmf: 0,
		phic: 0,
		perDiem: 0,
		totalBenefits: 0
	}];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "ce-card ce-summary-block",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "ce-card-header ce-card-header-compact",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
					className: "ce-serif ce-summary-heading",
					style: {
						margin: 0,
						fontWeight: "bold",
						textAlign: "center",
						flex: 1
					},
					children: "BILL OF LABOR"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
					className: "ce-mono ce-total",
					children: fmt(grandTotal)
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "ce-table-scroll",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
					className: "ce-table",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Role / Position" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "ce-right",
							children: "QTY"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "ce-right",
							children: "Days"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "ce-right",
							children: "Rate/Day"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "ce-right",
							children: "OT Hrs"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "ce-right",
							children: "Subtotal"
						})
					] }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: DAY_TYPES.map((dt) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_react.Fragment, { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", {
							className: "ce-daytype-header",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								colSpan: 6,
								children: dayTypeLabels[dt] || dt
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", {
							className: "ce-shift-header",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								colSpan: 6,
								children: "Dayshift"
							})
						}),
						Object.values(groups[dt]?.Day || {}).map((r, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "ce-table-cell",
								children: r.role
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "ce-right",
								children: r.qty
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "ce-right",
								children: r.days
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "ce-right ce-mono",
								children: fmt(r.rate)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "ce-right",
								children: r.otHrs
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "ce-right ce-mono",
								children: fmt(r.subtotal)
							})
						] }, `${dt}-day-${idx}`)),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", {
							className: "ce-shift-header",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								colSpan: 6,
								children: "Nightshift"
							})
						}),
						Object.values(groups[dt]?.Night || {}).map((r, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "ce-table-cell",
								children: r.role
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "ce-right",
								children: r.qty
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "ce-right",
								children: r.days
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "ce-right ce-mono",
								children: fmt(r.rate)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "ce-right",
								children: r.otHrs
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "ce-right ce-mono",
								children: fmt(r.subtotal)
							})
						] }, `${dt}-night-${idx}`))
					] }, dt)) })]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				style: { marginTop: "1.5rem" },
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
					className: "ce-serif ce-summary-subheading",
					children: "D. Benefits"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "ce-table-scroll",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
						className: "ce-table",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: [
							"ITEM",
							"MANPOWER LOADING",
							"QTY",
							"UOM",
							"TOTAL DAYS",
							"MONTHLY RATE",
							"13TH PAY",
							"SSS",
							"HDMF",
							"PHIC",
							"PER DIEM",
							"TOTAL"
						].map((header) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "ce-right",
							children: header
						}, header)) }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: displayBenefitsData.map((row, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: "—" }),
							" ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: row.role || "—" }),
							" ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "ce-right",
								children: row.maxDailyQty
							}),
							" ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: "pax" }),
							" ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "ce-right",
								children: row.activeDays
							}),
							" ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "ce-right ce-mono",
								children: fmt(row.monthlyRate)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "ce-right ce-mono",
								children: fmt(row.thirteenth)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "ce-right ce-mono",
								children: fmt(row.sss)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "ce-right ce-mono",
								children: fmt(row.hdmf)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "ce-right ce-mono",
								children: fmt(row.phic)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "ce-right ce-mono",
								children: fmt(row.perDiem)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "ce-right ce-mono",
								children: fmt(row.totalBenefits)
							})
						] }, idx)) })]
					})
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("table", {
				className: "ce-table",
				style: { marginTop: "1rem" },
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
					className: "ce-grand-total",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						colSpan: 5,
						style: { textAlign: "left" },
						children: "GRAND TOTAL"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "ce-right ce-mono",
						children: fmt(grandTotal)
					})]
				}) })
			})
		]
	});
}
function AggregatedCategoryTab({ tasks, category }) {
	const [manualRows, setManualRows] = (0, import_react.useState)([]);
	const meta = CATEGORY_META[category];
	const scheduleMap = getScheduledItemMap(tasks, category);
	const summaryHeaders = {
		BOCM: "BILL OF CONSUMABLES & MATERIALS",
		BOTE: "BILL OF TOOLS & EQUIPMENT",
		PPE: "SAFETY & PERSONAL PROTECTIVE EQUIPMENT"
	};
	const autoRows = Object.entries(scheduleMap).map(([desc, data]) => {
		let rate = 0;
		tasks.forEach((t) => t.subtasks.forEach((s) => (s.items[category] || []).forEach((it) => {
			if ((category === "PPE" ? it.item : it.description) === desc) rate = category === "BOTE" ? num(it.rate) : num(it.unitCost);
		})));
		return {
			id: desc,
			description: desc,
			maxDailyQty: data.maxDailyQty,
			activeDays: data.activeDays,
			totalQty: data.totalQty,
			rate,
			subtotal: category === "BOTE" ? data.maxDailyQty * data.activeDays * rate : data.totalQty * rate
		};
	});
	const autoTotal = autoRows.reduce((s, r) => s + r.subtotal, 0);
	const manualTotal = manualRows.reduce((s, r) => s + manualSubtotal(r), 0);
	const grandTotal = autoTotal + manualTotal;
	function addManualRow() {
		if (category === "BOTE") setManualRows([...manualRows, {
			id: uid("manual-bote"),
			description: "",
			qty: 0,
			days: 0,
			rate: 0
		}]);
		else if (category === "BOCM") setManualRows([...manualRows, {
			id: uid("manual-bocm"),
			description: "",
			qty: 0,
			unitCost: 0
		}]);
		else if (category === "PPE") setManualRows([...manualRows, {
			id: uid("manual-ppe"),
			item: "",
			qty: 0,
			unitCost: 0
		}]);
	}
	function updateManualRow(id, patch) {
		setManualRows((rows) => rows.map((r) => r.id === id ? {
			...r,
			...patch
		} : r));
	}
	function deleteManualRow(id) {
		setManualRows((rows) => rows.filter((r) => r.id !== id));
	}
	function manualSubtotal(r) {
		if (category === "BOTE") return num(r.qty) * num(r.days) * num(r.rate);
		return num(r.qty) * (category === "BOCM" || category === "PPE" ? num(r.unitCost) : 1);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "ce-card ce-summary-block",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "ce-card-header ce-card-header-compact",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
					className: "ce-serif ce-summary-heading",
					style: {
						margin: 0,
						fontWeight: "bold",
						textAlign: "center",
						flex: 1
					},
					children: summaryHeaders[category] || meta.label
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
					className: "ce-mono ce-total",
					children: fmt(grandTotal)
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "ce-table-scroll",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
					className: "ce-table",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Item Description" }),
							category === "BOTE" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "ce-right",
								children: "Qty"
							}),
							category === "BOTE" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "ce-right",
								children: "Days"
							}),
							category === "BOCM" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "ce-right",
								children: "Qty"
							}),
							category === "PPE" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "ce-right",
								children: "Qty"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "ce-right",
								children: "Rate / Unit Cost"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "ce-right",
								children: "Subtotal"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {})
						] }) }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tbody", { children: [autoRows.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", {
								className: "ce-subtotal-row",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									colSpan: category === "BOTE" ? 5 : 4,
									children: "Breakdown Items"
								})
							}),
							autoRows.map((r, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: r.description }),
								category === "BOTE" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "ce-right",
									children: r.maxDailyQty
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "ce-right",
									children: r.activeDays
								})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "ce-right",
									children: r.totalQty
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "ce-right ce-mono",
									children: fmt(r.rate)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "ce-right ce-mono",
									children: fmt(r.subtotal)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {})
							] }, `auto-${idx}`)),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
								className: "ce-subtotal-row",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										colSpan: category === "BOTE" ? 4 : 3,
										children: "Subtotal — Breakdown"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "ce-right ce-mono",
										children: fmt(autoTotal)
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {})
								]
							})
						] }), manualRows.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", {
								className: "ce-subtotal-row",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									colSpan: category === "BOTE" ? 5 : 4,
									children: "Manual Entries"
								})
							}),
							manualRows.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									className: "ce-input",
									value: category === "PPE" ? r.item : r.description,
									onChange: (e) => updateManualRow(r.id, category === "PPE" ? { item: e.target.value } : { description: e.target.value })
								}) }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "number",
									min: "0",
									className: "ce-input ce-right",
									value: r.qty,
									onChange: (e) => updateManualRow(r.id, { qty: e.target.value })
								}) }),
								category === "BOTE" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "number",
									min: "0",
									className: "ce-input ce-right",
									value: r.days,
									onChange: (e) => updateManualRow(r.id, { days: e.target.value })
								}) }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "number",
									min: "0",
									className: "ce-input ce-right",
									value: category === "BOTE" ? r.rate : r.unitCost,
									onChange: (e) => updateManualRow(r.id, category === "BOTE" ? { rate: e.target.value } : { unitCost: e.target.value })
								}) }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "ce-right ce-mono",
									children: fmt(manualSubtotal(r))
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconBtn, {
									danger: true,
									title: "Remove",
									onClick: () => deleteManualRow(r.id),
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { size: 14 })
								}) })
							] }, r.id)),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
								className: "ce-subtotal-row",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										colSpan: category === "BOTE" ? 4 : 3,
										children: "Subtotal — Manual"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "ce-right ce-mono",
										children: fmt(manualTotal)
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {})
								]
							})
						] })] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("tfoot", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								colSpan: category === "BOTE" ? 4 : 3,
								children: "Grand Total"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "ce-right ce-mono ce-total",
								children: fmt(grandTotal)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {})
						] }) })
					]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				className: "ce-add-row",
				onClick: addManualRow,
				type: "button",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { size: 13 }), " Add Row"]
			})
		]
	});
}
function MISCSheet() {
	const { widths, updateWidth } = useResizableColumns("misc-accom-col-widths", {
		itemNo: 55,
		description: 250,
		qty: 80,
		unit: 90,
		unitPrice: 110,
		total: 120,
		action: 50
	});
	const [entries, setEntries] = (0, import_react.useState)(() => {
		const flat = [];
		MISC_PRELOAD.forEach((sec) => sec.items.forEach((desc, idx) => flat.push({
			id: uid(`misc-${sec.section}-${idx}`),
			section: sec.section,
			sectionTitle: sec.title,
			description: desc,
			qty: 0,
			unitCost: 0,
			days: 1
		})));
		return flat;
	});
	const [hideSections, setHideSections] = (0, import_react.useState)({});
	const updateEntry = (id, patch) => {
		setEntries((rows) => rows.map((r) => r.id === id ? {
			...r,
			...patch
		} : r));
	};
	function removeEntry(id) {
		setEntries((rows) => rows.filter((r) => r.id !== id));
	}
	const insertRowBelow = (afterId) => {
		setEntries((rows) => {
			const idx = rows.findIndex((r) => r.id === afterId);
			if (idx === -1) return rows;
			const afterRow = rows[idx];
			const newRow = {
				id: uid(`misc-insert-${afterRow.section}`),
				section: afterRow.section,
				sectionTitle: afterRow.sectionTitle,
				description: "",
				qty: 0,
				unitCost: 0,
				days: 1
			};
			const next = [...rows];
			next.splice(idx + 1, 0, newRow);
			return next;
		});
	};
	const grouped = MISC_PRELOAD.map((sec) => {
		const allRows = entries.filter((e) => e.section === sec.section);
		const visibleRows = hideSections[sec.section] ? allRows.filter((r) => num(r.qty) !== 0 || num(r.unitCost) !== 0) : allRows;
		return {
			...sec,
			rows: visibleRows,
			allRowsCount: allRows.length
		};
	});
	const grandTotal = entries.reduce((s, e) => {
		return s + (e.section === "B" || e.section === "D" || e.section === "E" ? num(e.qty) * num(e.days) * num(e.unitCost) : num(e.qty) * num(e.unitCost));
	}, 0);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "ce-card ce-summary-block",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "ce-card-header ce-card-header-compact",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				className: "ce-serif ce-summary-heading",
				style: {
					margin: 0,
					fontWeight: "bold",
					textAlign: "center",
					flex: 1
				},
				children: "MISCELLANEOUS"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
				className: "ce-mono ce-total",
				children: fmt(grandTotal)
			})]
		}), grouped.map((sec) => {
			const showDays = sec.section === "B" || sec.section === "D" || sec.section === "E";
			return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "misc-group",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "misc-group-header",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "ce-serif misc-group-title",
						children: [
							sec.section,
							". ",
							sec.title
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						className: "ce-btn-ghost ce-btn-sm misc-hide-btn",
						onClick: () => setHideSections((prev) => ({
							...prev,
							[sec.section]: !prev[sec.section]
						})),
						type: "button",
						children: hideSections[sec.section] ? "Show All Items" : "Hide Unused Items"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "ce-gridwrap",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
						className: "ce-table misc-table",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								style: { width: "40px" },
								children: "Item No."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Description" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "ce-right",
								style: { width: "30px" },
								children: "QTY"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "ce-right",
								style: { width: "120px" },
								children: "Unit Price"
							}),
							showDays && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "ce-right",
								style: { width: "30px" },
								children: "No. of Days"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "ce-right",
								style: { width: "120px" },
								children: "Total"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { style: { width: "80px" } })
						] }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tbody", { children: [sec.rows.map((r, idx) => {
							const lineTotal = showDays ? num(r.qty) * num(r.days) * num(r.unitCost) : num(r.qty) * num(r.unitCost);
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "ce-center",
									children: idx + 1
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									className: "ce-input misc-desc-input",
									value: r.description,
									onChange: (e) => updateEntry(r.id, { description: e.target.value }),
									placeholder: "Description"
								}) }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									style: { width: "30px" },
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										min: "0",
										className: "ce-input ce-right misc-qty-input",
										style: { width: "100%" },
										value: r.qty,
										onChange: (e) => updateEntry(r.id, { qty: e.target.value })
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "number",
									min: "0",
									className: "ce-input ce-right misc-unit-input",
									value: r.unitCost,
									onChange: (e) => updateEntry(r.id, { unitCost: e.target.value })
								}) }),
								showDays && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									style: { width: "30px" },
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										min: "0",
										className: "ce-input ce-right misc-days-input",
										style: { width: "100%" },
										value: r.days,
										onChange: (e) => updateEntry(r.id, { days: e.target.value })
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "ce-right ce-mono misc-total-cell",
									style: { width: "120px" },
									children: fmt(lineTotal)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									className: "ce-btn-ghost ce-btn-sm misc-insert-btn",
									onClick: () => insertRowBelow(r.id),
									type: "button",
									title: "Insert row below",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { size: 10 })
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconBtn, {
									danger: true,
									title: "Delete row",
									onClick: () => removeEntry(r.id),
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { size: 14 })
								})] })
							] }, r.id);
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "ce-subtotal-row",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
									colSpan: showDays ? 5 : 4,
									children: ["Subtotal — Section ", sec.section]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "ce-right ce-mono",
									style: { textAlign: "right" },
									children: fmt(sec.rows.reduce((s, r) => s + (showDays ? num(r.qty) * num(r.days) * num(r.unitCost) : num(r.qty) * num(r.unitCost)), 0))
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {})
							]
						})] })]
					})
				})]
			}, sec.section);
		})]
	});
}
function MobDemobSection({ title, bolItems }) {
	const allowanceRates = {
		"Project Manager": 500,
		Admin: 300,
		Manpower: 200,
		"Driver / Porter": 150
	};
	const roleMap = {};
	bolItems.forEach((it) => {
		const key = it.role || "Unnamed";
		if (!roleMap[key]) roleMap[key] = {
			id: uid("mob-a"),
			role: key,
			qty: 0,
			uom: "pax",
			days: 0,
			rate: 0,
			otHrs: 0
		};
		roleMap[key].qty += num(it.qty);
	});
	const [partA, setPartA] = (0, import_react.useState)(Object.values(roleMap));
	const [partB, setPartB] = (0, import_react.useState)([
		{
			description: "Airfare-International",
			qty: 0,
			uom: "trip",
			days: 0,
			unitCost: 0
		},
		{
			description: "Airfare-Domestic",
			qty: 0,
			uom: "trip",
			days: 0,
			unitCost: 0
		},
		{
			description: "Vehicle Traviz (Cavite to Airport)",
			qty: 0,
			uom: "trip",
			days: 0,
			unitCost: 0
		},
		{
			description: "Vehicle Traviz (Cavite to Site)",
			qty: 0,
			uom: "trip",
			days: 0,
			unitCost: 0
		},
		{
			description: "Vehicle Traviz (Airport to Site)",
			qty: 0,
			uom: "trip",
			days: 0,
			unitCost: 0
		},
		{
			description: "Vehicle Hilux (Cavite to Airport)",
			qty: 0,
			uom: "trip",
			days: 0,
			unitCost: 0
		},
		{
			description: "Vehicle Hilux (Cavite to Site)",
			qty: 0,
			uom: "trip",
			days: 0,
			unitCost: 0
		},
		{
			description: "Vehicle Hilux (Airport to Site)",
			qty: 0,
			uom: "trip",
			days: 0,
			unitCost: 0
		},
		{
			description: "Truck Delivery 6-Wheeler",
			qty: 0,
			uom: "trip",
			days: 0,
			unitCost: 0
		},
		{
			description: "Truck Delivery 10-Wheeler",
			qty: 0,
			uom: "trip",
			days: 0,
			unitCost: 0
		},
		{
			description: "Truck Delivery Flat Bed 40FT",
			qty: 0,
			uom: "trip",
			days: 0,
			unitCost: 0
		},
		{
			description: "Diesel (Ltrs)",
			qty: 0,
			uom: "ltr",
			days: 0,
			unitCost: 0
		},
		{
			description: "Toll Fee",
			qty: 0,
			uom: "trip",
			days: 0,
			unitCost: 0
		},
		{
			description: "Procurement",
			qty: 0,
			uom: "lot",
			days: 0,
			unitCost: 0
		},
		{
			description: "Contingencies",
			qty: 0,
			uom: "lot",
			days: 0,
			unitCost: 0
		}
	].map((r, i) => ({
		...r,
		id: uid("mob-b"),
		lineItem: i + 1
	})));
	const [hideUnused, setHideUnused] = (0, import_react.useState)(false);
	function updatePartA(id, patch) {
		setPartA((rows) => rows.map((r) => r.id === id ? {
			...r,
			...patch
		} : r));
	}
	function updatePartB(id, patch) {
		setPartB((rows) => rows.map((r) => r.id === id ? {
			...r,
			...patch
		} : r));
	}
	function insertCustomRow(afterId) {
		const idx = partB.findIndex((r) => r.id === afterId);
		if (idx === -1) return;
		const newRow = {
			id: uid("mob-custom"),
			description: "",
			qty: 0,
			uom: "",
			days: 0,
			unitCost: 0,
			lineItem: idx + 1
		};
		const next = [...partB];
		next.splice(idx + 1, 0, newRow);
		setPartB(next);
	}
	function deleteCustomRow(id) {
		setPartB((rows) => rows.filter((r) => r.id !== id));
	}
	const partATotal = partA.reduce((s, r) => {
		const allowanceAmount = allowanceRates[r.role] || 0;
		const subtotalA = num(r.qty) * num(r.days) * num(r.rate);
		const subtotalB = num(r.qty) * num(r.days) * allowanceAmount;
		return s + subtotalA + subtotalB;
	}, 0);
	const visiblePartB = hideUnused ? partB.filter((r) => num(r.qty) > 0 || r.id.startsWith("mob-custom")) : partB;
	const partBTotal = visiblePartB.reduce((s, r) => s + num(r.qty) * num(r.days) * num(r.unitCost), 0);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "ce-card ce-summary-block",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "ce-card-header ce-card-header-compact",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				className: "ce-serif ce-summary-heading",
				style: { margin: 0 },
				children: title
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
				className: "ce-mono ce-total",
				children: fmt(partATotal + partBTotal)
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "ce-table-scroll",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
					className: "ce-serif ce-summary-subheading",
					children: "Part A: Manpower Loading"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
					className: "ce-table",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Item" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Manpower Loading (Role)" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "ce-right",
							style: { width: "30px" },
							children: "Qty"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "UOM" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							style: { width: "30px" },
							children: "No. of Days"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "ce-right",
							children: "Rate Per Day"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "ce-right",
							children: "Sub-Total A"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "ce-right",
							children: "OT Hrs Per Day"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "ce-right",
							children: "ALLOWANCE"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "ce-right",
							children: "Sub-Total B"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "ce-right",
							style: { width: "120px" },
							children: "Total"
						})
					] }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tbody", { children: [partA.map((r, idx) => {
						const allowanceAmount = allowanceRates[r.role] || 0;
						const subtotalA = num(r.qty) * num(r.days) * num(r.rate);
						const subtotalB = num(r.qty) * num(r.days) * allowanceAmount;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: idx + 1 }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: r.role }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "ce-right",
								style: { width: "30px" },
								children: r.qty
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								className: "ce-input",
								value: r.uom,
								onChange: (e) => updatePartA(r.id, { uom: e.target.value })
							}) }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								style: { width: "30px" },
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "number",
									min: "0",
									className: "ce-input ce-right",
									style: { width: "100%" },
									value: r.days,
									onChange: (e) => updatePartA(r.id, { days: e.target.value })
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "number",
								min: "0",
								className: "ce-input ce-right",
								value: r.rate,
								onChange: (e) => updatePartA(r.id, { rate: e.target.value })
							}) }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "ce-right ce-mono",
								children: fmt(subtotalA)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "number",
								min: "0",
								className: "ce-input ce-right",
								value: r.otHrs,
								onChange: (e) => updatePartA(r.id, { otHrs: e.target.value })
							}) }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "ce-right ce-mono",
								children: fmt(allowanceAmount)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "ce-right ce-mono",
								children: fmt(subtotalB)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "ce-right ce-mono",
								style: { width: "120px" },
								children: fmt(subtotalA + subtotalB)
							})
						] }, r.id);
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
						className: "ce-subtotal-row",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							colSpan: 10,
							children: "Subtotal — Part A"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "ce-right ce-mono",
							children: fmt(partATotal)
						})]
					})] })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					style: {
						display: "flex",
						alignItems: "center",
						gap: "1rem",
						margin: "1rem 0"
					},
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
						className: "ce-serif ce-summary-subheading",
						style: { margin: 0 },
						children: "Part B: Line Items"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						className: "ce-btn-ghost ce-btn-sm",
						onClick: () => setHideUnused(!hideUnused),
						type: "button",
						children: hideUnused ? "Show All Items" : "Hide Unused Items"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
					className: "ce-table",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Line Item" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Description/Manpower" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "ce-right",
							style: { width: "30px" },
							children: "Qty"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "UOM" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							style: { width: "30px" },
							children: "No. of Days / Trips"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "ce-right",
							children: "Unit Cost"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "ce-right",
							style: { width: "120px" },
							children: "Total"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {})
					] }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tbody", { children: [
						visiblePartB.map((r, idx) => {
							const lineTotal = num(r.qty) * num(r.days) * num(r.unitCost);
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "ce-center",
									children: idx + 1
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									className: "ce-input",
									value: r.description,
									onChange: (e) => updatePartB(r.id, { description: e.target.value })
								}) }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									style: { width: "30px" },
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										min: "0",
										className: "ce-input ce-right",
										style: { width: "100%" },
										value: r.qty,
										onChange: (e) => updatePartB(r.id, { qty: e.target.value })
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									className: "ce-input",
									value: r.uom,
									onChange: (e) => updatePartB(r.id, { uom: e.target.value })
								}) }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									style: { width: "30px" },
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "number",
										min: "0",
										className: "ce-input ce-right",
										style: { width: "100%" },
										value: r.days,
										onChange: (e) => updatePartB(r.id, { days: e.target.value })
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "number",
									min: "0",
									className: "ce-input ce-right",
									value: r.unitCost,
									onChange: (e) => updatePartB(r.id, { unitCost: e.target.value })
								}) }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "ce-right ce-mono",
									style: { width: "120px" },
									children: fmt(lineTotal)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", { children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										className: "ce-btn-ghost ce-btn-sm",
										onClick: () => insertCustomRow(r.id),
										type: "button",
										title: "Insert custom row below",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { size: 10 })
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconBtn, {
										danger: true,
										title: "Delete row",
										onClick: () => removeRow(r.id),
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { size: 14 })
									}),
									r.id.startsWith("mob-custom") && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconBtn, {
										danger: true,
										title: "Remove",
										onClick: () => deleteCustomRow(r.id),
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { size: 14 })
									})
								] })
							] }, r.id);
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "ce-subtotal-row",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									colSpan: 5,
									children: "Subtotal — Part B"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "ce-right ce-mono",
									children: fmt(partBTotal)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "ce-grand-total",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									colSpan: 6,
									children: "Section Total"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "ce-right ce-mono",
									children: fmt(partATotal + partBTotal)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {})
							]
						})
					] })]
				})
			]
		})]
	});
}
function Header({ meta, grand, dispatch, onExport, onExportExcel, onImportClick, ceStatus, setCeStatus, versionHistory, onSaveVersion, onRestoreVersion }) {
	const [editing, setEditing] = (0, import_react.useState)(false);
	const [isParked, setIsParked] = (0, import_react.useState)(false);
	const [draft, setDraft] = (0, import_react.useState)(meta);
	const idleTimerRef = (0, import_react.useRef)(null);
	function save() {
		Object.keys(draft).forEach((k) => {
			if (draft[k] !== meta[k]) dispatch({
				type: "SET_META",
				field: k,
				value: draft[k]
			});
		});
		setEditing(false);
	}
	function autoSave() {
		const now = (/* @__PURE__ */ new Date()).toLocaleTimeString();
		console.log(`Auto-saved at ${now}`);
	}
	(0, import_react.useEffect)(() => {
		const resetTimer = () => {
			if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
			idleTimerRef.current = setTimeout(() => {
				autoSave();
				setIsParked(true);
				alert("Editor parked due to inactivity. All changes auto-saved.");
			}, 9e5);
		};
		resetTimer();
		window.addEventListener("mousemove", resetTimer);
		window.addEventListener("keydown", resetTimer);
		window.addEventListener("click", resetTimer);
		return () => {
			if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
			window.removeEventListener("mousemove", resetTimer);
			window.removeEventListener("keydown", resetTimer);
			window.removeEventListener("click", resetTimer);
		};
	}, [autoSave, setIsParked]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "ce-header",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "ce-header-top",
				children: [!editing ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "ce-breadcrumb",
					children: [
						meta.client,
						meta.location,
						meta.date
					].filter(Boolean).length > 0 ? [
						meta.client,
						meta.location,
						meta.date
					].filter(Boolean).join(" · ") : "Click Edit to add client, location, and date"
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "ce-meta-edit",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							className: "ce-input",
							value: draft.client,
							onChange: (e) => setDraft({
								...draft,
								client: e.target.value
							}),
							placeholder: "Client"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							className: "ce-input",
							value: draft.location,
							onChange: (e) => setDraft({
								...draft,
								location: e.target.value
							}),
							placeholder: "Location"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "date",
							className: "ce-input",
							value: draft.date,
							onChange: (e) => setDraft({
								...draft,
								date: e.target.value
							})
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "ce-header-actions",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
							value: ceStatus,
							onChange: (e) => setCeStatus(e.target.value),
							className: "ce-status-select",
							title: "Change status",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "Draft",
									children: "Draft"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "Pending Review",
									children: "Pending Review"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "Sent to Client",
									children: "Sent to Client"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "Awarded",
									children: "Awarded"
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							className: `ce-btn-ghost ce-btn-sm ${isParked ? "ce-btn-active" : ""}`,
							onClick: () => {
								if (!isParked) {
									setIsParked(true);
									alert("Editor parked. All changes auto-saved.");
								} else {
									setIsParked(false);
									alert("Editor resumed");
								}
							},
							type: "button",
							children: isParked ? "Resume" : "Park Editor"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							className: "ce-btn-ghost ce-btn-sm",
							onClick: onExport,
							type: "button",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { size: 14 }), " PDF"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							className: "ce-btn-ghost ce-btn-sm",
							onClick: onImportClick,
							type: "button",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, { size: 14 }), " Import"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							className: "ce-btn-ghost ce-btn-sm",
							onClick: onExportExcel,
							type: "button",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { size: 14 }), " Excel"]
						}),
						!editing ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							className: "ce-btn-ghost ce-btn-sm",
							onClick: () => {
								setDraft(meta);
								setEditing(true);
							},
							type: "button",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pencil, { size: 14 }), " Edit"]
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							className: "ce-btn-primary ce-btn-sm",
							onClick: save,
							type: "button",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { size: 14 }), " Save"]
						})
					]
				})]
			}),
			!editing ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "ce-serif ce-header-title",
				children: meta.title
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
				className: "ce-input ce-header-title-input",
				value: draft.title,
				onChange: (e) => setDraft({
					...draft,
					title: e.target.value
				}),
				placeholder: "Project title"
			}),
			!editing ? meta.subtitle && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "ce-header-subtitle",
				children: meta.subtitle
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
				className: "ce-input",
				value: draft.subtitle,
				onChange: (e) => setDraft({
					...draft,
					subtitle: e.target.value
				}),
				placeholder: "Subtitle / scope note"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "ce-header-total",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "ce-field-label",
					children: "Grand Total"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "ce-mono ce-header-total-val",
					children: fmt(grand)
				})]
			})
		]
	});
}
var TABS = [
	"SUMMARY",
	"BREAKDOWN",
	"SOW",
	"MOB/DEMOB",
	"BOL",
	"BOCM",
	"BOTE",
	"PPE",
	"MISC",
	"ATTCH"
];
function CostEstimateTool({ ceData, status, onStatusChange, isParked, onParkToggle, goToLibrary, goToSearch, editingUser, isEditorLocked, onUserActivity, onLock, onTakeOver, onDocumentChange, documentControl }) {
	const [lastActivity, setLastActivity] = (0, import_react.useState)(Date.now());
	(0, import_react.useEffect)(() => {
		if (isEditorLocked) return;
		const handleActivity = () => {
			setLastActivity(Date.now());
			if (onUserActivity) onUserActivity();
		};
		window.addEventListener("mousemove", handleActivity);
		window.addEventListener("keydown", handleActivity);
		return () => {
			window.removeEventListener("mousemove", handleActivity);
			window.removeEventListener("keydown", handleActivity);
		};
	}, [isEditorLocked, onUserActivity]);
	(0, import_react.useEffect)(() => {
		if (isEditorLocked) return;
		const interval = setInterval(() => {
			if (Date.now() - lastActivity > 9e5) {
				if (onLock) onLock();
			}
		}, 1e3);
		return () => clearInterval(interval);
	}, [
		lastActivity,
		isEditorLocked,
		onLock
	]);
	const [state, dispatch] = (0, import_react.useReducer)(reducer, void 0, () => {
		const base = buildEmptyProject();
		if (!ceData) return base;
		if (Array.isArray(ceData.tasks)) return {
			...base,
			...ceData,
			meta: {
				...base.meta,
				...ceData.meta || {}
			},
			fileAttachments: {
				...base.fileAttachments,
				...ceData.fileAttachments || {}
			},
			summaryTaskFilters: {
				...base.summaryTaskFilters,
				...ceData.summaryTaskFilters || {}
			}
		};
		return {
			...base,
			meta: {
				...base.meta,
				client: ceData.client || "",
				title: ceData.project || "New Cost Estimate",
				subtitle: ceData.id ? `CE #${ceData.id}` : ""
			}
		};
	});
	const [tab, setTab] = (0, import_react.useState)("BREAKDOWN");
	const [sowText, setSowText] = (0, import_react.useState)("");
	const [ceStatus, setCeStatus] = (0, import_react.useState)("Draft");
	const [versionHistory, setVersionHistory] = (0, import_react.useState)([]);
	const [viewType, setViewType] = (0, import_react.useState)("Summary");
	const [docNo, setDocNo] = (0, import_react.useState)("");
	const [revNo, setRevNo] = (0, import_react.useState)("");
	const [revDate, setRevDate] = (0, import_react.useState)((/* @__PURE__ */ new Date()).toISOString().slice(0, 10));
	const persistSkip = (0, import_react.useRef)(true);
	(0, import_react.useEffect)(() => {
		if (persistSkip.current) {
			persistSkip.current = false;
			return;
		}
		if (!ceData?.id || !onDocumentChange) return;
		onDocumentChange(ceData.id, {
			...state,
			sowText,
			ceStatus,
			docNo,
			revNo,
			revDate
		});
	}, [
		state,
		sowText,
		ceStatus,
		docNo,
		revNo,
		revDate
	]);
	const [importError, setImportError] = (0, import_react.useState)("");
	const fileInputRef = (0, import_react.useRef)(null);
	const grand = projectTotal(state.tasks);
	const saveVersion = () => {
		const snapshot = {
			timestamp: (/* @__PURE__ */ new Date()).toISOString(),
			ceStatus,
			tasks: JSON.parse(JSON.stringify(state.tasks))
		};
		setVersionHistory((prev) => [...prev, snapshot]);
	};
	const restoreVersion = (version) => {
		dispatch({
			type: "RESTORE_TASKS",
			tasks: JSON.parse(JSON.stringify(version.tasks))
		});
		setCeStatus(version.ceStatus);
	};
	const prepareExportData = () => {
		const sections = [];
		const summaryRows = CATS.map((cat) => {
			return {
				cat,
				total: state.tasks.reduce((sum, t) => sum + t.subtasks.reduce((subSum, st) => subSum + categoryTotal(st.items[cat], cat), 0), 0)
			};
		}).map(({ cat, total }) => {
			const meta = CATEGORY_META[cat] || {
				short: cat,
				label: cat
			};
			return [
				meta.short,
				meta.label,
				fmt(total)
			];
		});
		sections.push({
			title: "Summary",
			columns: [
				"Category",
				"Description",
				"Total"
			],
			rows: summaryRows
		});
		if (sowText && sowText.trim() !== "") sections.push({
			title: "Scope of Work",
			columns: ["Content"],
			rows: [[sowText]]
		});
		const breakdownRows = [];
		state.tasks.forEach((task) => {
			breakdownRows.push([
				task.title,
				"",
				"",
				task.duration || 0,
				task.predecessor || ""
			]);
			task.subtasks.forEach((sub) => {
				breakdownRows.push([
					"",
					sub.title,
					sub.type,
					sub.duration || 0,
					sub.predecessor || ""
				]);
			});
		});
		sections.push({
			title: "Task Breakdown",
			columns: [
				"Task",
				"Subtask",
				"Type",
				"Duration",
				"Predecessor"
			],
			rows: breakdownRows,
			isTaskBreakdown: true
		});
		const bolItems = [];
		state.tasks.forEach((t) => t.subtasks.forEach((st) => (st.items.BOL || []).forEach((it) => bolItems.push(it))));
		if (bolItems.length > 0) {
			const bolRows = bolItems.map((it) => [
				it.role || "—",
				it.dayType || "Regular",
				it.shift || "Day",
				it.qty,
				it.days,
				fmt(it.rate),
				it.otHrs,
				fmt(calcBOL(it).subtotal)
			]);
			sections.push({
				title: "Bill of Labor",
				columns: [
					"Role",
					"Day Type",
					"Shift",
					"QTY",
					"Days",
					"Rate/Day",
					"OT Hrs",
					"Subtotal"
				],
				rows: bolRows
			});
		}
		[
			{
				key: "BOTE",
				title: "Tools & Equipment",
				columns: [
					"Description",
					"Qty",
					"Days",
					"Rate/Day",
					"Subtotal"
				]
			},
			{
				key: "BOCM",
				title: "Consumables",
				columns: [
					"Description",
					"Qty",
					"Unit",
					"Unit Cost",
					"Subtotal"
				]
			},
			{
				key: "PPE",
				title: "Safety & PPE",
				columns: [
					"Item",
					"Qty",
					"Unit Cost",
					"Subtotal"
				]
			},
			{
				key: "MISC",
				title: "Miscellaneous",
				columns: [
					"Description",
					"Qty",
					"Unit Cost",
					"Days",
					"Subtotal"
				]
			}
		].forEach((sec) => {
			const items = [];
			state.tasks.forEach((t) => t.subtasks.forEach((st) => (st.items[sec.key] || []).forEach((it) => items.push(it))));
			if (items.length > 0) {
				const rows = items.map((it) => {
					if (sec.key === "BOTE") return [
						it.description,
						it.qty,
						it.days,
						fmt(it.rate),
						fmt(itemSubtotal("BOTE", it))
					];
					if (sec.key === "BOCM") return [
						it.description,
						it.qty,
						it.unit,
						fmt(it.unitCost),
						fmt(itemSubtotal("BOCM", it))
					];
					if (sec.key === "PPE") return [
						it.item,
						it.qty,
						fmt(it.unitCost),
						fmt(itemSubtotal("PPE", it))
					];
					if (sec.key === "MISC") return [
						it.description,
						it.qty,
						fmt(it.unitCost),
						it.days || 1,
						fmt(itemSubtotal("MISC", it))
					];
					return [];
				});
				sections.push({
					title: sec.title,
					columns: sec.columns,
					rows
				});
			}
		});
		const attachments = [];
		Object.entries(state.fileAttachments || {}).forEach(([sheet, files]) => {
			files.forEach((file) => attachments.push([sheet, file.name]));
		});
		if (attachments.length > 0) sections.push({
			title: "Attachments",
			columns: ["Sheet", "File Name"],
			rows: attachments
		});
		return {
			companyLogo: documentControl?.logoDataUrl || "",
			docRevision: documentControl?.revision || "1.0",
			documentControl,
			docRevision: "1.0",
			docDate: state.meta.date || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
			ceNumber: ceData?.id || state.meta.title || "—",
			sections
		};
	};
	const handleExportPDF = () => {
		exportToPDF(prepareExportData());
	};
	const handleExportExcel = () => {
		exportToExcel(prepareExportData());
	};
	function handleImportFile(e) {
		const file = e.target.files && e.target.files[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => {
			try {
				const parsed = JSON.parse(String(reader.result));
				if (!parsed || !parsed.meta || !Array.isArray(parsed.tasks)) throw new Error("Invalid project file");
				dispatch({
					type: "IMPORT_PROJECT",
					project: parsed
				});
				setImportError("");
			} catch (err) {
				setImportError("Couldn't read that file — it doesn't look like a valid project export.");
				setTimeout(() => setImportError(""), 4e3);
			}
		};
		reader.readAsText(file);
		e.target.value = "";
	}
	const allAttachments = (0, import_react.useMemo)(() => {
		const files = [];
		Object.entries(state.fileAttachments || {}).forEach(([sheet, fileArray]) => {
			(fileArray || []).forEach((file) => {
				files.push({
					...file,
					sheet
				});
			});
		});
		collectScopeFiles(state.tasks).forEach((f) => files.push(f));
		return files;
	}, [state.fileAttachments, state.tasks]);
	const bolItems = (0, import_react.useMemo)(() => {
		const items = [];
		state.tasks.forEach((t) => t.subtasks.forEach((s) => (s.items.BOL || []).forEach((it) => items.push(it))));
		return items;
	}, [state.tasks]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		style: { position: "relative" },
		children: [isEditorLocked && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "editor-lock-overlay",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "editor-lock-banner",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
					"This CE is currently being edited by",
					" ",
					editingUser || "another user",
					". Click ‘Take Over’ to unlock."
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					className: "ce-btn-primary",
					onClick: onTakeOver,
					children: "Take Over"
				})]
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "ce-shell",
			style: isEditorLocked ? {
				pointerEvents: "none",
				opacity: .6,
				userSelect: "none"
			} : {},
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					ref: fileInputRef,
					type: "file",
					accept: "application/json",
					style: { display: "none" },
					onChange: handleImportFile
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Header, {
					ceStatus,
					setCeStatus,
					versionHistory,
					onSaveVersion: saveVersion,
					onRestoreVersion: restoreVersion,
					meta: state.meta,
					grand,
					dispatch,
					onExport: handleExportPDF,
					onExportExcel: handleExportExcel,
					onImportClick: () => fileInputRef.current && fileInputRef.current.click()
				}),
				importError && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "ce-import-error",
					children: importError
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "ce-status-bar",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						className: `ce-btn-ghost ce-btn-sm ${isParked ? "ce-btn-active" : ""}`,
						onClick: () => onParkToggle && onParkToggle(!isParked),
						type: "button",
						children: isParked ? "Resume" : "Park Editor"
					}), isParked && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						style: {
							display: "inline-flex",
							alignItems: "center",
							gap: "0.25rem",
							fontSize: "0.75rem",
							color: "var(--ink-soft)"
						},
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { size: 12 }), " Auto-saved"]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "ce-tabnav",
					children: TABS.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pill, {
						active: tab === t,
						onClick: () => setTab(t),
						children: t
					}, t))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "ce-main",
					children: [
						tab === "SUMMARY" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SummaryHeader, {
							docNo,
							setDocNo,
							revNo,
							setRevNo,
							revDate,
							setRevDate,
							viewType,
							setViewType
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SummaryView, {
							tasks: state.tasks,
							viewType
						})] }),
						tab === "BREAKDOWN" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BreakdownView, {
							tasks: state.tasks,
							dispatch,
							goToLibrary,
							goToSearch
						}),
						tab === "SOW" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SOWTab, {
							sowText,
							setSowText
						}),
						tab === "BOL" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BOLMasterSummary, { tasks: state.tasks }),
						tab === "BOTE" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AggregatedCategoryTab, {
							tasks: state.tasks,
							category: "BOTE"
						}),
						tab === "PPE" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AggregatedCategoryTab, {
							tasks: state.tasks,
							category: "PPE"
						}),
						tab === "BOCM" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AggregatedCategoryTab, {
							tasks: state.tasks,
							category: "BOCM"
						}),
						tab === "MISC" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MISCSheet, {}),
						tab === "MOB/DEMOB" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							style: {
								display: "flex",
								flexDirection: "column",
								gap: "1.5rem"
							},
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MobDemobSection, {
								title: "Mobilization",
								bolItems
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MobDemobSection, {
								title: "Demobilization",
								bolItems
							})]
						}),
						tab === "ATTCH" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AttachmentsTab, { attachments: allAttachments })
					]
				})
			]
		})]
	});
}
var monitoringMockData = [
	{
		id: 1,
		companyDesignation: "Client 1",
		department: "Dept 1",
		rceNo: "RCE-2025-001",
		client: "ABC Corp",
		projectDesc: "Turbine Overhaul",
		rceReceived: "2025-01-15",
		deadline: "2025-02-01",
		aging: 12,
		ceNo: "CE-2025-001",
		status: "Ongoing",
		remarks: "Cost estimate in progress.",
		ceSubmitted: "2025-01-25",
		receivedBy: "John Doe",
		awardStatus: "Pending",
		awardRemarks: "",
		recommendedAction: "Escalate to PM"
	},
	{
		id: 2,
		companyDesignation: "Client 1",
		department: "Dept 2",
		rceNo: "RCE-2025-002",
		client: "XYZ Ltd",
		projectDesc: "Piping Fabrication",
		rceReceived: "2025-01-10",
		deadline: "2025-01-20",
		aging: 8,
		ceNo: "CE-2025-002",
		status: "Waiting for Information",
		remarks: "Need clarification on specs.",
		ceSubmitted: "",
		receivedBy: "Jane Smith",
		awardStatus: "",
		awardRemarks: "",
		recommendedAction: "Automated Reminder sent to Sales"
	},
	{
		id: 3,
		companyDesignation: "Client 2",
		department: "Dept 1",
		rceNo: "RCE-2025-003",
		client: "DEF Inc",
		projectDesc: "Electrical Upgrade",
		rceReceived: "2025-01-18",
		deadline: "2025-01-28",
		aging: 4,
		ceNo: "CE-2025-003",
		status: "Pending",
		remarks: "Awaiting internal review.",
		ceSubmitted: "",
		receivedBy: "Mike Johnson",
		awardStatus: "",
		awardRemarks: "",
		recommendedAction: ""
	},
	{
		id: 4,
		companyDesignation: "Client 2",
		department: "Dept 2",
		rceNo: "RCE-2025-004",
		client: "GHI Corp",
		projectDesc: "Structural Repair",
		rceReceived: "2025-01-05",
		deadline: "2025-01-15",
		aging: 15,
		ceNo: "CE-2025-004",
		status: "Done",
		remarks: "Submitted and awarded.",
		ceSubmitted: "2025-01-12",
		receivedBy: "Sarah Lee",
		awardStatus: "Awarded",
		awardRemarks: "JO-12345, file attached.",
		recommendedAction: "Move to Project Handover"
	},
	{
		id: 5,
		companyDesignation: "Client 1",
		department: "Dept 3",
		rceNo: "RCE-2025-005",
		client: "JKL Ltd",
		projectDesc: "Mechanical Seal Replacement",
		rceReceived: "2025-01-20",
		deadline: "2025-02-10",
		aging: 2,
		ceNo: "",
		status: "No Quote",
		remarks: "Scope too vague.",
		ceSubmitted: "",
		receivedBy: "Emily Brown",
		awardStatus: "",
		awardRemarks: "",
		recommendedAction: ""
	},
	{
		id: 6,
		companyDesignation: "Client 2",
		department: "Dept 1",
		rceNo: "RCE-2025-006",
		client: "MNO Corp",
		projectDesc: "Boiler Retubing",
		rceReceived: "2025-01-22",
		deadline: "2025-02-05",
		aging: 1,
		ceNo: "",
		status: "Cancelled",
		remarks: "Client cancelled request.",
		ceSubmitted: "",
		receivedBy: "David Wilson",
		awardStatus: "",
		awardRemarks: "",
		recommendedAction: ""
	}
];
function MonitoringHub({ tab, onTabChange, rceList, onViewRCE, onNewRCE, onOpenArchivedCE }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mon-hub",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "lib-tabs mon-hub-tabs",
				children: [
					["active", "Active"],
					["archive", "Archive"],
					["rce", "RCE Request"],
					["executive", "Executive Dashboard"]
				].map(([key, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: `ce-pill ${tab === key ? "ce-pill-active" : ""}`,
					onClick: () => onTabChange(key),
					children: label
				}, key))
			}),
			tab === "active" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MonitoringDashboard, { variant: "active" }),
			tab === "archive" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LibraryView, {
				mode: "archive",
				onOpenArchivedCE
			}),
			tab === "rce" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RCEInbox, {
				rceList,
				onViewRCE,
				onNewRCE
			}),
			tab === "executive" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MonitoringDashboard, { variant: "executive" })
		]
	});
}
function MonitoringDashboard({ variant = "active" }) {
	const [statusFilter, setStatusFilter] = (0, import_react.useState)("All");
	const [data] = (0, import_react.useState)(monitoringMockData);
	const filtered = statusFilter === "All" ? data : data.filter((d) => d.status === statusFilter);
	const totalPending = data.filter((d) => d.status === "Pending" || d.status === "Ongoing" || d.status === "Waiting for Information").length;
	const overdue = data.filter((d) => d.aging > 5 && d.status !== "Done" && d.status !== "Cancelled").length;
	const awardedCount = data.filter((d) => d.awardStatus === "Awarded").length;
	const totalQuotes = data.length;
	const winRate = totalQuotes > 0 ? Math.round(awardedCount / totalQuotes * 100) : 0;
	const statusColors = {
		Done: "#10B981",
		Ongoing: "#3B82F6",
		Pending: "#F59E0B",
		"Waiting for Information": "#FBBF24",
		Cancelled: "#6B7280",
		"No Quote": "#EF4444"
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mon-dashboard",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "mon-title",
				children: "Monitoring Dashboard"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mon-summary-cards",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mon-card",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mon-card-icon",
							style: { backgroundColor: "#3B82F6" },
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clock, { size: 24 })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "mon-card-label",
							children: "Total Pending"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "mon-card-value",
							children: totalPending
						})] })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mon-card",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mon-card-icon",
							style: { backgroundColor: "#EF4444" },
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleAlert, { size: 24 })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "mon-card-label",
							children: "Overdue"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "mon-card-value",
							children: overdue
						})] })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mon-card",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mon-card-icon",
							style: { backgroundColor: "#10B981" },
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Award, { size: 24 })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "mon-card-label",
							children: "Win Rate"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "mon-card-value",
							children: [winRate, "%"]
						})] })]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mon-filter-row",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mon-filter",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Funnel, { size: 16 }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
						value: statusFilter,
						onChange: (e) => setStatusFilter(e.target.value),
						className: "mon-filter-select",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "All",
								children: "All Statuses"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "Done",
								children: "Done"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "Ongoing",
								children: "Ongoing"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "Pending",
								children: "Pending"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "Waiting for Information",
								children: "Waiting for Information"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "Cancelled",
								children: "Cancelled"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "No Quote",
								children: "No Quote"
							})
						]
					})]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mon-table-container",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
					className: "mon-table",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Company Designation" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Department" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "RCE No." }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Client" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Project Description" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "RCE Received" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Deadline" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Aging (days)" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "CE No." }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Status" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Remarks" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "CE Submitted" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Received by" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Award Status" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Award Remarks" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Recommended Action" })
					] }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tbody", { children: [filtered.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: row.companyDesignation }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: row.department }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: row.rceNo }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: row.client }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: row.projectDesc }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: row.rceReceived }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: row.deadline }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: row.aging > 5 ? "mon-overdue" : "",
							children: row.aging
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: row.ceNo || "—" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "mon-status-badge",
							style: {
								backgroundColor: statusColors[row.status] + "20",
								color: statusColors[row.status]
							},
							children: row.status
						}) }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: row.remarks }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: row.ceSubmitted || "—" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: row.receivedBy }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "mon-award-badge",
							style: {
								backgroundColor: row.awardStatus === "Awarded" ? "#10B98120" : row.awardStatus === "Lost Bid" ? "#EF444420" : "transparent",
								color: row.awardStatus === "Awarded" ? "#10B981" : row.awardStatus === "Lost Bid" ? "#EF4444" : "inherit"
							},
							children: row.awardStatus || "—"
						}) }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: row.awardRemarks || "—" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "mon-recommended",
							children: row.recommendedAction
						}) })
					] }, row.id)), filtered.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						colSpan: 16,
						className: "mon-empty",
						children: "No records match the filter."
					}) })] })]
				})
			})
		]
	});
}
function buildDefaultSchemaConfig() {
	return {
		manpower: { columns: [
			{
				key: "role",
				label: "Role / Position",
				type: "text",
				visible: true,
				isCustom: false
			},
			{
				key: "dailyRate",
				label: "Daily Rate",
				type: "number",
				visible: true,
				isCustom: false
			},
			{
				key: "monthlyRate",
				label: "Monthly Rate",
				type: "number",
				visible: true,
				isCustom: false
			},
			{
				key: "perDiem",
				label: "Per Diem",
				type: "number",
				visible: true,
				isCustom: false
			},
			{
				key: "allowance",
				label: "Allowance",
				type: "number",
				visible: true,
				isCustom: false
			}
		] },
		equipment: { columns: [
			{
				key: "description",
				label: "Description",
				type: "text",
				visible: true,
				isCustom: false
			},
			{
				key: "unit",
				label: "Unit",
				type: "text",
				visible: true,
				isCustom: false
			},
			{
				key: "ratePerDay",
				label: "Daily Rate",
				type: "number",
				visible: true,
				isCustom: false
			}
		] },
		consumables: { columns: [
			{
				key: "description",
				label: "Description",
				type: "text",
				visible: true,
				isCustom: false
			},
			{
				key: "unit",
				label: "Unit",
				type: "text",
				visible: true,
				isCustom: false
			},
			{
				key: "unitCost",
				label: "Unit Cost",
				type: "number",
				visible: true,
				isCustom: false
			}
		] },
		ppe: { columns: [
			{
				key: "item",
				label: "Description",
				type: "text",
				visible: true,
				isCustom: false
			},
			{
				key: "unit",
				label: "Unit",
				type: "text",
				visible: true,
				isCustom: false
			},
			{
				key: "unitCost",
				label: "Unit Cost",
				type: "number",
				visible: true,
				isCustom: false
			}
		] },
		misc: { columns: [{
			key: "description",
			label: "Description",
			type: "text",
			visible: true,
			isCustom: false
		}, {
			key: "estimatedCost",
			label: "Estimated Cost",
			type: "number",
			visible: true,
			isCustom: false
		}] },
		clients: { columns: [
			{
				key: "clientCode",
				label: "Client Code",
				type: "text",
				visible: true,
				isCustom: false
			},
			{
				key: "fullName",
				label: "Full Name",
				type: "text",
				visible: true,
				isCustom: false
			},
			{
				key: "address",
				label: "Address",
				type: "text",
				visible: true,
				isCustom: false
			}
		] }
	};
}
function SchemaManagerModal({ sheetKey, sheetLabel, config, onClose, onSave }) {
	const [draftColumns, setDraftColumns] = (0, import_react.useState)(() => JSON.parse(JSON.stringify(config.columns || [])));
	const [newColLabel, setNewColLabel] = (0, import_react.useState)("");
	const [newColType, setNewColType] = (0, import_react.useState)("text");
	const moveUp = (idx) => {
		if (idx === 0) return;
		const next = [...draftColumns];
		[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
		setDraftColumns(next);
	};
	const moveDown = (idx) => {
		if (idx === draftColumns.length - 1) return;
		const next = [...draftColumns];
		[next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
		setDraftColumns(next);
	};
	const updateLabel = (idx, label) => {
		setDraftColumns((prev) => prev.map((c, i) => i === idx ? {
			...c,
			label
		} : c));
	};
	const toggleVisible = (idx) => {
		setDraftColumns((prev) => prev.map((c, i) => i === idx ? {
			...c,
			visible: !c.visible
		} : c));
	};
	const removeColumn = (idx) => {
		if (!draftColumns[idx].isCustom) return;
		setDraftColumns((prev) => prev.filter((_, i) => i !== idx));
	};
	const addColumn = () => {
		const label = newColLabel.trim();
		if (!label) return;
		const key = `custom_${uid("col")}`;
		setDraftColumns((prev) => [...prev, {
			key,
			label,
			type: newColType === "number" ? "number" : "text",
			visible: true,
			isCustom: true
		}]);
		setNewColLabel("");
		setNewColType("text");
	};
	const handleSave = () => {
		onSave({ columns: draftColumns });
		onClose();
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "ce-modal-overlay",
		onClick: onClose,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "ce-modal-card",
			onClick: (e) => e.stopPropagation(),
			style: { maxWidth: "720px" },
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
					className: "ce-serif",
					style: { marginTop: 0 },
					children: [
						"Manage Columns — ",
						sheetLabel,
						(() => {
							const hiddenCount = draftColumns.filter((c) => !c.visible).length;
							return hiddenCount > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								style: {
									fontSize: "0.8rem",
									color: "var(--ink-soft)",
									marginLeft: "0.5rem"
								},
								children: [
									"(",
									hiddenCount,
									" hidden)"
								]
							}) : null;
						})()
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					style: {
						color: "var(--ink-soft)",
						fontSize: "0.85rem",
						marginBottom: "1rem"
					},
					children: "Rename, hide, reorder, or add columns. Custom columns can be removed."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					style: {
						maxHeight: "50vh",
						overflowY: "auto"
					},
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
						className: "ce-table",
						style: { width: "100%" },
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								style: { width: "40%" },
								children: "Label"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								style: { width: "15%" },
								children: "Type"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								style: { width: "15%" },
								children: "Visible"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								style: { width: "20%" },
								children: "Reorder"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { style: { width: "10%" } })
						] }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: draftColumns.map((col, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								className: "ce-input",
								value: col.label,
								onChange: (e) => updateLabel(idx, e.target.value)
							}) }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								style: { textAlign: "center" },
								children: col.isCustom ? col.type : col.type
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								style: { textAlign: "center" },
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "checkbox",
									checked: col.visible,
									onChange: () => toggleVisible(idx)
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
								style: { textAlign: "center" },
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									className: "ce-btn-ghost ce-btn-sm",
									onClick: () => moveUp(idx),
									disabled: idx === 0,
									type: "button",
									title: "Move up",
									children: "▲"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									className: "ce-btn-ghost ce-btn-sm",
									onClick: () => moveDown(idx),
									disabled: idx === draftColumns.length - 1,
									type: "button",
									title: "Move down",
									children: "▼"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								style: { textAlign: "center" },
								children: col.isCustom && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									className: "ce-btn-ghost ce-btn-sm",
									onClick: () => removeColumn(idx),
									type: "button",
									title: "Remove custom column",
									children: "🗑️"
								})
							})
						] }, col.key)) })]
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					style: {
						marginTop: "1rem",
						paddingTop: "1rem",
						borderTop: "1px solid var(--border)"
					},
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
						style: {
							margin: "0 0 0.5rem",
							fontSize: "0.9rem"
						},
						children: "Add Custom Column"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						style: {
							display: "flex",
							gap: "0.5rem",
							alignItems: "center"
						},
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								className: "ce-input",
								placeholder: "Column name (e.g., Supplier)",
								value: newColLabel,
								onChange: (e) => setNewColLabel(e.target.value),
								style: { flex: 1 }
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
								className: "ce-input",
								value: newColType,
								onChange: (e) => setNewColType(e.target.value),
								style: { width: "120px" },
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "text",
									children: "Text"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "number",
									children: "Number"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								className: "ce-btn-primary ce-btn-sm",
								onClick: addColumn,
								type: "button",
								disabled: !newColLabel.trim(),
								children: "+ Add"
							})
						]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "modal-form-actions",
					style: {
						marginTop: "1rem",
						justifyContent: "space-between"
					},
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						className: "ce-btn-ghost",
						onClick: () => {
							if (window.confirm("Reset this sheet's columns to the default layout? Custom columns will be lost.")) onReset();
						},
						type: "button",
						style: { color: "var(--danger)" },
						children: "Reset to Default"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						style: {
							display: "flex",
							gap: "0.5rem"
						},
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							className: "ce-btn-ghost",
							onClick: onClose,
							type: "button",
							children: "Cancel"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							className: "ce-btn-primary",
							onClick: handleSave,
							type: "button",
							children: "Save Changes"
						})]
					})]
				})
			]
		})
	});
}
function DatabaseManager() {
	const store = useMasterlist();
	const [activeTab, setActiveTab] = (0, import_react.useState)("consumables");
	const [search, setSearch] = (0, import_react.useState)("");
	const [sortKey, setSortKey] = (0, import_react.useState)(null);
	const [sortDir, setSortDir] = (0, import_react.useState)("asc");
	const [modal, setModal] = (0, import_react.useState)(null);
	const [toast, setToast] = (0, import_react.useState)(null);
	const [customFields, setCustomFields] = (0, import_react.useState)([]);
	const [showManageFields, setShowManageFields] = (0, import_react.useState)(false);
	const [dbSchemaConfig, setDbSchemaConfig] = (0, import_react.useState)(null);
	const [showSchemaModal, setShowSchemaModal] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		const loadConfig = () => {
			try {
				const stored = localStorage.getItem("db_schema_config");
				if (stored) setDbSchemaConfig(JSON.parse(stored));
				else {
					const defaults = buildDefaultSchemaConfig();
					setDbSchemaConfig(defaults);
					localStorage.setItem("db_schema_config", JSON.stringify(defaults));
				}
			} catch (err) {
				console.warn("Could not read schema from localStorage:", err);
				setDbSchemaConfig(buildDefaultSchemaConfig());
			}
			setConfigLoading(false);
		};
		loadConfig();
	}, []);
	const saveSchemaConfig = (newConfig) => {
		setDbSchemaConfig(newConfig);
		try {
			localStorage.setItem("db_schema_config", JSON.stringify(newConfig));
		} catch (err) {
			console.warn("Could not save schema to localStorage:", err);
		}
	};
	const [configLoading, setConfigLoading] = (0, import_react.useState)(true);
	const fileInputRef = (0, import_react.useRef)(null);
	const allTabs = [
		{
			key: "manpower",
			label: "Manpower"
		},
		{
			key: "equipment",
			label: "Tools & Equipment"
		},
		{
			key: "consumables",
			label: "Consumables"
		},
		{
			key: "ppe",
			label: "Safety & PPE"
		},
		{
			key: "misc",
			label: "Miscellaneous"
		},
		{
			key: "clients",
			label: "Clients"
		},
		...store.customCategories.map((c) => ({
			key: c.categoryKey,
			label: c.categoryName
		}))
	];
	const customCategoryMap = new Map(store.customCategories.map((c) => [c.categoryKey, c]));
	const isClients = activeTab === "clients";
	const customCategory = store.customCategories.find((c) => c.categoryKey === activeTab);
	const isCustom = !!customCategory;
	({
		manpower: {
			label: "Manpower",
			labelKey: "role",
			fields: [
				{
					key: "role",
					label: "Role / Position",
					type: "text"
				},
				{
					key: "dailyRate",
					label: "Daily Rate",
					type: "number"
				},
				{
					key: "monthlyRate",
					label: "Monthly Rate",
					type: "number"
				},
				{
					key: "perDiem",
					label: "Per Diem",
					type: "number"
				},
				{
					key: "allowance",
					label: "Allowance",
					type: "number"
				}
			]
		},
		equipment: {
			label: "Tools & Equipment",
			labelKey: "description",
			fields: [
				{
					key: "description",
					label: "Description",
					type: "text"
				},
				{
					key: "unit",
					label: "Unit",
					type: "text"
				},
				{
					key: "ratePerDay",
					label: "Daily Rate",
					type: "number"
				}
			]
		},
		consumables: {
			label: "Consumables",
			labelKey: "description",
			fields: [
				{
					key: "description",
					label: "Description",
					type: "text"
				},
				{
					key: "unit",
					label: "Unit",
					type: "text"
				},
				{
					key: "unitCost",
					label: "Unit Cost",
					type: "number"
				}
			]
		},
		ppe: {
			label: "Safety & PPE",
			labelKey: "item",
			fields: [
				{
					key: "item",
					label: "Description",
					type: "text"
				},
				{
					key: "unit",
					label: "Unit",
					type: "text"
				},
				{
					key: "unitCost",
					label: "Unit Cost",
					type: "number"
				}
			]
		},
		misc: {
			label: "Miscellaneous",
			labelKey: "description",
			fields: [{
				key: "description",
				label: "Description",
				type: "text"
			}, {
				key: "estimatedCost",
				label: "Estimated Cost",
				type: "number"
			}]
		},
		clients: {
			label: "Clients",
			labelKey: "fullName",
			fields: [
				{
					key: "clientCode",
					label: "Client Code",
					type: "text"
				},
				{
					key: "fullName",
					label: "Full Name",
					type: "text"
				},
				{
					key: "address",
					label: "Address",
					type: "text"
				}
			]
		}
	})[activeTab];
	const items = isClients ? store.clients : isCustom ? customCategory.items : store[activeTab] || [];
	const fields = (dbSchemaConfig ? dbSchemaConfig[activeTab] || { columns: [] } : { columns: [] }).columns.filter((c) => c.visible);
	const labelKey = isClients ? "fullName" : isCustom ? "name" : "role";
	const activeLabel = (allTabs.find((t) => t.key === activeTab) || {}).label || activeTab;
	function handleSort(key) {
		if (sortKey === key) setSortDir((prev) => prev === "asc" ? "desc" : "asc");
		else {
			setSortKey(key);
			setSortDir("asc");
		}
	}
	function handleRenameCategory(category) {
		const newName = window.prompt("Enter new category name:", category.categoryName);
		if (newName && newName.trim()) store.updateCategory(category.id, { categoryName: newName.trim() });
	}
	function handleDeleteCategory(category) {
		if (window.confirm(`Delete category "${category.categoryName}"? This cannot be undone.`)) {
			store.deleteCategory(category.id);
			if (activeTab === category.categoryKey) setActiveTab("manpower");
		}
	}
	function openAddModal() {
		setModal({ mode: "add" });
	}
	function handleAddCustomField() {
		const label = window.prompt("Enter field name:");
		if (!label || !label.trim()) return;
		const normalizedType = window.prompt("Enter field type: text or number", "text") === "number" ? "number" : "text";
		setCustomFields((prev) => [...prev, {
			id: uid("cf"),
			label: label.trim(),
			type: normalizedType
		}]);
	}
	function handleRemoveCustomField(id) {
		if (!window.confirm("Remove this custom field from all items?")) return;
		setCustomFields((prev) => prev.filter((f) => f.id !== id));
		items.map((it) => {
			if (it.customFields && it.customFields[id]) {
				const { [id]: _, ...rest } = it.customFields;
				if (configLoading) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "db-container",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "db-header",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "Database" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Loading database configuration…" })]
					})
				});
				return {
					...it,
					customFields: rest
				};
			}
			return it;
		}).forEach((it) => {
			store.updateItem(activeTab, it.id, { customFields: it.customFields });
		});
	}
	function handleRenameCustomField(id) {
		const field = customFields.find((f) => f.id === id);
		if (!field) return;
		const newLabel = window.prompt("Enter new field name:", field.label);
		if (newLabel && newLabel.trim()) setCustomFields((prev) => prev.map((f) => f.id === id ? {
			...f,
			label: newLabel.trim()
		} : f));
	}
	function openEditModal(item) {
		setModal({
			mode: "edit",
			item
		});
	}
	function handleModalSave(values) {
		if (isClients) {
			if (modal.mode === "add") store.addClient(values);
			else store.updateClient(modal.item.id, values);
		} else if (modal.mode === "add") store.addItem(activeTab, {
			id: uid("ml"),
			...values
		});
		else store.updateItem(activeTab, modal.item.id, values);
		setModal(null);
	}
	function handleDuplicate(id) {
		if (isClients) {
			const src = store.clients.find((c) => c.id === id);
			if (src) store.addClient({
				clientCode: src.clientCode,
				fullName: src.fullName ? `${src.fullName} (Copy)` : src.fullName,
				address: src.address
			});
		} else store.duplicateItem(activeTab, id);
	}
	function handleDelete(id) {
		if (isClients) store.deleteClient(id);
		else store.deleteItem(activeTab, id);
	}
	const filteredAndSorted = [...search ? items.filter((it) => String(it[labelKey] || "").toLowerCase().includes(search.toLowerCase())) : items].sort((a, b) => {
		if (!sortKey) return 0;
		let valA, valB;
		if (sortKey === "No.") {
			valA = items.indexOf(a);
			valB = items.indexOf(b);
		} else {
			valA = a[sortKey];
			valB = b[sortKey];
		}
		if (typeof valA === "number" && typeof valB === "number") return sortDir === "asc" ? valA - valB : valB - valA;
		const strA = String(valA ?? "").toLowerCase();
		const strB = String(valB ?? "").toLowerCase();
		if (strA < strB) return sortDir === "asc" ? -1 : 1;
		if (strA > strB) return sortDir === "asc" ? 1 : -1;
		return 0;
	});
	fields.filter((f) => f.type === "number").map((f) => f.key);
	const formatNumber = (v) => num(v).toLocaleString("en-PH", { maximumFractionDigits: 2 });
	const handleCSV = async (e) => {
		const file = e.target.files?.[0];
		e.target.value = "";
		if (!file || isClients) return;
		try {
			const rows = await parseDatabaseCSV(file, activeTab);
			if (!rows.length) {
				setToast({
					type: "error",
					title: "No valid rows found",
					message: "Check CSV headers."
				});
				return;
			}
			store.bulkImportCategoryItems(activeTab, rows);
			setToast({
				type: "success",
				title: `Imported ${rows.length} item${rows.length > 1 ? "s" : ""}`,
				message: `Added to ${activeLabel}.`
			});
		} catch (err) {
			setToast({
				type: "error",
				title: "Import failed",
				message: err.message || "Couldn't read file."
			});
		}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "db-container",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "db-header",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "Database" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Manage the reference rates, clients, and categories your team pulls from when building cost estimates." })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "db-tabs",
				children: allTabs.map((tab) => {
					const customCat = customCategoryMap.get(tab.key);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "db-tab-wrapper",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => {
								setActiveTab(tab.key);
								setSearch("");
							},
							className: `db-tab ${activeTab === tab.key ? "db-tab-active" : ""}`,
							children: tab.label
						}), customCat && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "db-tab-icons",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								className: "db-tab-icon",
								title: "Rename category",
								onClick: () => handleRenameCategory(customCat),
								children: "✏️"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								className: "db-tab-icon",
								title: "Delete category",
								onClick: () => handleDeleteCategory(customCat),
								children: "🗑️"
							})]
						})]
					}, tab.key);
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "db-actions",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "db-search",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { size: 14 }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							value: search,
							onChange: (e) => setSearch(e.target.value),
							placeholder: `Search ${activeLabel.toLowerCase()}…`
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						className: "ce-btn-ghost",
						onClick: () => setShowSchemaModal(true),
						type: "button",
						title: "Manage columns for this sheet",
						children: "⚙️ Manage Schema"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						className: "ce-btn-ghost",
						onClick: () => setShowManageFields(!showManageFields),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Settings, { size: 15 }), " Manage Fields"]
					}),
					showManageFields && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "db-manage-fields-panel",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", { children: "Custom Fields" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								className: "ce-btn-ghost ce-btn-sm",
								onClick: handleAddCustomField,
								children: "+ Add Field"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
								className: "db-custom-fields-list",
								children: [customFields.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
									className: "db-custom-field-item",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
											f.label,
											" (",
											f.type,
											")"
										] }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											className: "ce-btn-ghost ce-btn-sm",
											onClick: () => handleRenameCustomField(f.id),
											children: "✏️ Rename"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											className: "ce-btn-ghost ce-btn-sm",
											onClick: () => handleRemoveCustomField(f.id),
											children: "🗑️ Remove"
										})
									]
								}, f.id)), customFields.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "No custom fields yet." })]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						className: "ce-btn-ghost",
						onClick: () => setModal({ mode: "addCategory" }),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderPlus, { size: 15 }), " Add Category"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						className: "ce-btn-ghost",
						disabled: isClients,
						onClick: () => fileInputRef.current?.click(),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, { size: 15 }), " Import CSV"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						className: "ce-btn-primary",
						onClick: openAddModal,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { size: 15 }), " Add New Item"]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
				ref: fileInputRef,
				type: "file",
				accept: ".csv",
				hidden: true,
				onChange: handleCSV
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "db-table-card",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
					className: "db-table",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("th", {
							style: {
								width: 50,
								cursor: "pointer"
							},
							onClick: () => handleSort("No."),
							children: ["No. ", sortKey === "No." && (sortDir === "asc" ? "▲" : "▼")]
						}),
						fields.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("th", {
							className: f.type === "number" ? "text-right" : "",
							style: { cursor: "pointer" },
							onClick: () => handleSort(f.key),
							children: [
								f.label,
								" ",
								sortKey === f.key && (sortDir === "asc" ? "▲" : "▼")
							]
						}, f.key)),
						customFields.map((cf) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: cf.label }, cf.id)),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							style: { width: 120 },
							children: "Actions"
						})
					] }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", {
						style: { minHeight: "200px" },
						children: filteredAndSorted.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", {
							className: "db-empty-row",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								colSpan: fields.length + customFields.length + 2,
								className: "db-no-match",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "db-empty-inline",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CloudUpload, { size: 28 }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "db-empty-title",
											children: "No items yet"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "db-empty-actions",
											children: [!isClients && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
												className: "ce-btn-ghost",
												onClick: () => fileInputRef.current?.click(),
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, { size: 13 }), " Import CSV"]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
												className: "ce-btn-primary",
												onClick: openAddModal,
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { size: 13 }), " Add Item"]
											})]
										})
									]
								})
							})
						}) : filteredAndSorted.map((it, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "db-row-num",
								children: idx + 1
							}),
							fields.map((f) => {
								if (f.isCustom) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: f.type === "number" ? "number" : "text",
									value: it.customFields?.[f.key] || "",
									onChange: (e) => store.updateItem(activeTab, it.id, { customFields: {
										...it.customFields || {},
										[f.key]: e.target.value
									} }),
									style: {
										width: "100%",
										border: "1px solid var(--border)",
										borderRadius: "4px",
										padding: "4px",
										fontSize: "0.85rem"
									}
								}) }, f.key);
								return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: f.type === "number" ? "text-right mono" : "",
									children: f.type === "number" ? formatNumber(Number(it[f.key]) || 0) : it[f.key] || "—"
								}, f.key);
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
								className: "db-actions-cell",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconBtn, {
										title: "Edit",
										onClick: () => openEditModal(it),
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pencil, { size: 14 })
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconBtn, {
										title: "Duplicate",
										onClick: () => handleDuplicate(it.id),
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { size: 14 })
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconBtn, {
										danger: true,
										title: "Delete",
										onClick: () => handleDelete(it.id),
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { size: 14 })
									})
								]
							})
						] }, it.id))
					})]
				})
			}),
			modal && modal.mode === "addCategory" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Modal, {
				title: "Add Category",
				onClose: () => setModal(null),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AddCategoryModal, {
					onCancel: () => setModal(null),
					onSave: (name) => {
						store.addCategory(name);
						setModal(null);
					}
				})
			}),
			modal && (modal.mode === "add" || modal.mode === "edit") && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Modal, {
				title: (modal.mode === "add" ? "Add " : "Edit ") + (isClients ? "Client" : activeLabel.replace(/s$/, "") + " Item"),
				onClose: () => setModal(null),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ItemFormModal, {
					fields,
					initialValues: modal.item,
					onCancel: () => setModal(null),
					onSave: handleModalSave
				})
			}),
			toast && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toast, {
				toast,
				onDismiss: () => setToast(null)
			}),
			showSchemaModal && dbSchemaConfig && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SchemaManagerModal, {
				sheetKey: activeTab,
				sheetLabel: activeLabel,
				config: dbSchemaConfig[activeTab] || { columns: [] },
				onClose: () => setShowSchemaModal(false),
				onReset: () => {
					const defaultSheet = buildDefaultSchemaConfig()[activeTab] || { columns: [] };
					const newConfig = {
						...dbSchemaConfig,
						[activeTab]: defaultSheet
					};
					saveSchemaConfig(newConfig);
					setShowSchemaModal(false);
				},
				onSave: (newSheetConfig) => {
					const newConfig = {
						...dbSchemaConfig,
						[activeTab]: newSheetConfig
					};
					saveSchemaConfig(newConfig);
				}
			})
		]
	});
}
function Modal({ title, onClose, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "modal-overlay",
		onClick: onClose,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "modal-content",
			onClick: (e) => e.stopPropagation(),
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "modal-header",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: title }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: onClose,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { size: 18 })
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "modal-body",
				children
			})]
		})
	});
}
function ItemFormModal({ fields, initialValues, onCancel, onSave }) {
	const [draft, setDraft] = (0, import_react.useState)(() => {
		const base = {};
		fields.forEach((f) => {
			if (f.isCustom) base[f.key] = initialValues?.customFields?.[f.key] ?? "";
			else base[f.key] = initialValues?.[f.key] ?? (f.type === "number" ? 0 : "");
		});
		return base;
	});
	fields[0]?.key;
	const handleSave = () => {
		const standardData = {};
		const customFieldsObj = {};
		fields.forEach((f) => {
			if (f.isCustom) customFieldsObj[f.key] = draft[f.key];
			else standardData[f.key] = draft[f.key];
		});
		onSave({
			...standardData,
			customFields: customFieldsObj
		});
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "modal-form-grid",
		children: [fields.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: f.label }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
			type: f.type === "number" ? "number" : "text",
			value: draft[f.key],
			onChange: (e) => setDraft({
				...draft,
				[f.key]: e.target.value
			})
		})] }, f.key)), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "modal-form-actions",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				className: "ce-btn-ghost",
				onClick: onCancel,
				children: "Cancel"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				className: "ce-btn-primary",
				onClick: handleSave,
				children: "Save"
			})]
		})]
	});
}
function AddCategoryModal({ onCancel, onSave }) {
	const [name, setName] = (0, import_react.useState)("");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Category Name" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
		autoFocus: true,
		value: name,
		placeholder: "e.g. Freight & Logistics",
		onChange: (e) => setName(e.target.value),
		onKeyDown: (e) => {
			if (e.key === "Enter" && name.trim()) onSave(name.trim());
		}
	})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "modal-form-actions",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			className: "ce-btn-ghost",
			onClick: onCancel,
			children: "Cancel"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			className: "ce-btn-primary",
			disabled: !name.trim(),
			onClick: () => onSave(name.trim()),
			children: "Create"
		})]
	})] });
}
function Toast({ toast, onDismiss }) {
	(0, import_react.useEffect)(() => {
		if (!toast) return;
		const t = setTimeout(onDismiss, 3500);
		return () => clearTimeout(t);
	}, [toast]);
	if (!toast) return null;
	const isError = toast.type === "error";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: `ce-toast ${isError ? "ce-toast-error" : "ce-toast-success"}`,
		children: [
			isError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleAlert, { size: 18 }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { size: 18 }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: toast.title }), toast.message && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: toast.message })] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				onClick: onDismiss,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { size: 14 })
			})
		]
	});
}
var CSV_FIELD_MAP = {
	manpower: {
		role: [
			"role",
			"role / position",
			"position"
		],
		dailyRate: [
			"dailyrate",
			"daily rate",
			"rate/day",
			"rate per day"
		],
		monthlyRate: [
			"monthlyrate",
			"monthly rate",
			"rate/month",
			"rate per month"
		],
		perDiem: ["perdiem", "per diem"],
		allowance: ["allowance"]
	},
	equipment: {
		description: [
			"description",
			"item",
			"name"
		],
		unit: [
			"unit",
			"uom",
			"unit of measure"
		],
		ratePerDay: [
			"rateperday",
			"rate per day",
			"daily rate",
			"rate/day"
		]
	},
	consumables: {
		description: [
			"description",
			"item",
			"name"
		],
		unit: [
			"unit",
			"uom",
			"unit of measure"
		],
		unitCost: [
			"unitcost",
			"unit cost",
			"cost",
			"rate"
		]
	},
	ppe: {
		item: [
			"item",
			"description",
			"name"
		],
		unit: [
			"unit",
			"uom",
			"unit of measure"
		],
		unitCost: [
			"unitcost",
			"unit cost",
			"cost",
			"rate"
		]
	},
	misc: {
		description: [
			"description",
			"item",
			"name"
		],
		estimatedCost: [
			"estimatedcost",
			"estimated cost",
			"cost"
		]
	},
	clients: {
		clientCode: [
			"clientcode",
			"client code",
			"code"
		],
		fullName: [
			"fullname",
			"full name",
			"name",
			"client"
		],
		address: ["address", "addr"]
	}
};
function resolveFieldMapping(headers, categoryKey) {
	const mapping = CSV_FIELD_MAP[categoryKey];
	if (!mapping) return null;
	const normalizedHeaders = headers.map((h) => String(h || "").trim().toLowerCase());
	const result = {};
	for (const [fieldKey, aliases] of Object.entries(mapping)) {
		const matchIdx = aliases.findIndex((alias) => normalizedHeaders.includes(alias));
		if (matchIdx !== -1) result[fieldKey] = headers[normalizedHeaders.indexOf(aliases[matchIdx])];
	}
	return result;
}
function parseDatabaseCSV(file, categoryKey) {
	return new Promise((resolve, reject) => {
		import_papaparse.default.parse(file, {
			header: true,
			skipEmptyLines: "greedy",
			transformHeader: (h) => String(h || "").trim(),
			complete: (results) => {
				try {
					if (!results.data || !Array.isArray(results.data)) return reject(/* @__PURE__ */ new Error("No data found in CSV."));
					const headers = results.meta?.fields || [];
					if (!headers.length) return reject(/* @__PURE__ */ new Error("No column headers found in CSV."));
					const fieldMapping = resolveFieldMapping(headers, categoryKey);
					if (!fieldMapping) return reject(/* @__PURE__ */ new Error(`CSV import is not supported for "${categoryKey}".`));
					if (Object.keys(fieldMapping).length === 0) return reject(/* @__PURE__ */ new Error("No matching columns found. Check your CSV headers against the expected fields."));
					resolve(results.data.map((rawRow) => {
						const row = {};
						for (const [fieldKey, csvHeader] of Object.entries(fieldMapping)) {
							const rawVal = rawRow[csvHeader];
							row[fieldKey] = rawVal === void 0 || rawVal === null ? "" : String(rawVal).trim();
						}
						return row;
					}).filter((row) => Object.values(row).some((v) => v !== "" && v !== null && v !== void 0)));
				} catch (err) {
					reject(err instanceof Error ? err : new Error(String(err)));
				}
			},
			error: (err) => reject(err instanceof Error ? err : new Error(String(err)))
		});
	});
}
function Dashboard({ ceList, onNewCE, onOpenCE, onNewInspection, currentUserName }) {
	const me = currentUserName || "Estimator A";
	const [status, setStatus] = (0, import_react.useState)("All");
	const { widths, updateWidth } = useResizableColumns("dash-user-mon-cols", {
		ceNo: 130,
		rce: 130,
		client: 170,
		project: 240,
		template: 120,
		status: 120,
		assigned: 150,
		lastEdited: 130
	});
	const mine = (ceList || []).filter((ce) => {
		return (ce.assignedTo || ce.lastEditedBy || me) === me;
	});
	const filtered = status === "All" ? mine : mine.filter((ce) => ce.status === status);
	const rowCount = Math.max(10, filtered.length);
	const rows = Array.from({ length: rowCount }, (_, i) => filtered[i] || null);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "dash-container",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "dash-header dash-header-actions-left",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				className: "ce-btn-ghost",
				onClick: onNewInspection,
				type: "button",
				children: "Create Inspection Report"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				className: "ce-btn-primary",
				onClick: onNewCE,
				type: "button",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { size: 15 }), " Cost Estimate"]
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "dash-user-mon",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "dash-user-mon-head",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "ce-serif",
					children: "User Monitoring"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "wiz-sub",
					children: ["Cost estimates assigned to ", me]
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mon-filter",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Funnel, { size: 16 }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
						value: status,
						onChange: (e) => setStatus(e.target.value),
						className: "mon-filter-select",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "All",
								children: "All statuses"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "Draft",
								children: "Draft"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "Ongoing",
								children: "Ongoing"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "Done",
								children: "Done"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "Parked",
								children: "Parked"
							})
						]
					})]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "ce-gridwrap dash-user-gridwrap",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
					className: "ce-table ce-bol-summary-table dash-user-table",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResizableTh, {
							colKey: "ceNo",
							width: widths.ceNo,
							onResize: updateWidth,
							children: "CE #"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResizableTh, {
							colKey: "rce",
							width: widths.rce,
							onResize: updateWidth,
							children: "RCE #"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResizableTh, {
							colKey: "client",
							width: widths.client,
							onResize: updateWidth,
							children: "Client"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResizableTh, {
							colKey: "project",
							width: widths.project,
							onResize: updateWidth,
							children: "Project"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResizableTh, {
							colKey: "template",
							width: widths.template,
							onResize: updateWidth,
							children: "Template"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResizableTh, {
							colKey: "status",
							width: widths.status,
							onResize: updateWidth,
							children: "Status"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResizableTh, {
							colKey: "assigned",
							width: widths.assigned,
							onResize: updateWidth,
							children: "Assigned"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResizableTh, {
							colKey: "lastEdited",
							width: widths.lastEdited,
							onResize: updateWidth,
							children: "Last Edited"
						})
					] }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: rows.map((ce, idx) => ce ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
						onClick: () => onOpenCE(ce),
						style: { cursor: "pointer" },
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "ce-mono",
								children: ce.id
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: ce.rceId || ce.rceNo || "—" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: ce.client || "—" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: ce.project }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: ce.templateType || "onsite" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "dash-status-badge",
								children: ce.status
							}) }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: ce.assignedTo || ce.lastEditedBy || "—" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: ce.lastEdited })
						]
					}, ce.id) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
						className: "dash-empty-row",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {})
						]
					}, `empty-${idx}`)) })]
				})
			})]
		})]
	});
}
function LibraryView({ onCloneTemplate, onOpenArchivedCE, mode = "library" }) {
	const [activeTab, setActiveTab] = (0, import_react.useState)(mode === "archive" ? "archive" : "templates");
	const [searchQuery, setSearchQuery] = (0, import_react.useState)("");
	const [selectedCE, setSelectedCE] = (0, import_react.useState)(null);
	const [selectedVersion, setSelectedVersion] = (0, import_react.useState)("Original");
	const templates = [
		{
			id: "tpl-1",
			title: "Standard Onsite",
			description: "Typical site-based cost estimate structure."
		},
		{
			id: "tpl-2",
			title: "Shop",
			description: "Workshop / fabrication oriented breakdown."
		},
		{
			id: "tpl-3",
			title: "Hybrid",
			description: "Mix of onsite and shop tasks."
		},
		{
			id: "tpl-4",
			title: "Trading",
			description: "Trading / resale cost model."
		}
	];
	const archivedCEs = [
		{
			id: "CE-2024-101",
			client: "ABC Corp",
			project: "Turbine Overhaul",
			date: "2024-11-12",
			rceNo: "RCE-2024-088",
			status: "Awarded",
			description: "Complete overhaul of steam turbine including rotor replacement and alignment."
		},
		{
			id: "CE-2024-102",
			client: "XYZ Ltd",
			project: "Piping Fabrication",
			date: "2024-10-03",
			rceNo: "RCE-2024-079",
			status: "Lost Bid",
			description: "Fabrication and installation of stainless steel piping for chemical plant."
		},
		{
			id: "CE-2024-103",
			client: "DEF Inc",
			project: "Electrical Upgrade",
			date: "2024-09-20",
			rceNo: "RCE-2024-071",
			status: "Pending",
			description: "Upgrade of main switchgear and distribution panels."
		},
		{
			id: "CE-2024-104",
			client: "GHI Corp",
			project: "Boiler Retubing",
			date: "2024-08-15",
			rceNo: "RCE-2024-065",
			status: "Done",
			description: "Replacement of boiler tubes and refractory lining."
		}
	];
	const versions = [
		{
			label: "Original",
			key: "Original"
		},
		{
			label: "Revision 1",
			key: "Revision 1"
		},
		{
			label: "Update",
			key: "Update"
		}
	];
	const evidenceMap = {
		Original: [
			"Supplier Quote.pdf",
			"Scope of Work.docx",
			"Initial Pricing.xlsx"
		],
		"Revision 1": [
			"Change Order.pdf",
			"Updated Drawings.pdf",
			"Revised Quote.xlsx"
		],
		Update: [
			"Final Approval.pdf",
			"As-Built Drawings.pdf",
			"Warranty Certificate.pdf"
		]
	};
	const filteredArchivedCEs = archivedCEs.filter((ce) => ce.client.toLowerCase().includes(searchQuery.toLowerCase()) || ce.project.toLowerCase().includes(searchQuery.toLowerCase()) || ce.id.toLowerCase().includes(searchQuery.toLowerCase()) || ce.rceNo.toLowerCase().includes(searchQuery.toLowerCase()));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "lib-container",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "lib-tabs",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					className: `ce-pill ${activeTab === "templates" ? "ce-pill-active" : ""}`,
					onClick: () => setActiveTab("templates"),
					children: "Templates"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					className: `ce-pill ${activeTab === "archive" ? "ce-pill-active" : ""}`,
					onClick: () => setActiveTab("archive"),
					children: "Search Archive"
				})]
			}),
			activeTab === "templates" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "lib-templates-grid",
				children: templates.map((tpl) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "ce-card lib-template-card",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "ce-serif lib-template-title",
							children: tpl.title
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "lib-template-desc",
							children: tpl.description
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							className: "ce-btn-ghost ce-btn-sm",
							onClick: () => onCloneTemplate && onCloneTemplate(tpl.id),
							type: "button",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { size: 14 }), " Clone"]
						})
					]
				}, tpl.id))
			}),
			activeTab === "archive" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "lib-archive",
				children: !selectedCE ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "lib-search-row",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "lib-search",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { size: 16 }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "text",
							placeholder: "Search by client, project, CE # or RCE #",
							value: searchQuery,
							onChange: (e) => setSearchQuery(e.target.value)
						})]
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "lib-archive-table-wrap",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
						className: "ce-table lib-archive-table",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "CE #" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "RCE #" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Client" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Project" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Status" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Date" })
						] }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tbody", { children: [filteredArchivedCEs.map((ce) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							onClick: () => {
								setSelectedCE(ce);
								setSelectedVersion("Original");
							},
							style: { cursor: "pointer" },
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "ce-mono",
									children: ce.id
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "ce-mono",
									children: ce.rceNo
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: ce.client }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: ce.project }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "dash-status-badge",
									style: {
										backgroundColor: ce.status === "Awarded" || ce.status === "Done" ? "#10B98120" : ce.status === "Pending" ? "#F59E0B20" : "#EF444420",
										color: ce.status === "Awarded" || ce.status === "Done" ? "#10B981" : ce.status === "Pending" ? "#F59E0B" : "#EF4444"
									},
									children: ce.status
								}) }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: ce.date })
							]
						}, ce.id)), filteredArchivedCEs.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							colSpan: 6,
							style: {
								textAlign: "center",
								padding: "1rem"
							},
							children: "No archived CE matches your search."
						}) })] })]
					})
				})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "lib-detail-view",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							className: "ce-btn-ghost ce-btn-sm",
							onClick: () => setSelectedCE(null),
							type: "button",
							style: { marginBottom: "1rem" },
							children: "← Back to Search"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "lib-detail-header",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
									className: "ce-serif lib-detail-title",
									children: [
										selectedCE.id,
										" — ",
										selectedCE.project
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "lib-detail-meta",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["RCE #: ", selectedCE.rceNo] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Status: ", selectedCE.status] })]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "lib-detail-desc",
									children: selectedCE.description
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "lib-detail-body",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "lib-versions-column",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "ce-field-label",
									children: "Versions Timeline"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
									className: "lib-versions-list",
									children: versions.map((v) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
										className: `lib-version-item ${selectedVersion === v.key ? "lib-version-item-active" : ""}`,
										onClick: () => setSelectedVersion(v.key),
										style: { cursor: "pointer" },
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `lib-version-dot ${v.key === "Original" ? "lib-version-dot-original" : ""}` }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: v.label })]
									}, v.key))
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "lib-evidence-column",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "ce-field-label",
										children: "Evidence Locker"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
										className: "lib-evidence-list",
										children: (evidenceMap[selectedVersion] || []).map((file, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
											className: "lib-evidence-item",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileText, { size: 14 }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: file })]
										}, idx))
									}),
									onOpenArchivedCE && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										className: "ce-btn-primary ce-btn-sm",
										onClick: () => onOpenArchivedCE(selectedCE.id),
										type: "button",
										style: { marginTop: "1rem" },
										children: "Open this CE"
									})
								]
							})]
						})
					]
				})
			})
		]
	});
}
function SalesRCEForm({ onSubmitRCE, onBack, readOnly = false, initialData = null }) {
	const COMPANY_CONFIG = {
		"Company 1": {
			logo: "🏭",
			docControlNo: "DC-001-2024",
			revisionDate: "2024-08-15",
			customer: "ABBRE - FULL NAME (CL1 - CLIENT 1)",
			item2Text: "IN-LINE WITH COMPANY 1 PRODUCTS AND SERVICES",
			salesManager: "Juan Dela Cruz",
			address: "123 Main St, Makati City"
		},
		"Company 2": {
			logo: "🏢",
			docControlNo: "DC-002-2024",
			revisionDate: "2024-09-01",
			customer: "ABBRE2 - FULL NAME (CL2 - CLIENT 2)",
			item2Text: "IN-LINE WITH COMPANY 2 PRODUCTS AND SERVICES",
			salesManager: "Maria Santos",
			address: "456 Second Ave, Quezon City"
		}
	};
	const initialCompany = initialData?.company || "Company 1";
	const [company, setCompany] = (0, import_react.useState)(initialCompany);
	const config = COMPANY_CONFIG[company];
	const [form, setForm] = (0, import_react.useState)(() => {
		const base = {
			projectType: "New Project",
			inquiryNumber: "",
			inquiryDate: "",
			rceNo: generateRceNo(),
			rceDate: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
			projectTitle: "",
			priorityLevel: "Medium",
			ceDeadline: "",
			submissionDeadline: "",
			shopwork: false,
			onsite: false,
			trading: false,
			mechanical: false,
			electrical: false,
			otherRemarks: "",
			declineReason: "",
			preparedBy: "",
			reviewedBy: config.salesManager,
			approvedBy: ""
		};
		if (initialData) return {
			...base,
			...initialData
		};
		return base;
	});
	const [checklist, setChecklist] = (0, import_react.useState)(() => {
		const emptyChecklist = {
			item1: {
				complete: "",
				remarks: ""
			},
			item2: {
				complete: "",
				remarks: ""
			},
			item3: {
				complete: "",
				remarks: ""
			},
			item4: {
				complete: "",
				remarks: ""
			},
			item5: {
				complete: "",
				remarks: ""
			},
			item6: {
				complete: "",
				remarks: ""
			},
			item7: {
				complete: "",
				remarks: ""
			},
			item8: {
				complete: "",
				remarks: ""
			},
			item9: {
				complete: "",
				remarks: ""
			},
			item10: {
				complete: "",
				remarks: ""
			},
			item11: {
				complete: "",
				remarks: ""
			},
			item12: {
				complete: "",
				remarks: ""
			},
			item13: {
				complete: "",
				remarks: ""
			},
			item14_1: {
				complete: "",
				remarks: ""
			},
			item14_2: {
				complete: "",
				remarks: ""
			},
			item14_3: {
				complete: "",
				remarks: ""
			}
		};
		if (initialData?.checklist) return {
			...emptyChecklist,
			...initialData.checklist
		};
		return emptyChecklist;
	});
	const [attachments, setAttachments] = (0, import_react.useState)(() => (initialData?.attachments || []).map((name) => ({
		name,
		url: "",
		type: ""
	})));
	const [showPage2, setShowPage2] = (0, import_react.useState)(false);
	function generateRceNo() {
		return `RCE-${(/* @__PURE__ */ new Date()).getFullYear()}-${String(Math.floor(Math.random() * 1e3)).padStart(3, "0")}`;
	}
	const handleChecklistChange = (key, field, value) => {
		if (readOnly) return;
		setChecklist((prev) => ({
			...prev,
			[key]: {
				...prev[key],
				[field]: value
			}
		}));
	};
	const handleFileUpload = (e) => {
		if (readOnly) return;
		const fileObjects = Array.from(e.target.files).map((file) => ({
			name: file.name,
			url: URL.createObjectURL(file),
			type: file.type
		}));
		setAttachments((prev) => [...prev, ...fileObjects]);
	};
	const handleSubmit = () => {
		if (readOnly) return;
		const rceData = {
			...form,
			company,
			customer: config.customer,
			address: config.address,
			checklist,
			attachments: attachments.map((a) => a.name)
		};
		if (onSubmitRCE) onSubmitRCE(rceData);
		setShowPage2(true);
	};
	const handleNew = () => {
		if (readOnly) return;
		setForm({
			projectType: "New Project",
			inquiryNumber: "",
			inquiryDate: "",
			rceNo: generateRceNo(),
			rceDate: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
			projectTitle: "",
			priorityLevel: "Medium",
			ceDeadline: "",
			submissionDeadline: "",
			shopwork: false,
			onsite: false,
			trading: false,
			mechanical: false,
			electrical: false,
			otherRemarks: "",
			declineReason: "",
			preparedBy: "",
			reviewedBy: config.salesManager,
			approvedBy: ""
		});
		setChecklist({
			item1: {
				complete: "",
				remarks: ""
			},
			item2: {
				complete: "",
				remarks: ""
			},
			item3: {
				complete: "",
				remarks: ""
			},
			item4: {
				complete: "",
				remarks: ""
			},
			item5: {
				complete: "",
				remarks: ""
			},
			item6: {
				complete: "",
				remarks: ""
			},
			item7: {
				complete: "",
				remarks: ""
			},
			item8: {
				complete: "",
				remarks: ""
			},
			item9: {
				complete: "",
				remarks: ""
			},
			item10: {
				complete: "",
				remarks: ""
			},
			item11: {
				complete: "",
				remarks: ""
			},
			item12: {
				complete: "",
				remarks: ""
			},
			item13: {
				complete: "",
				remarks: ""
			},
			item14_1: {
				complete: "",
				remarks: ""
			},
			item14_2: {
				complete: "",
				remarks: ""
			},
			item14_3: {
				complete: "",
				remarks: ""
			}
		});
		setAttachments([]);
		setShowPage2(false);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rce-checklist-container",
		children: [
			!readOnly && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				className: "ce-btn-ghost ce-btn-sm",
				onClick: onBack,
				children: "← Back to Dashboard"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rce-company-toggle",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Select Company:" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						className: `ce-pill ${company === "Company 1" ? "ce-pill-active" : ""}`,
						onClick: () => !readOnly && setCompany("Company 1"),
						disabled: readOnly,
						children: "Company 1"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						className: `ce-pill ${company === "Company 2" ? "ce-pill-active" : ""}`,
						onClick: () => !readOnly && setCompany("Company 2"),
						disabled: readOnly,
						children: "Company 2"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rce-header",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "rce-logo-box",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "rce-logo-text",
						children: config.logo
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rce-doc-control",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: ["Doc. Control No.: ", config.docControlNo] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: ["Revision Date: ", config.revisionDate] })]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "rce-title",
				children: "REQUEST FOR COSTING (RCE) CHECKLIST FORM"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rce-radio-row",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					type: "radio",
					name: "projectType",
					value: "New Project",
					checked: form.projectType === "New Project",
					onChange: (e) => !readOnly && setForm({
						...form,
						projectType: e.target.value
					}),
					disabled: readOnly
				}), "New Project"] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					type: "radio",
					name: "projectType",
					value: "Existing Project",
					checked: form.projectType === "Existing Project",
					onChange: (e) => !readOnly && setForm({
						...form,
						projectType: e.target.value
					}),
					disabled: readOnly
				}), "Existing Project"] })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rce-input-grid",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rce-field",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: "Customer" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "text",
							value: config.customer,
							readOnly: true
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rce-field",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: "Address" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "text",
							value: config.address,
							readOnly: true
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rce-field",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: "Inquiry Number" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "text",
							value: form.inquiryNumber,
							onChange: (e) => !readOnly && setForm({
								...form,
								inquiryNumber: e.target.value
							}),
							disabled: readOnly
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rce-field",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: "Inquiry Date" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "date",
							value: form.inquiryDate,
							onChange: (e) => !readOnly && setForm({
								...form,
								inquiryDate: e.target.value
							}),
							disabled: readOnly
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rce-field",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: "RCE No (Auto)" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "text",
							value: form.rceNo,
							readOnly: true
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rce-field",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: "RCE Date" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "date",
							value: form.rceDate,
							onChange: (e) => !readOnly && setForm({
								...form,
								rceDate: e.target.value
							}),
							disabled: readOnly
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rce-field",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: "Project Title" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "text",
							value: form.projectTitle,
							onChange: (e) => !readOnly && setForm({
								...form,
								projectTitle: e.target.value
							}),
							disabled: readOnly
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rce-field",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: "Priority Level" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
							value: form.priorityLevel,
							onChange: (e) => !readOnly && setForm({
								...form,
								priorityLevel: e.target.value
							}),
							disabled: readOnly,
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "Low" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "Medium" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "High" })
							]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rce-field",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: "CE Deadline" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "date",
							value: form.ceDeadline,
							onChange: (e) => !readOnly && setForm({
								...form,
								ceDeadline: e.target.value
							}),
							disabled: readOnly
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rce-field",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: "Submission Deadline" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "date",
							value: form.submissionDeadline,
							onChange: (e) => !readOnly && setForm({
								...form,
								submissionDeadline: e.target.value
							}),
							disabled: readOnly
						})]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rce-checkbox-group",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Project Type:" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "checkbox",
						checked: form.shopwork,
						onChange: (e) => !readOnly && setForm({
							...form,
							shopwork: e.target.checked
						}),
						disabled: readOnly
					}), "Shopwork"] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "checkbox",
						checked: form.onsite,
						onChange: (e) => !readOnly && setForm({
							...form,
							onsite: e.target.checked
						}),
						disabled: readOnly
					}), "On-site"] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "checkbox",
						checked: form.trading,
						onChange: (e) => !readOnly && setForm({
							...form,
							trading: e.target.checked
						}),
						disabled: readOnly
					}), "Trading"] })
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rce-checkbox-group",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Department:" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "checkbox",
						checked: form.mechanical,
						onChange: (e) => !readOnly && setForm({
							...form,
							mechanical: e.target.checked
						}),
						disabled: readOnly
					}), "Mechanical"] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "checkbox",
						checked: form.electrical,
						onChange: (e) => !readOnly && setForm({
							...form,
							electrical: e.target.checked
						}),
						disabled: readOnly
					}), "Electrical"] })
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
				className: "rce-checklist-table",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "ITEM NO." }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "DESCRIPTION" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "COMPLETE? (YES/NO/N/A)" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "REMARKS" })
				] }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tbody", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChecklistRow, {
						num: "1",
						desc: "CUSTOMER PROVIDED COMPLETE SPECIFICATIONS",
						complete: checklist.item1.complete,
						remarks: checklist.item1.remarks,
						onCompleteChange: (v) => handleChecklistChange("item1", "complete", v),
						onRemarksChange: (v) => handleChecklistChange("item1", "remarks", v),
						readOnly
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChecklistRow, {
						num: "2",
						desc: config.item2Text,
						complete: checklist.item2.complete,
						remarks: checklist.item2.remarks,
						onCompleteChange: (v) => handleChecklistChange("item2", "complete", v),
						onRemarksChange: (v) => handleChecklistChange("item2", "remarks", v),
						readOnly
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChecklistRow, {
						num: "3",
						desc: "PROJECT SCOPE CLEARLY DEFINED",
						complete: checklist.item3.complete,
						remarks: checklist.item3.remarks,
						onCompleteChange: (v) => handleChecklistChange("item3", "complete", v),
						onRemarksChange: (v) => handleChecklistChange("item3", "remarks", v),
						readOnly
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChecklistRow, {
						num: "4",
						desc: "REQUIRED DELIVERY DATE PROVIDED",
						complete: checklist.item4.complete,
						remarks: checklist.item4.remarks,
						onCompleteChange: (v) => handleChecklistChange("item4", "complete", v),
						onRemarksChange: (v) => handleChecklistChange("item4", "remarks", v),
						readOnly
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChecklistRow, {
						num: "5",
						desc: "BUDGETARY TARGET PROVIDED (IF ANY)",
						complete: checklist.item5.complete,
						remarks: checklist.item5.remarks,
						onCompleteChange: (v) => handleChecklistChange("item5", "complete", v),
						onRemarksChange: (v) => handleChecklistChange("item5", "remarks", v),
						readOnly
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChecklistRow, {
						num: "6",
						desc: "COMMERCIAL TERMS AVAILABLE (PAYMENT, WARRANTY, ETC.)",
						complete: checklist.item6.complete,
						remarks: checklist.item6.remarks,
						onCompleteChange: (v) => handleChecklistChange("item6", "complete", v),
						onRemarksChange: (v) => handleChecklistChange("item6", "remarks", v),
						readOnly
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChecklistRow, {
						num: "7",
						desc: "TECHNICAL DRAWINGS / SKETCHES ATTACHED",
						complete: checklist.item7.complete,
						remarks: checklist.item7.remarks,
						onCompleteChange: (v) => handleChecklistChange("item7", "complete", v),
						onRemarksChange: (v) => handleChecklistChange("item7", "remarks", v),
						readOnly
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChecklistRow, {
						num: "8",
						desc: "BILL OF MATERIALS AVAILABLE",
						complete: checklist.item8.complete,
						remarks: checklist.item8.remarks,
						onCompleteChange: (v) => handleChecklistChange("item8", "complete", v),
						onRemarksChange: (v) => handleChecklistChange("item8", "remarks", v),
						readOnly
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChecklistRow, {
						num: "9",
						desc: "SITE CONDITIONS / ACCESS DETAILS PROVIDED",
						complete: checklist.item9.complete,
						remarks: checklist.item9.remarks,
						onCompleteChange: (v) => handleChecklistChange("item9", "complete", v),
						onRemarksChange: (v) => handleChecklistChange("item9", "remarks", v),
						readOnly
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChecklistRow, {
						num: "10",
						desc: "PERMITS / COMPLIANCE REQUIREMENTS KNOWN",
						complete: checklist.item10.complete,
						remarks: checklist.item10.remarks,
						onCompleteChange: (v) => handleChecklistChange("item10", "complete", v),
						onRemarksChange: (v) => handleChecklistChange("item10", "remarks", v),
						readOnly
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChecklistRow, {
						num: "11",
						desc: "SAFETY REQUIREMENTS IDENTIFIED",
						complete: checklist.item11.complete,
						remarks: checklist.item11.remarks,
						onCompleteChange: (v) => handleChecklistChange("item11", "complete", v),
						onRemarksChange: (v) => handleChecklistChange("item11", "remarks", v),
						readOnly
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChecklistRow, {
						num: "12",
						desc: "TESTING / INSPECTION CRITERIA DEFINED",
						complete: checklist.item12.complete,
						remarks: checklist.item12.remarks,
						onCompleteChange: (v) => handleChecklistChange("item12", "complete", v),
						onRemarksChange: (v) => handleChecklistChange("item12", "remarks", v),
						readOnly
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChecklistRow, {
						num: "13",
						desc: "OTHER SPECIAL REQUIREMENTS",
						complete: checklist.item13.complete,
						remarks: checklist.item13.remarks,
						onCompleteChange: (v) => handleChecklistChange("item13", "complete", v),
						onRemarksChange: (v) => handleChecklistChange("item13", "remarks", v),
						readOnly
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: "14" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: "ATTACHMENTS" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {})
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChecklistRow, {
						num: "14.1",
						desc: "DRAWINGS",
						complete: checklist.item14_1.complete,
						remarks: checklist.item14_1.remarks,
						onCompleteChange: (v) => handleChecklistChange("item14_1", "complete", v),
						onRemarksChange: (v) => handleChecklistChange("item14_1", "remarks", v),
						readOnly
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChecklistRow, {
						num: "14.2",
						desc: "SPECIFICATIONS",
						complete: checklist.item14_2.complete,
						remarks: checklist.item14_2.remarks,
						onCompleteChange: (v) => handleChecklistChange("item14_2", "complete", v),
						onRemarksChange: (v) => handleChecklistChange("item14_2", "remarks", v),
						readOnly
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChecklistRow, {
						num: "14.3",
						desc: "OTHER DOCUMENTS",
						complete: checklist.item14_3.complete,
						remarks: checklist.item14_3.remarks,
						onCompleteChange: (v) => handleChecklistChange("item14_3", "complete", v),
						onRemarksChange: (v) => handleChecklistChange("item14_3", "remarks", v),
						readOnly
					})
				] })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rce-textarea-group",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: "OTHER REMARKS:" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
					rows: "3",
					value: form.otherRemarks,
					onChange: (e) => !readOnly && setForm({
						...form,
						otherRemarks: e.target.value
					}),
					disabled: readOnly
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rce-textarea-group",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: "REASON TO DECLINE / NO QUOTE:" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
					rows: "3",
					value: form.declineReason,
					onChange: (e) => !readOnly && setForm({
						...form,
						declineReason: e.target.value
					}),
					disabled: readOnly
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rce-upload",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: "Upload Attachments (PDF, Images):" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					type: "file",
					multiple: true,
					onChange: handleFileUpload,
					accept: ".pdf,image/*",
					disabled: readOnly
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rce-signatures",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: "Prepared by (Sales Rep)" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "text",
						value: form.preparedBy,
						onChange: (e) => !readOnly && setForm({
							...form,
							preparedBy: e.target.value
						}),
						placeholder: "Name",
						disabled: readOnly
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: "Reviewed by (Sales Manager)" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "text",
						value: form.reviewedBy,
						onChange: (e) => !readOnly && setForm({
							...form,
							reviewedBy: e.target.value
						}),
						disabled: readOnly
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: "Approved by (Technical Service Group)" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "text",
						value: form.approvedBy,
						onChange: (e) => !readOnly && setForm({
							...form,
							approvedBy: e.target.value
						}),
						disabled: readOnly
					})] })
				]
			}),
			!readOnly && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rce-actions",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						className: "ce-btn-primary",
						onClick: handleSubmit,
						children: "Submit"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						className: "ce-btn-ghost",
						onClick: handleNew,
						children: "New RCE"
					}),
					showPage2 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						className: "ce-btn-ghost",
						onClick: () => setShowPage2(!showPage2),
						children: showPage2 ? "Hide Page 2" : "Show Page 2 (Attachments)"
					})
				]
			}),
			!readOnly && showPage2 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rce-page2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("hr", {}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: "Page 2 — Attachments" }),
					attachments.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "No attachments uploaded." }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "rce-attachment-grid",
						children: attachments.map((att, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rce-attachment-item",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: att.name }), att.type.startsWith("image/") ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
								src: att.url,
								alt: att.name,
								style: { maxWidth: "200px" }
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
								href: att.url,
								target: "_blank",
								rel: "noreferrer",
								children: "Open PDF"
							})]
						}, idx))
					})
				]
			})
		]
	});
}
function ChecklistRow({ num, desc, complete, remarks, onCompleteChange, onRemarksChange, readOnly = false }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: num }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: desc }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
			value: complete,
			onChange: (e) => onCompleteChange(e.target.value),
			style: { width: "100%" },
			disabled: readOnly,
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
					value: "",
					children: "Select"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
					value: "YES",
					children: "YES"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
					value: "NO",
					children: "NO"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
					value: "N/A",
					children: "N/A"
				})
			]
		}) }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
			type: "text",
			value: remarks,
			onChange: (e) => onRemarksChange(e.target.value),
			placeholder: "Remarks",
			style: { width: "100%" },
			disabled: readOnly
		}) })
	] });
}
function RCEInbox({ rceList, onViewRCE }) {
	const getProjectType = (rce) => {
		const types = [];
		if (rce.shopwork) types.push("Shopwork");
		if (rce.onsite) types.push("On-site");
		if (rce.trading) types.push("Trading");
		return types.length > 0 ? types.join(", ") : "—";
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rce-inbox-container",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
			className: "ce-serif",
			children: "RCE Requests"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
			className: "ce-table rce-table",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "RCE #" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Client" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Project Title" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Project Type" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Priority" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Date Received" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Status" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Action" })
			] }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tbody", { children: [rceList.map((rce) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
					className: "ce-mono",
					children: rce.id
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: rce.client }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: rce.projectTitle || rce.description || "—" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: getProjectType(rce) }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: rce.priorityLevel || "—" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: rce.dateReceived || "—" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: rce.status || "—" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					className: "ce-btn-ghost ce-btn-sm",
					onClick: () => onViewRCE(rce),
					children: "View"
				}) })
			] }, rce.id)), rceList.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
				colSpan: 8,
				style: {
					textAlign: "center",
					padding: "1rem"
				},
				children: "No RCE requests yet."
			}) })] })]
		})]
	});
}
function RCEDetail({ rce, onBack, onGenerateCE }) {
	const [selectedAttachment, setSelectedAttachment] = (0, import_react.useState)(null);
	if (!rce) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rce-detail-container",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			className: "ce-btn-ghost ce-btn-sm",
			onClick: onBack,
			children: "← Back to RCE Inbox"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "No RCE selected." })]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rce-detail-container",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				className: "ce-btn-ghost ce-btn-sm",
				onClick: onBack,
				children: "← Back to RCE Inbox"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SalesRCEForm, {
				readOnly: true,
				initialData: rce,
				onBack,
				onSubmitRCE: () => {}
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "evidence-locker-section",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
					className: "ce-serif",
					children: "Evidence Locker"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "evidence-locker-buttons",
					children: rce.attachments && rce.attachments.length > 0 ? rce.attachments.map((att, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						className: "evidence-locker-button",
						onClick: () => setSelectedAttachment(att),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileText, { size: 16 }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: att })]
					}, idx)) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "No attachments uploaded." })
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				className: "ce-btn-primary",
				onClick: () => onGenerateCE(rce),
				children: "Generate Cost Estimate"
			}),
			selectedAttachment && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "evidence-modal-overlay",
				onClick: () => setSelectedAttachment(null),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "evidence-modal",
					onClick: (e) => e.stopPropagation(),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "evidence-modal-header",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
							className: "ce-serif",
							children: "Attachment Preview"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							className: "ce-btn-ghost ce-btn-sm",
							onClick: () => setSelectedAttachment(null),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { size: 16 })
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "evidence-modal-body",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "File:" }),
							" ",
							selectedAttachment
						] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Simulated preview — real file content would appear here." })]
					})]
				})
			})
		]
	});
}
function EstimateHome({ ceList, onNewCE, onOpenCE, onNewInspection, currentUserName }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dashboard, {
		ceList,
		onNewCE,
		onOpenCE,
		onNewInspection,
		currentUserName
	});
}
function SOWTab({ sowText, setSowText }) {
	const editor = useEditor({
		extensions: [
			StarterKit,
			Underline,
			TextStyle,
			Color,
			Highlight.configure({ multicolor: true })
		],
		content: sowText,
		onUpdate: ({ editor }) => {
			setSowText(editor.getHTML());
		}
	});
	if (!editor) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: "Loading editor..." });
	const hasTextStyle = editor.extensionManager.extensions.some((e) => e.name === "textStyle");
	const fontColors = [
		{
			label: "Black",
			value: "#000000"
		},
		{
			label: "Red",
			value: "#FF0000"
		},
		{
			label: "Blue",
			value: "#0000FF"
		},
		{
			label: "Green",
			value: "#008000"
		}
	];
	const highlightColors = [
		{
			label: "Yellow",
			value: "#FFEB3B"
		},
		{
			label: "Cyan",
			value: "#00FFFF"
		},
		{
			label: "Lime",
			value: "#00FF00"
		}
	];
	const handleSetColor = (color) => {
		if (!hasTextStyle) return;
		editor.chain().focus().setColor(color).run();
	};
	const handleToggleHighlight = (color) => {
		editor.chain().focus().toggleHighlight({ color }).run();
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "sow-editor-container",
		children: [
			!hasTextStyle && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				style: { color: "red" },
				children: "TextStyle extension not loaded!"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "sow-toolbar",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => editor.chain().focus().toggleBold().run(),
						className: editor.isActive("bold") ? "is-active" : "",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "B" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => editor.chain().focus().toggleItalic().run(),
						className: editor.isActive("italic") ? "is-active" : "",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("em", { children: "I" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => editor.chain().focus().toggleUnderline().run(),
						className: editor.isActive("underline") ? "is-active" : "",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("u", { children: "U" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => editor.chain().focus().toggleBulletList().run(),
						className: editor.isActive("bulletList") ? "is-active" : "",
						children: "• List"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "sow-toolbar-separator" }),
					fontColors.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						title: `Font ${c.label}`,
						onClick: () => handleSetColor(c.value),
						style: {
							backgroundColor: c.value,
							width: "20px",
							height: "20px",
							borderRadius: "50%",
							border: "1px solid #ccc",
							cursor: "pointer"
						}
					}, c.value)),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "sow-toolbar-separator" }),
					highlightColors.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						title: `Highlight ${c.label}`,
						onClick: () => handleToggleHighlight(c.value),
						style: {
							backgroundColor: c.value,
							width: "20px",
							height: "20px",
							borderRadius: "4px",
							border: "1px solid #ccc",
							cursor: "pointer"
						}
					}, c.value))
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(EditorContent, {
				editor,
				className: "sow-editor-content"
			})
		]
	});
}
function AttachmentsTab({ attachments }) {
	const list = attachments || [];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "ce-card",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "ce-card-header ce-card-header-compact",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "ce-chip",
					children: "ATTACHMENTS"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("b", {
					className: "ce-mono",
					children: [
						list.length,
						" file",
						list.length !== 1 ? "s" : ""
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "ce-attch-copy",
				children: "Files uploaded on each task and subtask are compiled here into one PDF."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				style: { padding: "0 1rem 0.75rem" },
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "ce-btn-primary ce-btn-sm",
					disabled: list.length === 0,
					onClick: () => compileAttachmentsToPdf(list, "Compiled Attachments"),
					children: "Compile to one PDF"
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "ce-table-scroll",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
					className: "ce-table",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "File Name" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "Sheet / Category" })] }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: list.map((file, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
						href: file.url || "#",
						target: "_blank",
						rel: "noreferrer",
						className: "ce-attachment-link",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileText, {
							size: 14,
							style: { marginRight: "0.5rem" }
						}), file.name]
					}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: file.sheet || "General" })] }, file.id || idx)) })]
				})
			})
		]
	});
}
function SummaryHeader({ docNo, setDocNo, revNo, setRevNo, revDate, setRevDate, viewType, setViewType }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "ce-summary-header",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "ce-summary-header-top",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "ce-summary-logo",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "LOGO" })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "ce-summary-title",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "ce-serif",
						children: "COST ESTIMATE SUMMARY"
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "ce-summary-docinfo",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("table", {
						className: "ce-docinfo-table",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tbody", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "ce-docinfo-label",
								children: "Document No:"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "text",
								value: docNo,
								onChange: (e) => setDocNo(e.target.value),
								className: "ce-docinfo-input"
							}) })] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "ce-docinfo-label",
								children: "Revision No:"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "text",
								value: revNo,
								onChange: (e) => setRevNo(e.target.value),
								className: "ce-docinfo-input"
							}) })] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "ce-docinfo-label",
								children: "Revision Date:"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "date",
								value: revDate,
								onChange: (e) => setRevDate(e.target.value),
								className: "ce-docinfo-input"
							}) })] })
						] })
					})
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "ce-summary-toggle-row",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: `ce-pill ${viewType === "Summary" ? "ce-pill-active" : ""}`,
				onClick: () => setViewType("Summary"),
				children: "Summary"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: `ce-pill ${viewType === "Breakdown" ? "ce-pill-active" : ""}`,
				onClick: () => setViewType("Breakdown"),
				children: "Breakdown"
			})]
		})]
	});
}
var NAV_ITEMS = [
	{
		key: "dashboard",
		label: "Dashboard",
		icon: LayoutDashboard
	},
	{
		key: "monitoring",
		label: "Monitoring",
		icon: Activity,
		redBorder: true
	},
	{
		key: "scope",
		label: "Scope Library",
		icon: Library
	},
	{
		key: "database",
		label: "Database",
		icon: Database
	},
	{
		key: "el-calculator",
		label: "EL Calculator",
		icon: Calculator
	},
	{
		key: "admin",
		label: "Admin",
		icon: Shield,
		pinBottom: true
	}
];
function navKeyForView(view) {
	if (view === "editor" || view === "ce-wizard" || view === "inspection" || view === "inspection-form") return "dashboard";
	if (view === "rce-form" || view === "rce-detail" || view === "rce-inbox") return "monitoring";
	return view;
}
function AppLayout({ currentView, setCurrentView, children }) {
	const [collapsed, setCollapsed] = (0, import_react.useState)(false);
	const activeKey = navKeyForView(currentView);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "ce-shell-outer",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
			className: `ce-sidebar ${collapsed ? "ce-sidebar-collapsed" : ""}`,
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "ce-sidebar-brand",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							className: "ce-hamburger",
							onClick: () => setCollapsed(!collapsed),
							title: collapsed ? "Expand sidebar" : "Collapse sidebar",
							children: "☰"
						}),
						!collapsed && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ClipboardList, { size: 18 }),
						!collapsed && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "ce-serif ce-sidebar-brand-text",
							children: "Cost Estimator"
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
					className: "ce-sidebar-nav",
					children: NAV_ITEMS.filter((item) => !item.pinBottom).map((item) => {
						const Icon = item.icon;
						const isActive = activeKey === item.key;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							"data-nav": item.key,
							className: "ce-navitem" + (isActive ? " ce-navitem-active" : "") + (item.redBorder ? " ce-navitem-monitoring" : ""),
							onClick: () => setCurrentView(item.key),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { size: 16 }), !collapsed && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: item.label })]
						}, item.key);
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "ce-sidebar-foot",
					children: NAV_ITEMS.filter((item) => item.pinBottom).map((item) => {
						const Icon = item.icon;
						const isActive = activeKey === item.key;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							"data-nav": item.key,
							"aria-label": item.label,
							className: "ce-navitem ce-navitem-admin" + (isActive ? " ce-navitem-active" : ""),
							onClick: () => setCurrentView(item.key),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { size: 16 }), !collapsed && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: item.label })]
						}, item.key);
					})
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
			className: "ce-mainpane",
			children
		})]
	});
}
function App({ initialWorkspace, onPersist, currentUserName }) {
	const workspace = initialWorkspace || {};
	const [currentView, setCurrentView] = (0, import_react.useState)("dashboard");
	const [activeCE, setActiveCE] = (0, import_react.useState)(null);
	const [isParked, setIsParked] = (0, import_react.useState)(false);
	const [ceList, setCeList] = (0, import_react.useState)(() => Array.isArray(workspace.ceList) && workspace.ceList.length ? workspace.ceList : [{
		id: "CE-2025-001",
		client: "ABC Corp",
		status: "Ongoing",
		project: "Turbine Overhaul",
		lastEdited: "2025-01-25",
		lastEditedBy: "Estimator A",
		assignedTo: "Estimator A"
	}]);
	const [rceList, setRceList] = (0, import_react.useState)(() => Array.isArray(workspace.rceList) ? workspace.rceList : []);
	const [documents, setDocuments] = (0, import_react.useState)(() => workspace.documents && typeof workspace.documents === "object" ? workspace.documents : {});
	const [inspectionReports, setInspectionReports] = (0, import_react.useState)(() => Array.isArray(workspace.inspectionReports) ? workspace.inspectionReports : []);
	const [adminConfig, setAdminConfig] = (0, import_react.useState)(() => normalizeAdminConfig(workspace.adminConfig));
	const [wizardRce, setWizardRce] = (0, import_react.useState)(null);
	const [activeOif, setActiveOif] = (0, import_react.useState)(null);
	const [monitoringTab, setMonitoringTab] = (0, import_react.useState)("active");
	const masterlistRef = (0, import_react.useRef)(workspace.masterlist && typeof workspace.masterlist === "object" ? workspace.masterlist : emptyMasterlistState());
	const [persistTick, setPersistTick] = (0, import_react.useState)(0);
	const persistRef = (0, import_react.useRef)(onPersist);
	persistRef.current = onPersist;
	const skipFirstPersist = (0, import_react.useRef)(true);
	(0, import_react.useEffect)(() => {
		const payload = {
			ceList,
			rceList,
			masterlist: masterlistRef.current,
			documents,
			inspectionReports,
			adminConfig,
			schemaConfig: workspace.schemaConfig || {}
		};
		if (skipFirstPersist.current) {
			skipFirstPersist.current = false;
			return;
		}
		persistRef.current?.(payload);
	}, [
		ceList,
		rceList,
		documents,
		inspectionReports,
		adminConfig,
		persistTick
	]);
	const [selectedRCE, setSelectedRCE] = (0, import_react.useState)(null);
	const [editingUser, setEditingUser] = (0, import_react.useState)(currentUserName || null);
	const [isEditorLocked, setIsEditorLocked] = (0, import_react.useState)(false);
	const editorName = editingUser || currentUserName || "Estimator A";
	const handleMasterlistChange = (next) => {
		masterlistRef.current = next;
		setPersistTick((n) => n + 1);
	};
	const handleDocumentChange = (id, doc) => {
		setDocuments((prev) => ({
			...prev,
			[id]: doc
		}));
		setCeList((prev) => prev.map((ce) => ce.id === id ? {
			...ce,
			lastEdited: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
			lastEditedBy: editorName,
			client: doc?.meta?.client || ce.client,
			project: doc?.meta?.title || ce.project,
			status: doc?.ceStatus || ce.status
		} : ce));
	};
	const handleStatusChange = (newStatus) => {
		if (activeCE) {
			const updatedCE = {
				...activeCE,
				status: newStatus
			};
			setActiveCE(updatedCE);
			setCeList((prev) => prev.map((ce) => ce.id === updatedCE.id ? updatedCE : ce));
		}
	};
	const handleSubmitRCE = (newRCE) => {
		const id = newRCE.id || newRCE.rceNo;
		setRceList([...rceList, {
			...newRCE,
			id,
			status: newRCE.status || "Pending",
			assignedTo: null
		}]);
		setMonitoringTab("rce");
		setCurrentView("monitoring");
	};
	const handleViewRCE = (rce) => {
		setSelectedRCE(rce);
		setCurrentView("rce-detail");
	};
	const openEditorForCE = (ce) => {
		setActiveCE(ce);
		setIsParked(false);
		setCurrentView("editor");
	};
	const handleGenerateCE = (rce) => {
		setWizardRce(rce);
		setCurrentView("ce-wizard");
	};
	const handleCreateFromWizard = (payload) => {
		const id = nextDocNo("CE", ceList);
		const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
		const newCE = {
			id,
			client: payload.client,
			location: payload.location,
			project: payload.project,
			status: "Draft",
			lastEdited: today,
			lastEditedBy: editorName,
			assignedTo: payload.assignedTo || editorName,
			rceId: payload.rceId || "",
			templateType: payload.templateType || "onsite",
			templateKind: payload.templateKind || "standard",
			sourceCeId: payload.sourceCeId || null
		};
		setCeList([...ceList, newCE]);
		if (payload.rceId) setRceList((prev) => prev.map((r) => {
			if ((r.id || r.rceNo) !== payload.rceId) return r;
			return {
				...r,
				assignedTo: editorName,
				ceId: id,
				status: r.status === "Pending" ? "Accepted" : r.status
			};
		}));
		if (payload.sourceCeId && documents[payload.sourceCeId]) try {
			const clone = JSON.parse(JSON.stringify(documents[payload.sourceCeId]));
			setDocuments((prev) => ({
				...prev,
				[id]: {
					...clone,
					meta: {
						...clone.meta || {},
						client: payload.client,
						title: payload.project,
						location: payload.location,
						date: today
					}
				}
			}));
		} catch {}
		setWizardRce(null);
		openEditorForCE(newCE);
	};
	const handleSaveInspection = (form) => {
		const id = form.id || nextDocNo("OIF", inspectionReports);
		const saved = {
			...form,
			id,
			oifNo: form.oifNo || id
		};
		setInspectionReports((prev) => {
			const idx = prev.findIndex((r) => r.id === id);
			if (idx >= 0) {
				const next = [...prev];
				next[idx] = saved;
				return next;
			}
			return [...prev, saved];
		});
		setActiveOif(saved);
		setCurrentView("dashboard");
	};
	const handleTakeOver = () => {
		setEditingUser(currentUserName || "Estimator A");
		setIsEditorLocked(false);
	};
	const editorPayload = activeCE && documents[activeCE.id] ? {
		...activeCE,
		...documents[activeCE.id]
	} : activeCE;
	const openArchived = (ceId) => {
		const archived = ceList.find((ce) => ce.id === ceId);
		if (archived) setActiveCE(archived);
		else setActiveCE({
			id: ceId,
			client: "Archived Client",
			status: "Draft",
			project: "Archived Project",
			lastEdited: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10)
		});
		setCurrentView("editor");
		setIsParked(false);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "ce-app",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DeleteConfirmProvider, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MasterlistProvider, {
			initialState: masterlistRef.current,
			onChange: handleMasterlistChange,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppLayout, {
				currentView,
				setCurrentView,
				children: [
					currentView === "dashboard" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EstimateHome, {
						ceList,
						currentUserName: editorName,
						onNewCE: () => {
							setWizardRce(null);
							setCurrentView("ce-wizard");
						},
						onNewInspection: () => {
							setActiveOif({ oifNo: nextDocNo("OIF", inspectionReports) });
							setCurrentView("inspection-form");
						},
						onOpenCE: openEditorForCE
					}),
					currentView === "ce-wizard" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NewCostEstimateWizard, {
						rceList,
						ceList,
						initialRce: wizardRce,
						currentUserName: editorName,
						onCancel: () => {
							setCurrentView(wizardRce ? "monitoring" : "dashboard");
							if (wizardRce) setMonitoringTab("rce");
						},
						onCreate: handleCreateFromWizard
					}),
					currentView === "editor" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CostEstimateTool, {
						ceData: editorPayload,
						status: activeCE?.status,
						onStatusChange: handleStatusChange,
						isParked,
						onParkToggle: setIsParked,
						goToLibrary: () => setCurrentView("scope"),
						goToSearch: () => setCurrentView("dashboard"),
						editingUser: editorName,
						isEditorLocked,
						onUserActivity: () => setEditingUser(editorName),
						onLock: () => setIsEditorLocked(true),
						onTakeOver: handleTakeOver,
						onDocumentChange: handleDocumentChange,
						documentControl: adminConfig.documentControl
					}, activeCE?.id || "new"),
					currentView === "database" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DatabaseManager, {}),
					currentView === "monitoring" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MonitoringHub, {
						tab: monitoringTab,
						onTabChange: setMonitoringTab,
						rceList,
						onViewRCE: handleViewRCE,
						onNewRCE: () => setCurrentView("rce-form"),
						onOpenArchivedCE: openArchived
					}),
					currentView === "inspection-form" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InspectionFormView, {
						initial: activeOif,
						onBack: () => setCurrentView("dashboard"),
						onSave: handleSaveInspection
					}),
					currentView === "el-calculator" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ElCalculatorView, {}),
					currentView === "admin" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminHub, {
						config: adminConfig,
						onChange: (next) => setAdminConfig(normalizeAdminConfig(next))
					}),
					currentView === "scope" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LibraryView, {
						onCloneTemplate: (templateId) => console.log("Cloning template:", templateId),
						onOpenArchivedCE: openArchived
					}),
					currentView === "rce-form" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SalesRCEForm, {
						onSubmitRCE: handleSubmitRCE,
						onBack: () => {
							setMonitoringTab("rce");
							setCurrentView("monitoring");
						}
					}),
					currentView === "rce-detail" && selectedRCE && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RCEDetail, {
						rce: selectedRCE,
						onBack: () => {
							setMonitoringTab("rce");
							setCurrentView("monitoring");
						},
						onGenerateCE: handleGenerateCE
					})
				]
			})
		}) })
	});
}
function EstimatorShell() {
	const currentUser = useCurrentUser();
	const [workspace, setWorkspace] = (0, import_react.useState)(() => defaultWorkspace());
	const [bootKey, setBootKey] = (0, import_react.useState)(0);
	const latest = (0, import_react.useRef)(workspace);
	const hydrated = (0, import_react.useRef)(false);
	const dirty = (0, import_react.useRef)(false);
	const timer = (0, import_react.useRef)(void 0);
	const write = (0, import_react.useCallback)((payload) => {
		if (timer.current) clearTimeout(timer.current);
		timer.current = setTimeout(() => {
			saveWorkspaceToSupabase(payload).catch(() => void 0);
		}, 650);
	}, []);
	(0, import_react.useEffect)(() => {
		let cancelled = false;
		loadWorkspaceFromSupabase().then((data) => {
			if (cancelled) return;
			if (dirty.current) {
				hydrated.current = true;
				write(latest.current);
				return;
			}
			latest.current = data;
			setWorkspace(data);
			setBootKey((n) => n + 1);
			hydrated.current = true;
		}).catch(() => {
			if (cancelled) return;
			hydrated.current = true;
		});
		return () => {
			cancelled = true;
		};
	}, [write]);
	const persist = (0, import_react.useCallback)((next) => {
		const safe = jsonSafe(next);
		latest.current = safe;
		dirty.current = true;
		if (!hydrated.current) return;
		write(safe);
	}, [write]);
	(0, import_react.useEffect)(() => {
		const flush = () => {
			if (!dirty.current) return;
			saveWorkspaceToSupabase(latest.current).catch(() => void 0);
		};
		const onHide = () => {
			if (document.visibilityState === "hidden") flush();
		};
		window.addEventListener("beforeunload", flush);
		document.addEventListener("visibilitychange", onHide);
		return () => {
			window.removeEventListener("beforeunload", flush);
			document.removeEventListener("visibilitychange", onHide);
			if (timer.current) clearTimeout(timer.current);
		};
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(App, {
		initialWorkspace: workspace,
		onPersist: persist,
		currentUserName: currentUser?.displayName ?? currentUser?.primaryEmail ?? "Estimator"
	}, bootKey);
}
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EstimatorShell, {});
}
//#endregion
export { Home as component };
