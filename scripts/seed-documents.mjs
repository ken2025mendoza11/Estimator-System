/** Direct-v1 seed documents. Totals come from the lines, not from a stored number. */

export const DIRECT_SEEDS = [
	["shop", "CE-EX-SHOP", "Shop fabrication"],
	["onsite", "CE-EX-ONSITE", "Onsite work"],
	["trading", "CE-EX-TRADING", "Trading supply"],
	["hybrid", "CE-EX-HYBRID", "Hybrid estimate"],
];

export function buildDirectCes(examples) {
	const src = examples && typeof examples === "object" ? examples : {};
	return DIRECT_SEEDS.map(([key, id, project]) => {
		const example = src[key];
		if (!example || !Array.isArray(example.tasks)) throw new Error(`Missing seed example ${key}`);
		return {
			id,
			client: "Test Client",
			status: "Draft",
			project,
			lastEdited: "2026-10-20",
			lastEditedBy: "Test Staff",
			location: "Manila",
			rceId: "RCE-TEST-001",
			meta: {
				client: "Test Client",
				location: "Manila",
				date: "2026-10-20",
				title: project,
				subtitle: "",
			},
			tasks: example.tasks,
			commercial: example.commercial || { contingencyPct: 0, discountPct: 0 },
			summaryOverrides: example.summaryOverrides || {},
			projectInfo: { revNo: "0", docNo: id, quantity: 1 },
			pricing: { model: "direct-v1", formula: {} },
		};
	});
}
