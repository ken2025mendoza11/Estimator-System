// @ts-nocheck
/** Fill the official CE workbook. Numbers stay numbers. Blank item rows are hidden. */

import { readFileSync } from "node:fs";
import ExcelJS from "exceljs";

export const CE_TEMPLATE_SHEETS = ["Summary", "BOL", "BOTE", "BOCM", "PPE", "MISC"];
const PESO = '"₱"#,##0.00';
const PLACEHOLDERS = 12;

function templatePath() {
  return new URL("../../../public/templates/ce-template.xlsx", import.meta.url);
}

/** Build the workbook that public/templates/ce-template.xlsx is a copy of. */
export function createCeTemplateWorkbook() {
  const wb = new ExcelJS.Workbook();
  const summary = wb.addWorksheet("Summary");
  summary.addRow(["ITEM", "DESCRIPTION", "TOTAL COST"]);
  summary.getRow(1).font = { bold: true };
  for (let i = 0; i < PLACEHOLDERS; i++) summary.addRow(["", "", null]);
  summary.addRow(["", "TOTAL AMOUNT:", { formula: `SUM(C2:C${PLACEHOLDERS + 1})`, result: 0 }]);
  summary.getColumn(3).numFmt = PESO;

  const pages = {
    BOL: ["Item No.", "Designation", "Qty", "NO. OF DAYS", "Unit Price", "Amount"],
    BOTE: ["Item No.", "Description", "Qty", "NO. OF DAYS", "Unit Price", "Electricity", "Amount"],
    BOCM: ["Item No.", "Description", "Qty", "Unit Price", "Amount"],
    PPE: ["Item No.", "Description", "Qty", "Unit Price", "Amount"],
    MISC: ["Item No.", "Description", "Qty", "NO. OF DAYS", "Unit Price", "Amount"],
  };
  Object.entries(pages).forEach(([name, headers]) => {
    const sheet = wb.addWorksheet(name);
    sheet.addRow([name]);
    sheet.getRow(1).font = { bold: true };
    sheet.addRow(headers);
    sheet.getRow(2).font = { bold: true };
    const amountCol = headers.length;
    for (let i = 0; i < PLACEHOLDERS; i++) sheet.addRow(headers.map(() => null));
    const first = 3;
    const last = 2 + PLACEHOLDERS;
    const col = String.fromCharCode(64 + amountCol);
    const totalRow = headers.map(() => null);
    totalRow[0] = "TOTAL";
    totalRow[amountCol - 1] = { formula: `SUM(${col}${first}:${col}${last})`, result: 0 };
    sheet.addRow(totalRow);
    sheet.getColumn(amountCol).numFmt = PESO;
    const priceCol = headers.indexOf("Unit Price") + 1;
    if (priceCol > 0) sheet.getColumn(priceCol).numFmt = PESO;
    if (name === "BOTE") sheet.getColumn(6).numFmt = PESO;
  });
  return wb;
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function writeItems(sheet, items, mapRow) {
  const header = sheet.getRow(2).values.slice(1);
  const amountCol = header.length;
  let total = 0;
  items.forEach((item, index) => {
    const row = sheet.getRow(3 + index);
    const cells = mapRow(item, index);
    cells.forEach((value, col) => {
      const cell = row.getCell(col + 1);
      cell.value = value;
      if (typeof value === "number") cell.numFmt = PESO;
    });
    row.hidden = false;
    total += num(cells[amountCol - 1]);
  });
  for (let i = items.length; i < PLACEHOLDERS; i++) {
    const row = sheet.getRow(3 + i);
    row.hidden = true;
    header.forEach((_, col) => {
      row.getCell(col + 1).value = null;
    });
  }
  const totalCell = sheet.getRow(3 + PLACEHOLDERS).getCell(amountCol);
  totalCell.value = { formula: totalCell.value?.formula || totalCell.formula || `SUM(${String.fromCharCode(64 + amountCol)}3:${String.fromCharCode(64 + amountCol)}${2 + PLACEHOLDERS})`, result: Math.round(total * 100) / 100 };
  totalCell.numFmt = PESO;
  return Math.round(total * 100) / 100;
}

/**
 * @param {{ summary?: { item?: string, label?: string, amount?: number }[], pages?: Record<string, object[]>, total?: number }} payload
 */
export async function fillCeTemplate(payload) {
  const src = payload || {};
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(readFileSync(templatePath()));
  const unresolved = [];
  CE_TEMPLATE_SHEETS.forEach((name) => {
    if (!wb.getWorksheet(name)) unresolved.push(name);
  });
  const summary = wb.getWorksheet("Summary");
  const lines = Array.isArray(src.summary) ? src.summary : [];
  if (summary) {
    lines.forEach((line, index) => {
      const row = summary.getRow(2 + index);
      row.getCell(1).value = line.item || "";
      row.getCell(2).value = line.label || "";
      row.getCell(3).value = num(line.amount);
      row.getCell(3).numFmt = PESO;
      row.hidden = false;
    });
    for (let i = lines.length; i < PLACEHOLDERS; i++) summary.getRow(2 + i).hidden = true;
    const total = num(src.total);
    const cell = summary.getRow(2 + PLACEHOLDERS).getCell(3);
    cell.value = { formula: `SUM(C2:C${1 + PLACEHOLDERS})`, result: total };
    cell.numFmt = PESO;
  }
  const pages = src.pages || {};
  const pageTotals = {};
  if (wb.getWorksheet("BOL")) {
    pageTotals.BOL = writeItems(wb.getWorksheet("BOL"), pages.BOL || [], (item, index) => [
      index + 1, item.designation || "", num(item.qty), num(item.days), num(item.unitPrice), num(item.amount),
    ]);
  }
  if (wb.getWorksheet("BOTE")) {
    pageTotals.BOTE = writeItems(wb.getWorksheet("BOTE"), pages.BOTE || [], (item, index) => [
      index + 1, item.description || "", num(item.qty), num(item.days), num(item.unitPrice), num(item.electricity), num(item.amount),
    ]);
  }
  ["BOCM", "PPE"].forEach((name) => {
    const sheet = wb.getWorksheet(name);
    if (!sheet) return;
    pageTotals[name] = writeItems(sheet, pages[name] || [], (item, index) => [
      index + 1, item.description || "", num(item.qty), num(item.unitPrice), num(item.amount),
    ]);
  });
  if (wb.getWorksheet("MISC")) {
    pageTotals.MISC = writeItems(wb.getWorksheet("MISC"), pages.MISC || [], (item, index) => [
      index + 1, item.description || "", num(item.qty), num(item.days), num(item.unitPrice), num(item.amount),
    ]);
  }
  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return { unresolved, total: num(src.total), pageTotals, buffer };
}
