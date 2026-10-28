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
 * The first issue has no REV. A revision is the same number plus REV001, with no hyphen.
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
  return `${base}REV${String(revision).padStart(3, "0")}`;
}

/**
 * A job order number, including a revision with no hyphen before REV.
 * @param {unknown} joNo
 * @returns {boolean}
 */
export function jobOrderNoValid(joNo) {
  return /^JO-\d{3}-(SW|F|T|O)-[A-Z0-9]{1,8}-\d{2}-\d{4}(REV\d{3})?$/.test(String(joNo || "").trim());
}

/**
 * The 3-digit sequence restarts at 001 for each year. 26 and 27 can both have 001.
 * @param {Record<string, number> | null | undefined} counters
 * @param {unknown} year
 * @returns {{ ok: true, seq: number, yearKey: string, counters: Record<string, number> } | { ok: false, message: string }}
 */
export function nextYearSequence(counters, year) {
  const digits = String(year || "").replace(/\D/g, "");
  const yearKey = digits.length >= 2 ? digits.slice(-2) : "";
  if (!yearKey) return { ok: false, message: "A year is required." };
  const current = Number(counters?.[yearKey] || 0);
  if (!Number.isFinite(current) || current < 0) return { ok: false, message: "The year counter is not valid." };
  if (current >= 999) return { ok: false, message: "Job order numbers for this year are exhausted." };
  const seq = current + 1;
  return { ok: true, seq, yearKey, counters: { ...(counters || {}), [yearKey]: seq } };
}

/**
 * Refuse a number that is already registered or not in the job order format.
 * @param {unknown[] | null | undefined} registry
 * @param {unknown} joNo
 * @returns {{ ok: true, joNo: string } | { ok: false, message: string }}
 */
export function registerJobOrderNo(registry, joNo) {
  const jo = String(joNo || "").trim();
  if (!jobOrderNoValid(jo)) return { ok: false, message: "That job order number is not valid." };
  const taken = (Array.isArray(registry) ? registry : []).some((row) => String(row || "").trim() === jo);
  if (taken) return { ok: false, message: "That job order number is already used." };
  return { ok: true, joNo: jo };
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
