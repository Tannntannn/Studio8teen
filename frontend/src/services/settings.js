import { supabase } from "../lib/supabase";
import { subscribeTableChanges } from "../lib/realtime";

export const TIME_SLOTS = ["09:00", "11:00", "13:00", "15:00", "17:00"];

export async function getStudioSettings() {
  const { data, error } = await supabase.from("studio_settings").select("*").eq("id", 1).single();
  if (error) throw error;
  return data;
}

export async function updateStudioSettings(updates) {
  const { data, error } = await supabase.from("studio_settings").update(updates).eq("id", 1).select().single();
  if (error) throw error;
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

export async function ensureMonthAvailability(yearMonth, slots = TIME_SLOTS) {
  const [y, m] = yearMonth.split("-").map(Number);
  const days = new Date(y, m, 0).getDate();
  const end = `${yearMonth}-${String(days).padStart(2, "0")}`;
  const existing = await getAvailability(`${yearMonth}-01`, end);
  const existingKeys = new Set(existing.map((r) => `${r.avail_date}|${r.time_slot}`));

  const missing = [];
  for (let d = 1; d <= days; d++) {
    const date = `${yearMonth}-${String(d).padStart(2, "0")}`;
    for (const slot of slots) {
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

  return getAvailability(`${yearMonth}-01`, end);
}

export async function upsertAvailability(rows) {
  const { error } = await supabase.from("studio_availability").upsert(rows, { onConflict: "avail_date,time_slot" });
  if (error) throw error;
}

export async function toggleAvailabilitySlot(date, timeSlot, isEnabled) {
  const { data: existing } = await supabase
    .from("studio_availability")
    .select("*")
    .eq("avail_date", date)
    .eq("time_slot", timeSlot)
    .maybeSingle();

  const row = {
    avail_date: date,
    time_slot: timeSlot,
    is_enabled: isEnabled,
    capacity: existing?.capacity ?? 2,
    booked_count: existing?.booked_count ?? 0,
  };

  const { error } = await supabase.from("studio_availability").upsert(row, { onConflict: "avail_date,time_slot" });
  if (error) throw error;
}

export async function setDayAvailability(date, isEnabled, slots = TIME_SLOTS) {
  const existing = await getAvailability(date, date);
  const bySlot = Object.fromEntries(existing.map((r) => [r.time_slot, r]));

  const rows = slots.map((slot) => ({
    avail_date: date,
    time_slot: slot,
    is_enabled: isEnabled,
    capacity: bySlot[slot]?.capacity ?? 2,
    booked_count: bySlot[slot]?.booked_count ?? 0,
  }));

  const { error } = await supabase.from("studio_availability").upsert(rows, { onConflict: "avail_date,time_slot" });
  if (error) throw error;
}

export async function incrementBookedCount(date, timeSlot) {
  const { data: slot } = await supabase
    .from("studio_availability")
    .select("*")
    .eq("avail_date", date)
    .eq("time_slot", timeSlot)
    .single();

  if (slot) {
    await supabase
      .from("studio_availability")
      .update({ booked_count: slot.booked_count + 1 })
      .eq("id", slot.id);
  }
}

export function subscribeAvailability(onChange) {
  return subscribeTableChanges("studio_availability", onChange);
}
