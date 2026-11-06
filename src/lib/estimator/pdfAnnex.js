// @ts-nocheck
/** Append ticked PDF annexes after a finished cost-estimate PDF. The base pages are not redrawn. */

import { PDFDocument } from "pdf-lib";

function dataUrlToBytes(dataUrl) {
	const parts = String(dataUrl || "").split(",");
	const base64 = parts.length > 1 ? parts[1] : parts[0];
	const bin = atob(base64);
	const bytes = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
	return bytes;
}

export async function stitchPdfAttachments(baseBytes, attachments) {
	const pdf = await PDFDocument.load(baseBytes);
	for (const file of attachments || []) {
		if (!file || file.include === false) continue;
		const bytes = file.bytes || (file.dataUrl ? dataUrlToBytes(file.dataUrl) : null);
		if (!bytes || !bytes.length) continue;
		const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
		const copied = await pdf.copyPages(src, src.getPageIndices());
		copied.forEach((page) => pdf.addPage(page));
	}
	return pdf.save();
}
