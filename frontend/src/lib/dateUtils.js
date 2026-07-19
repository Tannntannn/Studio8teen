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

/** Parse "HH:MM-HH:MM" end time; true if slot has already ended on local today. */
export function isTimeSlotPast(timeSlot, now = new Date()) {
  if (!timeSlot || typeof timeSlot !== "string") return false;
  const endPart = timeSlot.split("-")[1]?.trim();
  if (!endPart) return false;
  const [hh, mm] = endPart.split(":").map(Number);
  if (Number.isNaN(hh)) return false;
  const end = new Date(now);
  end.setHours(hh, mm || 0, 0, 0);
  return now >= end;
}
