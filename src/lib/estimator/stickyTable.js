/** Indexes to freeze: the first column, plus Project when that header exists.
 * @param {string[]} headers
 */
export function freezePlan(headers) {
	const list = Array.isArray(headers) ? headers.map((h) => String(h || "")) : [];
	const projectIdx = list.findIndex((h) => /project/i.test(h));
	const indexes = [0];
	if (projectIdx > 0) indexes.push(projectIdx);
	else if (list.length > 1) indexes.push(1);
	return [...new Set(indexes)].filter((n) => n >= 0 && n < (list.length || 2)).sort((a, b) => a - b);
}

/** Left offsets for frozen columns, in the same order as their widths.
 * @param {number[]} widths
 */
export function freezeOffsets(widths) {
	let x = 0;
	return (widths || []).map((/** @type {number} */ w) => {
		const left = x;
		x += Number(w) || 0;
		return left;
	});
}

/** The pinned bar is only needed when the table is wider than the viewport.
 * @param {number} scrollWidth
 * @param {number} clientWidth
 */
export function stickyBarVisible(scrollWidth, clientWidth) {
	return Number(scrollWidth) > Number(clientWidth) + 1;
}

/** @param {HTMLElement} scroller @param {HTMLElement} proxy */
export function syncStickyScroll(scroller, proxy) {
	if (!scroller || !proxy) return () => {};
	const inner = /** @type {HTMLElement | null} */ (proxy.firstElementChild);
	const fit = () => {
		if (inner) inner.style.width = `${scroller.scrollWidth}px`;
		proxy.hidden = !stickyBarVisible(scroller.scrollWidth, scroller.clientWidth);
	};
	let lock = false;
	const fromTable = () => {
		if (lock) return;
		lock = true;
		proxy.scrollLeft = scroller.scrollLeft;
		lock = false;
	};
	const fromProxy = () => {
		if (lock) return;
		lock = true;
		scroller.scrollLeft = proxy.scrollLeft;
		lock = false;
	};
	fit();
	scroller.addEventListener("scroll", fromTable);
	proxy.addEventListener("scroll", fromProxy);
	const obs = typeof ResizeObserver === "function" ? new ResizeObserver(fit) : null;
	obs?.observe(scroller);
	return () => {
		scroller.removeEventListener("scroll", fromTable);
		proxy.removeEventListener("scroll", fromProxy);
		obs?.disconnect();
	};
}

/** @param {HTMLTableElement} table */
export function pinFrozenColumns(table) {
	if (!table?.tHead?.rows?.[0]) return;
	table.classList.add("ce-sticky-on");
	const head = [...table.tHead.rows[0].cells];
	const indexes = freezePlan(head.map((cell) => cell.textContent || ""));
	const widths = indexes.map((i) => head[i]?.getBoundingClientRect().width || 0);
	const offsets = freezeOffsets(widths);
	const leftOf = new Map(indexes.map((i, n) => [i, offsets[n]]));
	[...table.rows].forEach((row) => {
		[...row.cells].forEach((cell, i) => {
			if (!leftOf.has(i)) {
				if (cell.dataset.ceFrozen) {
					cell.style.left = "";
					cell.style.zIndex = "";
					delete cell.dataset.ceFrozen;
				}
				return;
			}
			cell.dataset.ceFrozen = "1";
			cell.style.left = `${leftOf.get(i)}px`;
			cell.style.zIndex = cell.closest("thead") ? "4" : "2";
		});
	});
}

/** 50-row case: scrolled into the table, the pinned bar stays up at a narrow viewport.
 * @param {{ rows?: number, rowPx?: number, viewportH?: number, scrolledToRow?: number, tableWidth?: number, viewportW?: number }} input
 */
export function stickyScrollCheck(input = {}) {
	const rows = Number(input.rows) || 0;
	const rowPx = Number(input.rowPx) || 36;
	const viewportH = Number(input.viewportH) || 0;
	const scrolledToRow = Number(input.scrolledToRow) || 0;
	const contentH = rows * rowPx;
	const scrollTop = scrolledToRow * rowPx;
	const tableOnScreen = contentH > scrollTop && scrollTop < contentH + viewportH;
	return {
		tableOnScreen,
		headerStuck: scrollTop > 0 && tableOnScreen,
		barVisible: tableOnScreen && stickyBarVisible(Number(input.tableWidth) || 0, Number(input.viewportW) || 0),
		atRow: scrolledToRow,
	};
}
