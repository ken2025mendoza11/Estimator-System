/** SY3 job-order PDF. The text is jobOrderLines, so names and the revision number match the screen. */

import jsPDFDefault, { jsPDF as jsPDFNamed } from "jspdf";
import { jobOrderLines } from "./jobOrder.js";

/**
 * @param {any} jo
 * @param {unknown[] | null | undefined} [users]
 * @returns {string[]}
 */
export function jobOrderFormLines(jo, users) {
	return jobOrderLines(jo, users);
}

/**
 * @param {any} jo
 * @param {unknown[] | null | undefined} [users]
 * @returns {Uint8Array}
 */
export function jobOrderPdfBytes(jo, users) {
	const Pdf = typeof jsPDFNamed === "function" ? jsPDFNamed : jsPDFDefault;
	const pdf = new Pdf({ unit: "pt", format: "a4" });
	pdf.setFontSize(14);
	pdf.text("SY3", 40, 36);
	pdf.setFontSize(10);
	let y = 58;
	jobOrderFormLines(jo, users).slice(1).forEach((line) => {
		const parts = pdf.splitTextToSize(String(line || " "), 520);
		parts.forEach((/** @type {string} */ part) => {
			if (y > 780) {
				pdf.addPage();
				y = 48;
			}
			pdf.rect(36, y - 11, 524, 16);
			pdf.text(part, 42, y);
			y += 20;
		});
	});
	return new Uint8Array(pdf.output("arraybuffer"));
}
