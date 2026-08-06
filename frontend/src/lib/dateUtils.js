/** Local calendar date helpers — avoid UTC toISOString() day shifts (critical in UTC+8). */

export function localDateISO(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function monthEndISO(yearMonth) {
  const [y, m] = String(yearMonth).split("-").map(Number);
  const days = new Date(y, m, 0).getDate();
  return `${yearMonth}-${String(days).padStart(2, "0")}`;
}

/** Parse start time from "HH:MM" or "HH:MM-HH:MM". */
export function parseSlotStart(timeSlot) {
  if (!timeSlot || typeof timeSlot !== "string") return null;
  const startPart = timeSlot.split("-")[0]?.trim();
  if (!startPart) return null;
  const [hh, mm] = startPart.split(":").map(Number);
  if (Number.isNaN(hh)) return null;
  return { hours: hh, minutes: mm || 0 };
}

/** Display "09:00" / "13:30" as "9:00 AM" / "1:30 PM". */
export function formatTime12h(timeSlot) {
  const parsed = parseSlotStart(timeSlot);
  if (!parsed) return String(timeSlot || "");
  const { hours, minutes } = parsed;
  const suffix = hours >= 12 ? "PM" : "AM";
  const h12 = hours % 12 || 12;
  return `${h12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

/** Compact header label: "9a", "9:30a", "12p", "1:30p". */
export function formatTime12hCompact(timeSlot) {
  const parsed = parseSlotStart(timeSlot);
  if (!parsed) return String(timeSlot || "");
  const { hours, minutes } = parsed;
  const suffix = hours >= 12 ? "p" : "a";
  const h12 = hours % 12 || 12;
  return minutes === 0 ? `${h12}${suffix}` : `${h12}:${String(minutes).padStart(2, "0")}${suffix}`;
}

export function isAmSlot(timeSlot) {
  const parsed = parseSlotStart(timeSlot);
  return parsed ? parsed.hours < 12 : false;
}

/**
 * True if the slot start has already passed on local today.
 * Supports "HH:MM" and range "HH:MM-HH:MM" (uses range end).
 */
export function isTimeSlotPast(timeSlot, now = new Date()) {
  if (!timeSlot || typeof timeSlot !== "string") return false;
  const parts = timeSlot.split("-").map((p) => p.trim()).filter(Boolean);
  const comparePart = parts.length > 1 ? parts[1] : parts[0];
  if (!comparePart) return false;
  const [hh, mm] = comparePart.split(":").map(Number);
  if (Number.isNaN(hh)) return false;
  const boundary = new Date(now);
  boundary.setHours(hh, mm || 0, 0, 0);
  return now >= boundary;
}
