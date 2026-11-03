import { readFileSync } from "node:fs";
import { ceOutputApi } from "../src/components/CostEstimatorApp.jsx";

const { buildMonitoringExportData, renderCostEstimatePdf } = ceOutputApi;

function textsOf(buf) {
	const raw = Buffer.from(buf).toString("latin1");
	return [...raw.matchAll(/\((?:\\\)|[^)])*\)/g)].map((hit) => hit[0].slice(1, -1).replace(/\\\(/g, "(").replace(/\\\)/g, ")"));
}

function money(text) {
	const match = String(text).match(/PHP\s*([0-9,]+\.\d{2})/);
	return match ? Number(match[1].replace(/,/g, "")) : null;
}

function firstMoney(texts, from) {
	for (let i = from; i < Math.min(texts.length, from + 6); i++) {
		const amount = money(texts[i]);
		if (amount != null) return amount;
	}
	return null;
}

function pageStart(texts, title) {
	for (let i = 0; i < texts.length; i++) {
		if (texts[i] !== title) continue;
		if (texts.slice(i, i + 5).some((text) => text.includes("F-TSG-025"))) return i;
	}
	return -1;
}

function totalAfter(texts, title, marker) {
	const start = pageStart(texts, title);
	if (start < 0) return null;
	for (let i = start; i < texts.length; i++) {
		if (texts[i] !== marker) continue;
		const amount = firstMoney(texts, i + 1);
		if (amount != null) return amount;
	}
	return null;
}

/** Page totals and summary lines read back from one rendered CE PDF. */
export async function renderedPageChecks() {
	const examples = JSON.parse(readFileSync(new URL("../src/lib/estimator/__fixtures__/ce-examples.json", import.meta.url), "utf8"));
	const direct = { model: "direct-v1", formula: {} };
	const tasks = examples.onsite.tasks;
	const sheets = {
		mobilization: { lines: [{ qty: 2, days: 1, rate: 150 }] },
		demobilization: { lines: [{ amount: 80 }] },
	};
	const data = buildMonitoringExportData({
		source: {
			tasks,
			pricing: direct,
			mobSheets: sheets,
			projectInfo: { quantity: "1", docNo: "CE-D5", description: "D5 check", client: "Client" },
		},
		tasks,
	}, {}, [], { ceDisplay: "CE-D5" });
	const handle = await renderCostEstimatePdf({ ...data, ceNumber: "CE-D5", pricing: direct });
	const blob = await handle.output("blob");
	const texts = textsOf(Buffer.from(await blob.arrayBuffer()));
	const summaryLabels = [
		["MANPOWER COST", "BOL"],
		["TOOLS AND EQUIPMENTS", "BOTE"],
		["MATERIALS AND CONSUMABLES", "BOCM"],
		["PERSONAL PROTECTIVE EQUIPMENT", "PPE"],
		["MOBILIZATION", "MOB"],
		["DEMOBILIZATION", "DEMOB"],
		["MISCELLANEOUS:", "MISC"],
	];
	const summary = {};
	const summaryEnd = texts.findIndex((text) => text === "SCOPE OF WORK" || text.startsWith("BILL OF"));
	const head = summaryEnd < 0 ? texts : texts.slice(0, summaryEnd);
	summaryLabels.forEach(([label, key]) => {
		const at = head.indexOf(label);
		summary[key] = at < 0 ? null : firstMoney(head, at + 1);
	});
	const pages = {
		BOL: totalAfter(texts, "BILL OF LABOR", "GRAND TOTAL"),
		BOTE: totalAfter(texts, "BILL OF TOOLS & EQUIPMENT", "GRAND TOTAL"),
		BOCM: totalAfter(texts, "BILL OF CONSUMABLES & MATERIALS", "GRAND TOTAL"),
		PPE: totalAfter(texts, "BILL OF PERSONAL PROTECTIVE EQUIPMENT", "GRAND TOTAL"),
		MISC: totalAfter(texts, "MISCELLANEOUS", "MISCELLANEOUS TOTAL:"),
		MOB: totalAfter(texts, "MOBILIZATION", "TOTAL"),
		DEMOB: totalAfter(texts, "DEMOBILIZATION", "TOTAL"),
	};
	return { summary, pages };
}
