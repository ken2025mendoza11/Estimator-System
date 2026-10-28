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

const JO_TYPES = ["SW", "F", "T", "O"];

/**
 * JO-<3-digit seq>-<type>-<client code>-<YY>-<proposal control>.
 * The first issue has no REV. The first revision is REV001.
 * @param {number | string} seq
 * @param {string} type
 * @param {string} clientCode
 * @param {number | string} year
 * @param {string} controlNo
 * @param {number | string} [rev]
 * @returns {string}
 */
export function formatJobOrderNo(seq, type, clientCode, year, controlNo, rev) {
  const n = Math.trunc(Number(seq));
  if (!Number.isFinite(n) || n < 1 || n > 999) return "";
  const kind = String(type || "").trim().toUpperCase();
  if (!JO_TYPES.includes(kind)) return "";
  const code = String(clientCode || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{1,8}$/.test(code)) return "";
  const digits = String(year || "").replace(/\D/g, "");
  const yy = digits.length >= 2 ? digits.slice(-2) : "";
  if (!yy) return "";
  const control = String(controlNo || "").trim();
  if (!/^\d{4}$/.test(control)) return "";
  const base = `JO-${String(n).padStart(3, "0")}-${kind}-${code}-${yy}-${control}`;
  const revision = Math.trunc(Number(rev) || 0);
  if (!revision) return base;
  if (revision < 1 || revision > 999) return "";
  return `${base}-REV${String(revision).padStart(3, "0")}`;
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
