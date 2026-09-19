// @ts-nocheck
export function isMissingMoney(value) {
  if (value === "" || value == null) return "empty";
  const n = Number(value);
  if (!Number.isFinite(n)) return "empty";
  if (n === 0) return "zero";
  return null;
}

function lineName(item) {
  return String(
    item?.role ||
      item?.item ||
      item?.description ||
      item?.name ||
      item?.fullName ||
      "",
  ).trim();
}

const CE_FIELDS = {
  BOL: [
    { key: "qty", label: "Qty" },
    { key: "days", label: "Days" },
    { key: "rate", label: "Rate/Day" },
    { key: "perDiem", label: "Per Diem" },
    { key: "allowance", label: "Allowance" },
  ],
  BOTE: [
    { key: "qty", label: "Qty" },
    { key: "days", label: "Days" },
    { key: "rate", label: "Rate/Day" },
  ],
  BOCM: [
    { key: "qty", label: "Qty" },
    { key: "unitCost", label: "Unit Cost" },
  ],
  PPE: [
    { key: "qty", label: "Qty" },
    { key: "unitCost", label: "Unit Cost" },
  ],
  MISC: [
    { key: "qty", label: "Qty" },
    { key: "unitCost", label: "Unit Cost" },
  ],
};

const CAT_TAB = {
  BOL: "BOL",
  BOTE: "BOTE",
  BOCM: "BOCM",
  PPE: "PPE",
  MISC: "MISC",
};

const CAT_LABEL = {
  BOL: "Bill of Labor",
  BOTE: "Tools & Equipment",
  BOCM: "Consumables",
  PPE: "Safety & PPE",
  MISC: "Miscellaneous",
};

export function scanNamedRows(rows, options) {
  const {
    sheet = "Form",
    tab = null,
    fields,
    nameKeys = ["description", "role", "item", "name"],
    extraPath = [],
  } = options;
  const findings = [];
  (rows || []).forEach((item, index) => {
    if (!item) return;
    const name =
      nameKeys.map((k) => String(item[k] || "").trim()).find(Boolean) || "";
    const hasAnyMoney = fields.some((f) => {
      const v = item[f.key];
      return v !== "" && v != null && Number(v) !== 0;
    });
    if (!name && !hasAnyMoney) return;
    const label = name || `Row ${index + 1}`;
    fields.forEach((field) => {
      const kind = isMissingMoney(item[field.key]);
      if (!kind) return;
      findings.push({
        id: `${item.id || `${sheet}-${index}`}:${field.key}`,
        itemId: String(item.id || `${sheet}-${index}`),
        tab,
        field: field.key,
        kind,
        path: [...extraPath, sheet, label, field.label],
      });
    });
  });
  return findings;
}

export function scanCostEstimate(tasks) {
  const findings = [];
  (tasks || []).forEach((task) => {
    (task.subtasks || []).forEach((sub) => {
      Object.keys(CE_FIELDS).forEach((cat) => {
        findings.push(
          ...scanNamedRows(sub.items?.[cat] || [], {
            sheet: CAT_LABEL[cat],
            tab: CAT_TAB[cat],
            fields: CE_FIELDS[cat],
            extraPath: [task.title || "Task", sub.title || "Subtask"],
          }),
        );
      });
    });
  });
  return findings;
}

const MASTER_SHEETS = [
  {
    key: "manpower",
    label: "Manpower",
    nameKeys: ["role"],
    fields: [
      { key: "dailyRate", label: "Daily Rate" },
      { key: "monthlyRate", label: "Monthly Rate" },
      { key: "perDiem", label: "Per Diem" },
      { key: "allowance", label: "Allowance" },
    ],
  },
  {
    key: "equipment",
    label: "Tools & Equipment",
    nameKeys: ["description"],
    fields: [
      { key: "ratePerDay", label: "Daily Rate" },
    ],
  },
  {
    key: "consumables",
    label: "Consumables",
    nameKeys: ["description"],
    fields: [{ key: "unitCost", label: "Unit Cost" }],
  },
  {
    key: "ppe",
    label: "Safety & PPE",
    nameKeys: ["item"],
    fields: [{ key: "unitCost", label: "Unit Cost" }],
  },
  {
    key: "misc",
    label: "Miscellaneous",
    nameKeys: ["description"],
    fields: [{ key: "estimatedCost", label: "Estimated Cost" }],
  },
];

export function scanMasterlist(store) {
  const findings = [];
  MASTER_SHEETS.forEach((sheet) => {
    findings.push(
      ...scanNamedRows(store?.[sheet.key] || [], {
        sheet: sheet.label,
        tab: sheet.key,
        fields: sheet.fields,
        nameKeys: sheet.nameKeys,
        extraPath: ["Database"],
      }),
    );
  });
  (store?.customCategories || []).forEach((cat) => {
    const numberKeys = Object.keys(cat.items?.[0] || {}).filter((k) => {
      if (["id", "name", "description", "item", "unit"].includes(k)) return false;
      const sample = cat.items.find((it) => it[k] != null && it[k] !== "");
      return sample ? Number.isFinite(Number(sample[k])) : false;
    });
    const fields = numberKeys.length
      ? numberKeys.map((key) => ({ key, label: key }))
      : [];
    if (!fields.length) return;
    findings.push(
      ...scanNamedRows(cat.items || [], {
        sheet: cat.categoryName || cat.categoryKey,
        tab: cat.categoryKey,
        fields,
        nameKeys: ["name", "description", "item"],
        extraPath: ["Database"],
      }),
    );
  });
  return findings;
}

export function locateZeroFinding(finding, setTab) {
  if (finding?.tab && typeof setTab === "function") setTab(finding.tab);
  const tryScroll = () => {
    const safeId = String(finding.id || "").replace(/"/g, "");
    const safeItem = String(finding.itemId || "").replace(/"/g, "");
    const fieldEl = document.querySelector(`[data-zero-field="${safeId}"]`);
    const rowEl = document.querySelector(`[data-zero-id="${safeItem}"]`);
    const el = fieldEl || rowEl;
    if (!el) return false;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ce-zero-flash");
    window.setTimeout(() => el.classList.remove("ce-zero-flash"), 2400);
    if (fieldEl && typeof fieldEl.focus === "function") fieldEl.focus();
    return true;
  };
  window.requestAnimationFrame(() => {
    if (tryScroll()) return;
    window.setTimeout(tryScroll, 120);
  });
}
