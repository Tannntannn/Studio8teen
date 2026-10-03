/** Shared calendar / slot colors: open, partial (some booked), full, closed, past */
export const AVAILABILITY_COLORS = {
  available: "bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100",
  partial: "bg-amber-200 border-amber-400 text-amber-900 hover:bg-amber-300",
  full: "bg-red-200 border-red-500 text-red-900 cursor-not-allowed",
  closed: "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed opacity-60",
  past: "bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed",
  selected: "ring-2 ring-[#A98B75] ring-offset-1 bg-[#A98B75]/15 border-[#A98B75] text-[#5B4636]",
};

export function availabilityHeatClass(ratio) {
  if (ratio <= 0) return "bg-emerald-50 text-emerald-800 border-emerald-200";
  if (ratio >= 1) return "bg-red-200 text-red-900 border-red-400";
  return "bg-amber-200 text-amber-900 border-amber-400";
}

export function availabilityHeatLabel(ratio) {
  if (ratio <= 0) return "Open";
  if (ratio >= 1) return "Full";
  return "Partial";
}

/** Client-matching chip styles for admin schedule */
export function scheduleChipClass(status, { past = false, updating = false } = {}) {
  const styles = {
    available: "bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100",
    partial: "bg-amber-200 border-amber-400 text-amber-900 hover:bg-amber-300",
    full: "bg-red-200 border-red-500 text-red-900 cursor-default",
    closed: "bg-gray-100 border-gray-200 text-gray-400 hover:bg-gray-50",
  };
  const base = styles[status] || styles.closed;
  const pastCls = past ? "opacity-55 cursor-default" : "";
  const pop = updating ? "avail-cell-pop" : "";
  return `${base} border rounded-xl ${pastCls} ${pop}`.trim();
}

/** @deprecated use scheduleChipClass */
export function heatmapCellClass(status, opts) {
  return scheduleChipClass(status, opts);
}

function asCount(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Derive slot status from availability row */
export function getSlotStatus(slot) {
  if (!slot || slot.is_enabled === false) return "closed";
  const capacity = asCount(slot.capacity);
  const booked = asCount(slot.booked_count);
  if (capacity <= 0 || booked >= capacity) return "full";
  if (booked > 0) return "partial";
  return "available";
}

export function isSlotSelectable(slot) {
  const status = getSlotStatus(slot);
  return status === "available" || status === "partial";
}

/** Derive day status from all slots on that date */
export function getDayStatus(slotsForDate) {
  const enabled = (slotsForDate || []).filter((s) => s.is_enabled !== false);
  if (!enabled.length) return "closed";

  let bookable = 0;
  let bookedAny = 0;
  for (const slot of enabled) {
    const status = getSlotStatus(slot);
    if (status === "available" || status === "partial") bookable += 1;
    if (status === "partial" || status === "full") bookedAny += 1;
  }

  // Nothing left to book → fully booked (red), even if totals were messy
  if (bookable === 0) return "full";
  if (bookedAny > 0) return "partial";
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
