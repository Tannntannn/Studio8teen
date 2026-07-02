import { supabase } from "../lib/supabase";
import { subscribeTableChanges } from "../lib/realtime";
import { CANCELLATION_FEE } from "../lib/constants";

async function attachProfiles(bookings) {
  if (!bookings?.length) return bookings || [];

  const clientIds = [...new Set(bookings.map((b) => b.client_id).filter(Boolean))];
  if (!clientIds.length) return bookings;

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", clientIds);

  if (error) {
    console.warn("Could not load client profiles:", error.message);
    return bookings;
  }

  const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
  return bookings.map((b) => ({ ...b, profiles: profileMap[b.client_id] || null }));
}

export async function getMyBookings() {
  const { data, error } = await supabase
    .from("bookings")
    .select("*, packages(name, price), payments(*)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getAllBookings() {
  const { data, error } = await supabase
    .from("bookings")
    .select("*, packages(name, price), payments(*)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return attachProfiles(data);
}

export async function getBooking(id) {
  const { data, error } = await supabase
    .from("bookings")
    .select("*, packages(name, price, features), payments(*), event_checklists(*), mood_boards(*), cancellations(*)")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Booking not found");

  const [withProfile] = await attachProfiles([data]);
  return withProfile;
}

export async function createBooking(booking) {
  const { data, error } = await supabase
    .from("bookings")
    .insert({ ...booking, status: "awaiting_payment" })
    .select()
    .single();
  if (error) throw error;

  const { error: checklistError } = await supabase.from("event_checklists").insert({
    booking_id: data.id,
    tasks: [
      { label: "Confirm outfit choices", checked: false, checked_at: null },
      { label: "Review pose suggestions", checked: false, checked_at: null },
      { label: "Prepare props or accessories", checked: false, checked_at: null },
      { label: "Get adequate rest the night before", checked: false, checked_at: null },
      { label: "Arrive 15 minutes early", checked: false, checked_at: null },
      { label: "Upload payment proof", checked: false, checked_at: null },
    ],
  });

  if (checklistError) {
    console.warn("Checklist not created:", checklistError.message);
  }

  return data;
}

export async function updateBooking(id, updates) {
  const { data, error } = await supabase.from("bookings").update(updates).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function requestCancellation(id, reason, feeAmount = CANCELLATION_FEE) {
  const { error: bookingError } = await supabase
    .from("bookings")
    .update({ status: "cancellation_pending" })
    .eq("id", id);
  if (bookingError) throw bookingError;

  const { error } = await supabase.from("cancellations").insert({
    booking_id: id,
    reason,
    fee_amount: feeAmount,
    fee_status: "awaiting",
    refund_status: "na",
  });
  if (error) throw error;
}

/** @deprecated Use requestCancellation */
export async function cancelBooking(id, reason, feeAmount = CANCELLATION_FEE) {
  return requestCancellation(id, reason, feeAmount);
}

export async function submitCancellationFeeProof(bookingId, cancellationId, proofUrl, publicId) {
  const { error: cancelError } = await supabase
    .from("cancellations")
    .update({
      fee_proof_url: proofUrl,
      fee_proof_public_id: publicId,
      fee_status: "submitted",
    })
    .eq("id", cancellationId);
  if (cancelError) throw cancelError;

  const { error: bookingError } = await supabase
    .from("bookings")
    .update({ status: "cancellation_submitted" })
    .eq("id", bookingId);
  if (bookingError) throw bookingError;
}

export async function deleteBooking(id) {
  const { data: booking, error: fetchError } = await supabase
    .from("bookings")
    .select("event_date, time_slot")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!booking) throw new Error("Booking not found");

  const { error } = await supabase.from("bookings").delete().eq("id", id);
  if (error) throw error;

  if (booking.event_date && booking.time_slot) {
    const { data: slot } = await supabase
      .from("studio_availability")
      .select("id, booked_count")
      .eq("avail_date", booking.event_date)
      .eq("time_slot", booking.time_slot)
      .maybeSingle();

    if (slot && slot.booked_count > 0) {
      await supabase
        .from("studio_availability")
        .update({ booked_count: slot.booked_count - 1 })
        .eq("id", slot.id);
    }
  }
}

export async function getBookingByQrToken(token) {
  const { data, error } = await supabase
    .from("bookings")
    .select("*, packages(name, price)")
    .eq("qr_token", token)
    .in("status", ["confirmed", "completed"])
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Invalid or inactive verification code");

  const [withProfile] = await attachProfiles([data]);
  return withProfile;
}

export async function getBookingStats() {
  const { data, error } = await supabase.rpc("get_booking_stats");
  if (error) throw error;
  return data;
}

export async function getPendingVerifications() {
  const { data, error } = await supabase
    .from("bookings")
    .select("*, packages(name, price), payments(*), event_checklists(*)")
    .eq("status", "payment_submitted")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return attachProfiles(data);
}

export async function getActiveBookingsWithChecklists() {
  const { data, error } = await supabase
    .from("bookings")
    .select("*, packages(name), event_checklists(*)")
    .in("status", ["awaiting_payment", "payment_submitted", "confirmed"])
    .order("created_at", { ascending: false })
    .limit(15);
  if (error) throw error;
  return attachProfiles(data);
}

export async function getUnreadPendingCount() {
  const { count, error } = await supabase
    .from("bookings")
    .select("*", { count: "exact", head: true })
    .eq("status", "payment_submitted")
    .is("admin_read_at", null);
  if (error) {
    console.warn("Unread count unavailable:", error.message);
    return 0;
  }
  return count || 0;
}

export async function markBookingAsRead(id) {
  const { error } = await supabase
    .from("bookings")
    .update({ admin_read_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function markAllPendingAsRead() {
  const { error } = await supabase
    .from("bookings")
    .update({ admin_read_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("status", "payment_submitted")
    .is("admin_read_at", null);
  if (error) throw error;
}

export function subscribePendingBookings(onChange) {
  return subscribeTableChanges("bookings", onChange);
}
