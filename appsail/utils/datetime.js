/**
 * Catalyst DataStore DateTime expects: "YYYY-MM-DD HH:mm:ss"
 * (NOT ISO 8601 with T/Z)
 */
export function toCatalystDateTime(date) {
  if (!date) return null;

  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;

  // "2025-12-30T13:15:19.123Z" -> "2025-12-30 13:15:19"
  return d.toISOString().replace("T", " ").replace(/\..+/, "");
}

export function unixSecondsToCatalystDateTime(unixSeconds) {
  const n = Number(unixSeconds);
  if (!Number.isFinite(n)) return null;
  return toCatalystDateTime(new Date(n * 1000));
}
