/** Asia/Manila wall clock. Stored timestamps stay ISO UTC. */

export const PH_TIME_ZONE = "Asia/Manila";

/**
 * @param {Intl.DateTimeFormatPart[]} parts
 * @param {Intl.DateTimeFormatPartTypes} type
 */
function part(parts, type) {
  return parts.find((item) => item.type === type)?.value || "";
}

/** Manila date and time parts. Hour 24 from some engines is midnight. */
export function phParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PH_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  let hour = part(parts, "hour");
  if (hour === "24") hour = "00";
  return {
    year: part(parts, "year"),
    month: part(parts, "month"),
    day: part(parts, "day"),
    hour,
    minute: part(parts, "minute"),
  };
}

/** YYYY-MM-DD in Asia/Manila. */
export function phDate(date = new Date()) {
  const p = phParts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

export function phYear(date = new Date()) {
  return Number(phParts(date).year) || new Date().getUTCFullYear();
}

/**
 * Approval stamp text: "Name  YYYY-MM-DD HH:MM" in Manila.
 * @param {Date | string | number} date
 * @param {string} who
 */
export function phStamp(date, who) {
  const p = phParts(date instanceof Date ? date : new Date(date));
  const name = String(who || "").trim();
  return `${name}  ${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}
