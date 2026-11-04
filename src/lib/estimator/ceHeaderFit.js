/** Header widths so labels wrap instead of overlapping. Flag ceTpl10 only. */

/**
 * @param {unknown} label
 * @returns {{ minPx: number, wraps: boolean, nowrap: boolean }}
 */
export function headerFit(label) {
	const text = String(label || "").replace(/\s+/g, " ").trim();
	const ce = /^ce\s*#$/i.test(text) || /^rce\s*#$/i.test(text);
	const project = /project/i.test(text);
	if (ce) return { minPx: 168, wraps: false, nowrap: true };
	if (project) return { minPx: 192, wraps: true, nowrap: false };
	const minPx = Math.max(76, Math.min(220, Math.ceil(text.length * 7.2) + 16));
	return { minPx, wraps: text.length > 14, nowrap: false };
}

/**
 * @param {unknown[]} labels
 * @param {number} viewport
 * @returns {boolean}
 */
export function headersReadable(labels, viewport) {
	const width = Number(viewport) || 0;
	return (labels || []).every((label) => {
		const fit = headerFit(label);
		return width >= 1024 && fit.minPx > 0 && (fit.nowrap || fit.wraps || fit.minPx <= width);
	});
}
