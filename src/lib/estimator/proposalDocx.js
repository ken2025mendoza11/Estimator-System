/** Word and PDF for a proposal. Both use proposalLines, so the text matches. */

import { Document, Packer, Paragraph, TextRun } from "docx";
import jsPDFDefault, { jsPDF as jsPDFNamed } from "jspdf";
import { proposalLines } from "./proposal.js";

/**
 * @param {any} proposal
 * @returns {Promise<Uint8Array>}
 */
export async function proposalDocxBytes(proposal) {
	const children = proposalLines(proposal).map((line) => new Paragraph({
		children: [new TextRun(String(line))],
	}));
	const doc = new Document({ sections: [{ children }] });
	const buffer = await Packer.toBuffer(doc);
	return new Uint8Array(buffer);
}

/**
 * @param {any} proposal
 * @returns {Uint8Array}
 */
export function proposalPdfBytes(proposal) {
	const Pdf = typeof jsPDFNamed === "function" ? jsPDFNamed : jsPDFDefault;
	const pdf = new Pdf({ unit: "pt", format: "a4" });
	const lines = proposalLines(proposal);
	let y = 48;
	lines.forEach((line) => {
		const text = String(line || " ");
		const parts = pdf.splitTextToSize(text, 500);
		parts.forEach((/** @type {string} */ part) => {
			if (y > 780) {
				pdf.addPage();
				y = 48;
			}
			pdf.text(part, 40, y);
			y += 16;
		});
	});
	const out = pdf.output("arraybuffer");
	return new Uint8Array(out);
}
