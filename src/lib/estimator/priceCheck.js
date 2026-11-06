// @ts-nocheck
/**
 * Clone price check. Uses clonedFrom.idMap (old line id -> new line id).
 * Resync modes: all, selected, keep. The choice is logged. Constant drift is reported, not applied.
 * Flag off does not call this.
 */

const SHEETS = ["BOL", "BOTE", "PPE", "BOCM", "MISC"];
const MASTER_KEYS = {
	BOL: "manpower",
	BOTE: "equipment",
	PPE: "ppe",
	BOCM: "consumables",
	MISC: "misc"
};

function walkSubs(sub, taskId, out) {
	const items = sub?.items || {};
	SHEETS.forEach((sheet) => {
		(items[sheet] || []).forEach((line) => {
			if (line && line.id) out.push({ sheet, line, taskId, subId: sub.id });
		});
	});
	(sub?.children || []).forEach((child) => walkSubs(child, taskId, out));
}

export function walkLines(doc) {
	const out = [];
	(doc?.tasks || []).forEach((task) => {
		(task?.subtasks || []).forEach((sub) => walkSubs(sub, task.id, out));
	});
	return out;
}

function rateOf(line) {
	const n = Number(line?.rate ?? line?.unitCost);
	return Number.isFinite(n) ? n : null;
}

function labelOf(sheet, line) {
	if (sheet === "BOL") return line?.role || line?.name || line?.id;
	if (sheet === "PPE") return line?.item || line?.description || line?.id;
	return line?.description || line?.name || line?.item || line?.id;
}

function masterRows(masterlist, sheet) {
	const key = MASTER_KEYS[sheet];
	const bag = masterlist && typeof masterlist === "object" ? masterlist : {};
	if (Array.isArray(bag[key])) return bag[key];
	if (Array.isArray(bag)) return bag;
	return [];
}

function masterRate(sheet, line, masterlist) {
	const rows = masterRows(masterlist, sheet);
	let hit = null;
	if (line?.masterlistId) hit = rows.find((row) => row && row.id === line.masterlistId) || null;
	if (!hit) {
		const needle = String(labelOf(sheet, line) || "").trim().toLowerCase();
		if (needle) hit = rows.find((row) => String(labelOf(sheet, row) || "").trim().toLowerCase() === needle) || null;
	}
	if (!hit) return null;
	const n = Number(hit.rate ?? hit.dailyRate ?? hit.ratePerDay ?? hit.unitCost ?? hit.unitPrice);
	return Number.isFinite(n) ? n : null;
}

/**
 * @param {{ clone?: object, source?: object, masterlist?: object, idMap?: Record<string, string> }} input
 */
export function priceDrifts({ clone, source, masterlist, idMap }) {
	const map = idMap || clone?.clonedFrom?.idMap || {};
	const reverse = {};
	Object.keys(map).forEach((oldId) => {
		reverse[String(map[oldId])] = String(oldId);
	});
	const sourceLines = new Map(walkLines(source).map((row) => [String(row.line.id), row]));
	const drifts = [];
	walkLines(clone).forEach((row) => {
		const oldId = reverse[String(row.line.id)];
		if (!oldId) return;
		const src = sourceLines.get(oldId);
		const cloneRate = rateOf(row.line);
		const sourceRate = src ? rateOf(src.line) : null;
		const listed = masterRate(row.sheet, row.line, masterlist);
		const changed = sourceRate != null && cloneRate != null && sourceRate !== cloneRate;
		const offMaster = listed != null && cloneRate != null && listed !== cloneRate;
		if (!changed && !offMaster) return;
		drifts.push({
			lineId: row.line.id,
			sourceLineId: oldId,
			sheet: row.sheet,
			label: labelOf(row.sheet, row.line),
			cloneRate,
			sourceRate,
			masterRate: listed
		});
	});
	return drifts;
}

const CONSTANT_KEYS = ["steelDensity", "pipeFactor", "grooveAngleDeg", "grooveGapMm", "grooveReinforcementPct"];

/** Differences between the constants stored on the clone and the admin constants now. */
export function constantDrift(stored, current) {
	if (!stored || !current) return [];
	const out = [];
	CONSTANT_KEYS.forEach((key) => {
		if (stored[key] != null && current[key] != null && Number(stored[key]) !== Number(current[key])) {
			out.push({ key, stored: Number(stored[key]), current: Number(current[key]) });
		}
	});
	const left = stored.deposition || {};
	const right = current.deposition || {};
	[...new Set([...Object.keys(left), ...Object.keys(right)])].forEach((key) => {
		if (left[key] != null && right[key] != null && Number(left[key]) !== Number(right[key])) {
			out.push({ key: `deposition.${key}`, stored: Number(left[key]), current: Number(right[key]) });
		}
	});
	return out;
}

/**
 * @param {{ mode?: string, drifts?: object[], selectedIds?: string[] }} input
 */
export function resyncPlan({ mode, drifts, selectedIds }) {
	const list = Array.isArray(drifts) ? drifts : [];
	const choice = mode === "all" || mode === "selected" || mode === "keep" ? mode : "keep";
	const picked = new Set((selectedIds || []).map((id) => String(id)));
	const wanted = choice === "all" ? list : choice === "selected" ? list.filter((row) => picked.has(String(row.lineId))) : [];
	const patches = wanted.map((row) => ({
		lineId: row.lineId,
		rate: row.masterRate != null ? row.masterRate : row.sourceRate,
		from: row.cloneRate
	})).filter((row) => row.rate != null);
	return {
		mode: choice,
		patches,
		log: {
			at: new Date().toISOString(),
			mode: choice,
			count: patches.length,
			lineIds: patches.map((row) => row.lineId)
		}
	};
}

/** Apply rate patches onto a task tree. BOL and BOTE use rate. The other sheets use unitCost. */
export function applyLineRates(tasks, patches) {
	const byId = new Map((patches || []).map((row) => [String(row.lineId), row]));
	const mapItems = (items) => {
		const next = { ...items || {} };
		SHEETS.forEach((sheet) => {
			const field = sheet === "BOL" || sheet === "BOTE" ? "rate" : "unitCost";
			next[sheet] = (items?.[sheet] || []).map((line) => {
				const patch = byId.get(String(line?.id));
				if (!patch) return line;
				return { ...line, [field]: patch.rate };
			});
		});
		return next;
	};
	const mapSub = (sub) => ({
		...sub,
		items: mapItems(sub?.items),
		children: (sub?.children || []).map(mapSub)
	});
	return (tasks || []).map((task) => ({
		...task,
		subtasks: (task?.subtasks || []).map(mapSub)
	}));
}
