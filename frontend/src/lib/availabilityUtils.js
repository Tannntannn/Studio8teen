/** Derive slot status from availability row */
export function getSlotStatus(slot) {
  if (!slot || slot.is_enabled === false) return "closed";
  if (slot.booked_count >= slot.capacity) return "full";
  if (slot.booked_count > 0) return "partial";
  return "available";
}

export function isSlotSelectable(slot) {
  return getSlotStatus(slot) === "available" || getSlotStatus(slot) === "partial";
}

/** Derive day status from all slots on that date */
export function getDayStatus(slotsForDate) {
  const enabled = (slotsForDate || []).filter((s) => s.is_enabled !== false);
  if (!enabled.length) return "closed";
  const totalCap = enabled.reduce((sum, s) => sum + s.capacity, 0);
  const booked = enabled.reduce((sum, s) => sum + s.booked_count, 0);
  if (booked >= totalCap) return "full";
  if (booked > 0) return "partial";
  return "available";
}

export function isDaySelectable(slotsForDate) {
  const status = getDayStatus(slotsForDate);
  return status === "available" || status === "partial";
}

export function groupAvailabilityByDate(rows) {
  const map = {};
  for (const row of rows || []) {
    if (!map[row.avail_date]) map[row.avail_date] = [];
    map[row.avail_date].push(row);
  }
  return map;
}
