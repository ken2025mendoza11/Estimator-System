// @ts-nocheck
/** Money helpers used by the cost estimate. Same formulas as the editor. */

export function finiteNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function roundMoney(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  const sign = v < 0 ? -1 : 1;
  return sign * Math.round((Math.abs(v) + Number.EPSILON) * 100) / 100;
}

export function checksumTotal(n) {
  return roundMoney(n);
}

/** BOCM and PPE line: quantity times unit cost, rounded to cents. */
export function qtyUnitAmount(qty, unitCost) {
  return roundMoney(finiteNumber(qty) * finiteNumber(unitCost));
}

/** MISC line: quantity times days (blank days count as 1) times unit cost. */
export function miscAmount(qty, days, unitCost) {
  return roundMoney(finiteNumber(qty) * (finiteNumber(days) || 1) * finiteNumber(unitCost));
}

/** Round each line first, then round the sum. */
export function sumRounded(amounts) {
  const total = (amounts || []).reduce((sum, amount) => sum + roundMoney(amount), 0);
  return roundMoney(total);
}

/** Grand total after contingency, then discount. Percents are 0–100. */
export function commercialNet(grand, contingencyPct, discountPct) {
  const base = finiteNumber(grand);
  const cont = finiteNumber(contingencyPct);
  const disc = finiteNumber(discountPct);
  return checksumTotal(base * (1 + cont / 100) * (1 - disc / 100));
}
