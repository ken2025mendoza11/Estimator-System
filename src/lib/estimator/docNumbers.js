/** Document number format shared by the client fallback and next_doc_no. */

export const DOC_NUMBER_OFFLINE = "Connect to the internet to get a document number";

export const QTY_CAP = 1e6;
export const MONEY_CAP = 1e9;

/**
 * CE with a company code: CE-{code}-{year}-{nnn}
 * CE without one: CE-{year}-{nnn}
 * RCE: RCE-{year}-{nnn}
 * OIF: OIF-{year}-{nnn}
 * nnn is at least 3 digits and is not truncated.
 * @param {string} kind
 * @param {string} companyCode
 * @param {number | string} year
 * @param {number | string} serial
 */
export function formatDocNo(kind, companyCode, year, serial) {
  const n = String(Math.max(0, Math.trunc(Number(serial) || 0))).padStart(3, "0");
  const y = String(year);
  const key = String(kind || "").toLowerCase();
  if (key === "ce") {
    const code = String(companyCode || "").trim();
    return code ? `CE-${code}-${y}-${n}` : `CE-${y}-${n}`;
  }
  if (key === "rce") return `RCE-${y}-${n}`;
  if (key === "oif") return `OIF-${y}-${n}`;
  return "";
}

/**
 * True when PostgREST says next_doc_no is not deployed yet.
 * @param {unknown} error
 */
export function missingDocNumberRpc(error) {
  const record = error && typeof error === "object" ? /** @type {{ message?: string, code?: string }} */ (error) : {};
  const message = String(record.message || error || "");
  const code = String(record.code || "");
  if (code === "PGRST202" || code === "42883") return true;
  return /next_doc_no/i.test(message) && /does not exist|could not find|schema cache/i.test(message);
}

/**
 * Reject a new number the user is typing. Blank and non-numeric values are left
 * to the existing field. Stored rows are not rewritten here.
 * @param {string} field
 * @param {unknown} raw
 */
export function blockedNumberReason(field, raw) {
  const key = String(field || "");
  const percent = key === "contingencyPct" || key === "discountPct";
  const qty = key === "qty" || key === "days";
  const money = key === "rate" || key === "unitCost";
  if (!percent && !qty && !money) return "";
  const text = String(raw ?? "").trim();
  if (text === "") return "";
  const n = Number(text);
  if (!Number.isFinite(n)) return "";
  if (percent && (n < 0 || n > 100)) return "Must be between 0 and 100%.";
  if ((qty || money) && n < 0) return "Cannot be negative.";
  if (qty && n > QTY_CAP) return "Cannot be more than 1,000,000.";
  if (money && n > MONEY_CAP) return "Cannot be more than 1,000,000,000.";
  return "";
}
