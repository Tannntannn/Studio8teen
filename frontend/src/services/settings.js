import { supabase } from "../lib/supabase";
import { subscribeTableChanges } from "../lib/realtime";
import { DEFAULT_TIME_SLOTS } from "../lib/constants";
import { notifyForClosedAvailability } from "./scheduleNotifications";

export const TIME_SLOTS = DEFAULT_TIME_SLOTS;

let cachedTimeSlots = null;

export function clearTimeSlotsCache() {
  cachedTimeSlots = null;
}

export async function getTimeSlots() {
  if (cachedTimeSlots?.length) return cachedTimeSlots;
  try {
    const settings = await getStudioSettings();
    const slots = settings?.time_slots;
    if (Array.isArray(slots) && slots.length) {
      cachedTimeSlots = slots.map(String);
      return cachedTimeSlots;
    }
  } catch {
    /* use defaults */
  }
  cachedTimeSlots = [...DEFAULT_TIME_SLOTS];
  return cachedTimeSlots;
}

export async function getStudioSettings() {
  const { data, error } = await supabase.from("studio_settings").select("*").eq("id", 1).single();
  if (error) throw error;
  return data;
}

export async function updateStudioSettings(updates) {
  const { data, error } = await supabase.from("studio_settings").update(updates).eq("id", 1).select().single();
  if (error) throw error;
  if (updates.time_slots) clearTimeSlotsCache();
  return data;
}

export async function getAvailability(startDate, endDate) {
  let query = supabase.from("studio_availability").select("*").order("avail_date").order("time_slot");
  if (startDate) query = query.gte("avail_date", startDate);
  if (endDate) query = query.lte("avail_date", endDate);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function syncMonthAvailability(yearMonth) {
  const { error } = await supabase.rpc("sync_month_availability", { p_year_month: yearMonth });
  if (error) console.warn("sync_month_availability:", error.message);
}

export async function ensureMonthAvailability(yearMonth, slots) {
  const timeSlots = slots || (await getTimeSlots());
  const { error: rpcError } = await supabase.rpc("ensure_month_availability", { p_year_month: yearMonth });
  if (!rpcError) {
    return getAvailability(`${yearMonth}-01`, monthEnd(yearMonth));
  }

  const [y, m] = yearMonth.split("-").map(Number);
  const days = new Date(y, m, 0).getDate();
  const end = `${yearMonth}-${String(days).padStart(2, "0")}`;
  const existing = await getAvailability(`${yearMonth}-01`, end);
  const existingKeys = new Set(existing.map((r) => `${r.avail_date}|${r.time_slot}`));

  const missing = [];
  for (let d = 1; d <= days; d++) {
    const date = `${yearMonth}-${String(d).padStart(2, "0")}`;
    for (const slot of timeSlots) {
      if (!existingKeys.has(`${date}|${slot}`)) {
        missing.push({
          avail_date: date,
          time_slot: slot,
          capacity: 2,
          booked_count: 0,
          is_enabled: true,
        });
      }
    }
  }

  if (missing.length) {
    const { error } = await supabase.from("studio_availability").upsert(missing, { onConflict: "avail_date,time_slot" });
    if (error) throw error;
  }

  await syncMonthAvailability(yearMonth);
  return getAvailability(`${yearMonth}-01`, end);
}

function monthEnd(yearMonth) {
  const [y, m] = yearMonth.split("-").map(Number);
  const days = new Date(y, m, 0).getDate();
  return `${yearMonth}-${String(days).padStart(2, "0")}`;
}

export async function upsertAvailability(rows) {
  const { error } = await supabase.from("studio_availability").upsert(rows, { onConflict: "avail_date,time_slot" });
  if (error) throw error;
}

export async function syncAvailabilitySlot(date, timeSlot) {
  const { error } = await supabase.rpc("sync_availability_slot", {
    p_date: date,
    p_time_slot: timeSlot,
  });
  if (error) console.warn("sync_availability_slot:", error.message);
}

/** @deprecated Trigger syncs automatically; kept for compatibility */
export async function incrementBookedCount(date, timeSlot) {
  await syncAvailabilitySlot(date, timeSlot);
}

export async function updateAvailabilitySlot(date, timeSlot, { is_enabled, capacity }) {
  await syncAvailabilitySlot(date, timeSlot);

  const { data: existing } = await supabase
    .from("studio_availability")
    .select("*")
    .eq("avail_date", date)
    .eq("time_slot", timeSlot)
    .maybeSingle();

  const wasEnabled = existing?.is_enabled !== false;
  const nextEnabled = is_enabled ?? existing?.is_enabled ?? true;

  const row = {
    avail_date: date,
    time_slot: timeSlot,
    is_enabled: nextEnabled,
    capacity: capacity ?? existing?.capacity ?? 2,
    booked_count: existing?.booked_count ?? 0,
  };

  const { error } = await supabase.from("studio_availability").upsert(row, { onConflict: "avail_date,time_slot" });
  if (error) throw error;

  let notified = 0;
  if (wasEnabled && nextEnabled === false) {
    const result = await notifyForClosedAvailability(date, timeSlot);
    notified = result.notified;
  }
  return { notified };
}

export async function toggleAvailabilitySlot(date, timeSlot, isEnabled) {
  return updateAvailabilitySlot(date, timeSlot, { is_enabled: isEnabled });
}

export async function setDayAvailability(date, isEnabled, slots) {
  const timeSlots = slots || (await getTimeSlots());
  const existing = await getAvailability(date, date);
  const bySlot = Object.fromEntries(existing.map((r) => [r.time_slot, r]));

  const rows = timeSlots.map((slot) => ({
    avail_date: date,
    time_slot: slot,
    is_enabled: isEnabled,
    capacity: bySlot[slot]?.capacity ?? 2,
    booked_count: bySlot[slot]?.booked_count ?? 0,
  }));

  const { error } = await supabase.from("studio_availability").upsert(rows, { onConflict: "avail_date,time_slot" });
  if (error) throw error;

  let notified = 0;
  if (!isEnabled) {
    const result = await notifyForClosedAvailability(date, null);
    notified = result.notified;
  }
  return { notified };
}

export async function isSlotBookable(date, timeSlot) {
  await syncAvailabilitySlot(date, timeSlot);
  const rows = await getAvailability(date, date);
  const slot = rows.find((r) => r.time_slot === timeSlot);
  if (!slot) return false;
  return slot.is_enabled !== false && slot.booked_count < slot.capacity;
}

export function subscribeAvailability(onChange) {
  return subscribeTableChanges("studio_availability", onChange);
}

export function subscribeBookings(onChange) {
  return subscribeTableChanges("bookings", onChange);
}
