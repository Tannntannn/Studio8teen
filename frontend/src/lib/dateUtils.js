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

/** Compact chip label: "9am", "9:30am", "1pm". */
export function formatTime12hCompact(timeSlot) {
  const parsed = parseSlotStart(timeSlot);
  if (!parsed) return String(timeSlot || "");
  const { hours, minutes } = parsed;
  const suffix = hours >= 12 ? "pm" : "am";
  const h12 = hours % 12 || 12;
  return minutes === 0 ? `${h12}${suffix}` : `${h12}:${String(minutes).padStart(2, "0")}${suffix}`;
}

/**
 * Parse user input to 24h "HH:MM".
 * Accepts: "9:00 AM", "9am", "1:30 pm", or "09:00" (24h).
 */
export function parseTime12hInput(raw) {
  const s = String(raw).trim();
  if (!s) return null;

  const h24 = s.match(/^(\d{1,2}):(\d{2})$/);
  if (h24) {
    const h = Number(h24[1]);
    const min = Number(h24[2]);
    if (h > 23 || min > 59) return null;
    return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  }

  const h12 = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (h12) {
    let h = Number(h12[1]);
    const min = Number(h12[2] || 0);
    const ap = h12[3].toLowerCase();
    if (h < 1 || h > 12 || min > 59) return null;
    if (ap === "pm" && h !== 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  }

  return null;
}

export function slotsTo12hLines(slots) {
  return (slots || []).map(formatTime12h).join("\n");
}

export function parseSlotsFrom12hText(text) {
  return [
    ...new Set(
      String(text || "")
        .split(/[\n,]/)
        .map(parseTime12hInput)
        .filter(Boolean)
    ),
  ].sort();
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

/**
 * True if every provided time slot has already passed (local time).
 * Used to disable "today" on the client calendar when no future slots remain.
 */
export function areAllTimeSlotsPast(slotTimes, now = new Date()) {
  const times = (slotTimes || []).filter(Boolean);
  if (!times.length) return false;
  return times.every((t) => isTimeSlotPast(t, now));
}
