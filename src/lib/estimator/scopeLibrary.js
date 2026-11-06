// @ts-nocheck
/**
 * Scope library extras. Flag off does not call this, so today's empty "with resources" templates stay empty.
 */

export function saveAsScope({ name, owner, official, snapshot, jobType }) {
	return {
		name: String(name || "").trim() || "Saved scope",
		owner: String(owner || "").trim(),
		official: official === true,
		usage: 0,
		jobType: jobType || "onsite",
		snapshot: snapshot || {}
	};
}

export function bumpScopeUsage(record) {
	return {
		...record,
		usage: (Number(record?.usage) || 0) + 1
	};
}

/**
 * Typical labor, tools, and PPE for a prebuilt template. Rates stay 0 so the seed does not invent a total.
 * Trading gets a supply line instead of labor.
 * @param {string} workType
 */
export function resourceSeed(workType) {
	const key = String(workType || "onsite").toLowerCase();
	if (key === "trading") {
		return {
			BOL: [],
			BOTE: [],
			PPE: [],
			BOCM: [{ description: "Supply item", qty: 1, unit: "lot", unitCost: 0 }],
			MISC: []
		};
	}
	if (key === "shop" || key === "shopwork") {
		return {
			BOL: [{ role: "Welder", qty: 1, days: 1, rate: 0 }],
			BOTE: [{ description: "Welding machine", qty: 1, days: 1, rate: 0 }],
			PPE: [{ item: "Welding hood", qty: 1, unitCost: 0 }],
			BOCM: [],
			MISC: []
		};
	}
	return {
		BOL: [{ role: "Electrician", qty: 1, days: 1, rate: 0 }],
		BOTE: [{ description: "Power tool", qty: 1, days: 1, rate: 0 }],
		PPE: [{ item: "Hard hat", qty: 1, unitCost: 0 }],
		BOCM: [],
		MISC: []
	};
}
