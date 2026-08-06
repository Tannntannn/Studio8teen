export const CANCELLATION_FEE = 100;
export const STUDIO_PHONE = "09062087291";
export const STUDIO_PHONE_DISPLAY = "0906 208 7291";
export const STUDIO_EMAIL = "studiobook12@gmail.com";

/** One booking per 30-minute slot */
export const DEFAULT_SLOT_CAPACITY = 1;

/** Build HH:MM slots every 30 minutes, inclusive of start and end. */
export function buildHalfHourSlots(startHour = 9, startMinute = 0, endHour = 18, endMinute = 0) {
  const out = [];
  let h = startHour;
  let m = startMinute;
  while (h < endHour || (h === endHour && m <= endMinute)) {
    out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    m += 30;
    if (m >= 60) {
      m = 0;
      h += 1;
    }
  }
  return out;
}

/** Default grid: 9:00 AM – 6:00 PM, every 30 minutes */
export const DEFAULT_TIME_SLOTS = buildHalfHourSlots(9, 0, 18, 0);
