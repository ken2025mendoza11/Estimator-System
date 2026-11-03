import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { jsPDF } from "jspdf";
import ExcelJS from "exceljs";
import { ceOutputApi } from "../src/components/CostEstimatorApp.jsx";
import { buildCeExcelModel, fillCeTemplate } from "../src/lib/estimator/ceExcelTemplate.js";
import { buildOfficialBaseRows, projectTotal } from "../src/lib/estimator/ceTotals.js";
const { buildMonitoringExportData, exportJobOrderPackPdf, exportOifToPDF, exportRceToPDF, renderCostEstimatePdf } = ceOutputApi;

const examples = JSON.parse(readFileSync(new URL("../src/lib/estimator/__fixtures__/ce-examples.json", import.meta.url), "utf8"));
const direct = { model: "direct-v1", formula: {} };
const tasks = examples.onsite.tasks;
const sheets = { mobilization: { lines: [{ qty: 1, days: 1, rate: 0 }] }, demobilization: 0 };
const outDir = new URL("../sample-outputs/", import.meta.url);

mkdirSync(outDir, { recursive: true });

const data = buildMonitoringExportData({
	source: {
		tasks,
		pricing: direct,
		projectInfo: {
			client: "Sample Client",
			description: "Pump overhaul sample",
			quantity: "1",
			docNo: "CE-SAMPLE",
			date: "2026-11-03",
			location: "Cavite",
		},
		sowText: "<p>1. Dismantle the pump</p><p>1.1 Tag parts</p>",
		mobSheets: sheets,
	},
	tasks,
}, {}, [{ name: "Test Estimator" }], { ceDisplay: "CE-SAMPLE", client: "Sample Client", projectDesc: "Pump overhaul sample" });

const official = buildOfficialBaseRows(tasks, direct, sheets);
const byKey = Object.fromEntries(official.rows.map((row) => [row.key, row.computed]));

const ceHandle = await renderCostEstimatePdf({ ...data, ceNumber: "CE-SAMPLE", pricing: direct });
const ceBlob = await ceHandle.output("blob");
const cePdf = Buffer.from(await ceBlob.arrayBuffer());
writeFileSync(new URL("ce-sample.pdf", outDir), cePdf);
const ceRaw = cePdf.toString("latin1");
if (!ceRaw.includes("COST ESTIMATE SUMMARY") && !ceRaw.includes("BILL OF TOOLS")) {
	throw new Error("CE PDF is missing the summary or tools title");
}

const template = readFileSync(new URL("../public/templates/ce-template.xlsx", import.meta.url));
const filled = await fillCeTemplate(ExcelJS, template, buildCeExcelModel({
	tasks,
	pricing: direct,
	ceNumber: "CE-SAMPLE",
	mobSheets: sheets,
	sections: data.sections,
}));
if (filled.unresolved.length) throw new Error(`Excel unresolved: ${filled.unresolved.slice(0, 8).join(", ")}`);
if (filled.total !== projectTotal(tasks, direct, sheets)) throw new Error(`Excel total ${filled.total} != ${projectTotal(tasks, direct, sheets)}`);
for (const [page, summaryKey] of [["BOTE", "B"], ["BOCM", "C"], ["PPE", "D"], ["MOB", "MOB"], ["DEMOB", "DEMOB"]]) {
	if (Number(filled.pageTotals[page]) !== Number(byKey[summaryKey])) {
		throw new Error(`${page} ${filled.pageTotals[page]} != summary ${summaryKey} ${byKey[summaryKey]}`);
	}
}
writeFileSync(new URL("ce-sample.xlsx", outDir), Buffer.from(filled.buffer));

const rceDoc = new jsPDF({ unit: "mm", format: "a4" });
exportRceToPDF({
	rceNo: "RCE-SAMPLE",
	customer: "Sample Client",
	projectTitle: "Pump overhaul sample",
	priorityLevel: "High",
	checklistItems: [
		{ num: "1", desc: "Drawings received", complete: "Yes", remarks: "On file" },
		{ num: "2", desc: "Site access", complete: "No", remarks: "Gate pass pending" },
		{ num: "3", desc: "Photos", complete: "N/A", remarks: "" },
	],
	preparedBy: "Test Estimator",
	reviewedBy: "Test Reviewer",
	approvedBy: "Test Approver",
}, rceDoc);
writeFileSync(new URL("rce-sample.pdf", outDir), Buffer.from(rceDoc.output("arraybuffer")));

const oifDoc = new jsPDF({ unit: "mm", format: "a4" });
exportOifToPDF({
	oifNo: "OIF-SAMPLE",
	date: "2026-11-03",
	projectDescription: "Pump overhaul sample",
	rceNo: "RCE-SAMPLE",
	customerName: "Sample Client",
	customerRep: "Engr. Sample",
	clientAddress: "General Trias, Cavite",
	contactNo: "09170000000",
	activity: { onsite: true, shopwork: true, supplyOnly: false },
	serviceType: { repair: true, mechanical: true, others: true, othersText: "Laser alignment" },
	quantity: "1",
	length: "800",
	width: "400",
	drawingAvailable: "YES",
	scopeItems: ["1 Dismantle", "1.1 Tag parts", "2 Overhaul"],
	materials: [{ description: "Gasket", qty: 2, unit: "pc" }],
	consumables: [{ description: "Rags", qty: 1, unit: "kg" }],
	tools: [{ description: "Dial indicator", qty: 1, unit: "set" }],
	manpower: [{ designation: "Millwright", pax: 2, days: "3 days" }],
	duration: "5 days",
	remarks: "No obstruction.",
	notes: "Confirm isolation before work.",
	preparedBy: "Test Estimator",
	inspectedBy: "Test Inspector",
}, oifDoc);
writeFileSync(new URL("inspection-sample.pdf", outDir), Buffer.from(oifDoc.output("arraybuffer")));

const joPdf = await exportJobOrderPackPdf({
	joNo: "JO-001-SW-ABC-26-0137",
	dateIssued: "2026-11-03",
	type: "SW",
	client: "Sample Client",
	project: "Pump overhaul sample",
	poRef: "PO-SCC-2026-0457",
	prNo: "PR 26-0137",
	salesRepId: "sales-1",
	salesPosition: "Sales Representative",
	inCharge: "Engr. Test",
	inChargePosition: "Project Engineer",
	clientContact: "Engr. Sample",
	clientContactPosition: "Maint. Supt.",
	duration: "10 working days",
	leadtime: [{ span: "One (1) Day", text: "Mobilization and safety orientation" }],
	mobilization: "2026-11-16",
	ceIds: ["CE-SAMPLE"],
	annexA: true,
	status: "Draft",
}, [{ userId: "sales-1", name: "Test Sales" }], data, {});
writeFileSync(new URL("jo-sample.pdf", outDir), Buffer.from(joPdf));
const joRaw = Buffer.from(joPdf).toString("latin1");
if (!joRaw.includes("JOB ORDER FORM") && !joRaw.includes("REF. CE")) {
	throw new Error("JO PDF is missing the form title");
}
if (!joRaw.includes("FOR JO")) {
	throw new Error("JO annex is missing the prices-hidden footer");
}

console.log("rendered sample-outputs");
