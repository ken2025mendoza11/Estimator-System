// @ts-nocheck
/** In-app notification matrix. A missing row stays on. Only an explicit false turns an event off. */

export const DEFAULT_NOTIFY_MATRIX = [
	{ event: "Needs your approval", enabled: true },
	{ event: "RCE accepted", enabled: true },
	{ event: "CE assigned", enabled: true },
	{ event: "Waiting for information", enabled: true },
	{ event: "Information returned", enabled: true },
	{ event: "RCE revised", enabled: true },
	{ event: "CE rejected", enabled: true },
	{ event: "Transferred", enabled: true },
	{ event: "Assist opened", enabled: true },
	{ event: "No quote", enabled: true },
	{ event: "Take-over requested", enabled: true },
	{ event: "Take-over approved", enabled: true },
	{ event: "Take-over declined", enabled: true },
	{ event: "Closing requested", enabled: true },
	{ event: "Reminder", enabled: true },
	{ event: "RCE changed", enabled: true },
	{ event: "CE approved", enabled: true }
];

export function normalizeNotifyMatrix(raw) {
	const list = Array.isArray(raw) ? raw : [];
	return DEFAULT_NOTIFY_MATRIX.map((row) => {
		const hit = list.find((item) => item && item.event === row.event);
		if (!hit || hit.enabled !== false) return { event: row.event, enabled: true };
		return { event: row.event, enabled: false };
	});
}

/** Unknown events stay on so a new notice is not dropped by accident. */
export function matrixAllows(matrix, event) {
	const name = String(event || "").trim();
	if (!name) return true;
	const rows = normalizeNotifyMatrix(matrix);
	const hit = rows.find((row) => row.event === name);
	if (!hit) return true;
	return hit.enabled === true;
}
