/** Attachment order and display names. Saved versions keep their own copy. */

/**
 * @param {unknown} name
 * @returns {{ base: string, ext: string }}
 */
export function splitAttachmentName(name) {
	const text = String(name || "file");
	const dot = text.lastIndexOf(".");
	if (dot <= 0) return { base: text, ext: "" };
	return { base: text.slice(0, dot), ext: text.slice(dot) };
}

/**
 * @param {any} file
 * @param {unknown} nextBase
 * @returns {any}
 */
export function renameAttachment(file, nextBase) {
	const { ext } = splitAttachmentName(file?.name);
	const typed = String(nextBase || "").trim().replace(/[\\/]/g, "");
	const withoutTypedExt = typed.replace(/\.[^.]+$/, "");
	const base = withoutTypedExt || "file";
	return { ...file, name: `${base}${ext}` };
}

/**
 * @param {any[]} files
 * @param {number} fromIndex
 * @param {number} toIndex
 * @returns {any[]}
 */
export function reorderAttachments(files, fromIndex, toIndex) {
	const list = (files || []).map((file) => ({ ...file }));
	const from = Math.trunc(Number(fromIndex));
	const to = Math.trunc(Number(toIndex));
	if (from < 0 || to < 0 || from >= list.length || to >= list.length || from === to) return list;
	const [row] = list.splice(from, 1);
	list.splice(to, 0, row);
	return list;
}

/**
 * @param {any[]} files
 * @param {unknown} id
 * @param {unknown} typed
 * @returns {{ ok: boolean, message?: string, files: any[] }}
 */
export function removeAttachment(files, id, typed) {
	const list = (files || []).map((file) => ({ ...file }));
	if (String(typed || "") !== "REMOVE") return { ok: false, message: "Type REMOVE to remove this file.", files: list };
	return { ok: true, files: list.filter((file) => file.id !== id) };
}

/**
 * @param {any[] | null | undefined} files
 * @returns {any[]}
 */
export function copyAttachmentVersion(files) {
	return (files || []).map((file) => ({ ...file }));
}

/**
 * Compiled PDF page order is the saved array order, after any rename.
 * @param {any[] | null | undefined} files
 * @returns {string[]}
 */
export function compiledAttachmentNames(files) {
	return (files || []).map((file, index) => `${index + 1}. ${file?.name || "Untitled"}`);
}

/**
 * @param {any[] | null | undefined} files
 * @returns {any[]}
 */
export function attachmentFilesInOrder(files) {
	return (files || []).slice();
}

/**
 * @param {any[] | null | undefined} files
 * @param {{ order?: unknown, names?: unknown, removed?: unknown } | null | undefined} edits
 * @returns {any[]}
 */
export function applyAttachmentEdits(files, edits) {
	const names = edits && typeof edits.names === "object" && edits.names ? /** @type {Record<string, unknown>} */ (edits.names) : {};
	/** @type {unknown[]} */
	const removedList = Array.isArray(edits?.removed) ? edits.removed : [];
	const removed = new Set(removedList.map((id) => String(id)));
	let list = (files || []).filter((file) => !removed.has(String(file?.id || ""))).map((file) => {
		const next = names[String(file?.id || "")];
		return next ? renameAttachment(file, next) : { ...file };
	});
	const order = Array.isArray(edits?.order) ? edits.order.map((id) => String(id)) : [];
	if (!order.length) return list;
	const rank = new Map(order.map((id, index) => [id, index]));
	list = list.slice().sort((a, b) => {
		const ar = rank.has(String(a.id)) ? /** @type {number} */ (rank.get(String(a.id))) : 1e6;
		const br = rank.has(String(b.id)) ? /** @type {number} */ (rank.get(String(b.id))) : 1e6;
		return ar - br;
	});
	return list;
}
