/** SY3 job-order PDF. Names come from the roster. The job order number is drawn once. */

import jsPDFDefault, { jsPDF as jsPDFNamed } from "jspdf";
import { personName } from "./departments.js";
import { quantityAttachmentText } from "./jobOrder.js";

function pdfDoc() {
	const Pdf = typeof jsPDFNamed === "function" ? jsPDFNamed : jsPDFDefault;
	return new Pdf({ unit: "pt", format: "a4" });
}

/**
 * The SY3 form: a header block, a labelled field grid, and two signature blocks.
 * A backup's "for <primary approver name>" is the stored approverFor line.
 * @param {any} jo
 * @param {unknown[] | null | undefined} [users]
 */
export function sy3Form(jo, users) {
	const row = jo || {};
	const name = (/** @type {unknown} */ id) => personName(id, users);
	const joNo = String(row.joNo || "—");
	const salesperson = `${name(row.salesRepId)} ${row.salesPosition || ""}`.trim();
	const inCharge = `${row.inCharge || ""} ${row.inChargePosition || ""}`.trim();
	const contact = `${row.clientContact || ""} ${row.clientContactPosition || ""}`.trim();
	return {
		header: { mark: "SY3", title: "Job Order", number: joNo },
		fields: [
			["Date issued", String(row.dateIssued || "—")],
			["Client", String(row.client || "—")],
			["PO ref no.", String(row.poRef || "—")],
			["Project", String(row.project || "—")],
			["PR ref no.", String(row.prNo || "—")],
			["Salesperson", salesperson || "—"],
			["Project in charge", inCharge || "—"],
			["Client contact", contact || "—"],
			["Duration", String(row.duration || "—")],
			["Type", String(row.type || "—")],
			["Linked CE", (Array.isArray(row.ceIds) ? row.ceIds : []).join(", ") || "—"],
			["PO or NTP", `${row.poKind || ""} ${row.poFileName || "—"}`.trim()],
		],
		signatures: [
			{ label: "Prepared by", name: name(row.salesRepId) || "—", note: "" },
			{ label: "Checked and approved by", name: name(row.approverId) || "—", note: String(row.approverFor || "") },
		],
	};
}

/**
 * @param {any} jo
 * @param {unknown[] | null | undefined} [users]
 * @returns {string[]}
 */
export function jobOrderFormLines(jo, users) {
	const form = sy3Form(jo, users);
	const lines = [
		`${form.header.mark} ${form.header.title}`,
		`JO no. ${form.header.number}`,
	];
	form.fields.forEach(([label, value]) => lines.push(`${label} ${value}`.trim()));
	form.signatures.forEach((sig) => lines.push([sig.label, sig.name, sig.note].filter(Boolean).join(" ")));
	return lines;
}

/**
 * @param {any} pdf
 * @param {string[][]} fields
 * @param {number} x
 * @param {number} y
 * @param {number} width
 */
function drawLabelledGrid(pdf, fields, x, y, width) {
	const colW = width / 2;
	const rowH = 28;
	for (let i = 0; i < fields.length; i += 2) {
		if (y > 700) {
			pdf.addPage();
			y = 48;
		}
		const left = fields[i];
		const right = fields[i + 1];
		pdf.rect(x, y, colW, rowH);
		pdf.setFontSize(8);
		pdf.text(String(left[0]), x + 6, y + 10);
		pdf.setFontSize(10);
		pdf.text(String(left[1] || "—"), x + 6, y + 22);
		if (right) {
			pdf.rect(x + colW, y, colW, rowH);
			pdf.setFontSize(8);
			pdf.text(String(right[0]), x + colW + 6, y + 10);
			pdf.setFontSize(10);
			pdf.text(String(right[1] || "—"), x + colW + 6, y + 22);
		}
		y += rowH;
	}
	return y;
}

/**
 * @param {any} jo
 * @param {unknown[] | null | undefined} [users]
 * @returns {Uint8Array}
 */
export function jobOrderPdfBytes(jo, users) {
	const pdf = pdfDoc();
	const form = sy3Form(jo, users);
	pdf.rect(36, 24, 524, 48);
	pdf.setFontSize(16);
	pdf.text(form.header.mark, 44, 42);
	pdf.setFontSize(12);
	pdf.text(form.header.title, 84, 42);
	pdf.setFontSize(10);
	pdf.text(`JO no. ${form.header.number}`, 44, 60);
	let y = drawLabelledGrid(pdf, form.fields, 36, 84, 524);
	y += 18;
	const boxW = 250;
	const boxH = 72;
	form.signatures.forEach((sig, index) => {
		const x = 36 + index * (boxW + 24);
		if (y > 740) {
			pdf.addPage();
			y = 48;
		}
		pdf.rect(x, y, boxW, boxH);
		pdf.setFontSize(8);
		pdf.text(sig.label, x + 8, y + 16);
		pdf.setFontSize(11);
		pdf.text(sig.name || "—", x + 8, y + 36);
		if (sig.note) {
			pdf.setFontSize(10);
			pdf.text(sig.note, x + 8, y + 54);
		}
	});
	return new Uint8Array(pdf.output("arraybuffer"));
}

/**
 * Quantities-only attachment. Prices are already removed by quantityAttachmentText.
 * @param {unknown} value
 * @returns {Uint8Array}
 */
export function quantityAttachmentPdfBytes(value) {
	const pdf = pdfDoc();
	const text = quantityAttachmentText(value);
	pdf.setFontSize(14);
	pdf.text("Quantities only", 40, 40);
	pdf.setFontSize(10);
	let y = 62;
	String(text).split("\n").forEach((line) => {
		const parts = pdf.splitTextToSize(String(line || " "), 520);
		parts.forEach((/** @type {string} */ part) => {
			if (y > 780) {
				pdf.addPage();
				y = 48;
			}
			pdf.text(part, 40, y);
			y += 14;
		});
	});
	return new Uint8Array(pdf.output("arraybuffer"));
}
