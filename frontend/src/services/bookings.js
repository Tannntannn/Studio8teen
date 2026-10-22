import { supabase } from "../lib/supabase";
import { subscribeTableChanges } from "../lib/realtime";
import { CANCELLATION_FEE } from "../lib/constants";
import { createNotification } from "./notifications";
import { syncAvailabilitySlot } from "./settings";
import { normalizeAffectedBooking, notifyAffectedClients } from "./scheduleNotifications";
async function getCurrentUserId() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error("You must be logged in.");
  return user.id;
}


async function attachProfiles(bookings) {
  if (!bookings?.length) return bookings || [];

  const withSnapshot = (booking, profile) => {
    if (profile) return { ...booking, profiles: profile };
    const snap = booking.guest_snapshot || {};
    if (!snap.full_name && !snap.email) return { ...booking, profiles: null };
    return {
      ...booking,
      profiles: {
        full_name: snap.full_name || "Deleted account",
        email: snap.email || "",
        phone: snap.phone || "",
        address: snap.address || "",
      },
    };
  };

  const clientIds = [...new Set(bookings.map((b) => b.client_id).filter(Boolean))];
  if (!clientIds.length) return bookings.map((b) => withSnapshot(b, null));

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, address, is_guest, claimed_at, deactivated_at")
    .in("id", clientIds);

  if (error) {
    console.warn("Could not load client profiles:", error.message);
    return bookings;
  }

  const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
  return bookings.map((b) => withSnapshot(b, b.client_id ? profileMap[b.client_id] || null : null));
}

async function expireUnapprovedBookings() {
  try {
    await supabase.rpc("cancel_expired_unapproved_bookings");
  } catch (err) {
    console.warn("Could not expire unapproved bookings:", err.message);
  }
}

export async function getMyBookings() {
  await expireUnapprovedBookings();
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from("bookings")
    .select("*, packages(name, price), payments(*)")
    .eq("client_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getAllBookings() {
  await expireUnapprovedBookings();
  const { data, error } = await supabase
    .from("bookings")
    .select("*, packages(name, price), payments(*)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return attachProfiles(data);
}

export async function getBooking(id) {
  await expireUnapprovedBookings();
  const { data, error } = await supabase
    .from("bookings")
    .select("*, packages(name, price, features), payments(*), mood_boards(*), cancellations(*)")
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

  return data;
}

export async function updateBooking(id, updates) {
  const { data, error } = await supabase.from("bookings").update(updates).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function requestCancellation(id, reason, feeAmount = CANCELLATION_FEE) {
  const { data: booking, error: fetchError } = await supabase
    .from("bookings")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!booking) throw new Error("Booking not found");
  if (booking.status !== "confirmed") {
    throw new Error("Only confirmed bookings require a cancellation fee request.");
  }

  const { error: insertError } = await supabase.from("cancellations").insert({
    booking_id: id,
    reason,
    fee_amount: feeAmount,
    fee_status: "awaiting",
    refund_status: "na",
  });
  if (insertError) throw insertError;

  const { error: bookingError } = await supabase
    .from("bookings")
    .update({ status: "cancellation_pending", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "confirmed");
  if (bookingError) throw bookingError;
}

async function releaseBookingSlot(eventDate, timeSlot) {
  if (!eventDate || !timeSlot) return;
  try {
    await syncAvailabilitySlot(eventDate, timeSlot);
  } catch {
    /* DB trigger may handle sync */
  }
}

/** Cancel before admin approval — no fee required. */
export async function cancelBookingFree(id, reason = "Cancelled by client before approval") {
  const { data: booking, error: fetchError } = await supabase
    .from("bookings")
    .select("event_date, time_slot, status")
    .eq("id", id)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!booking) throw new Error("Booking not found");

  const freeStatuses = ["awaiting_payment", "payment_submitted", "pending"];
  if (!freeStatuses.includes(booking.status)) {
    throw new Error("This booking requires the cancellation fee flow.");
  }

  const { error } = await supabase
    .from("bookings")
    .update({ status: "cancelled", notes: reason, updated_at: new Date().toISOString() })
    .eq("id", id)
    .in("status", freeStatuses);
  if (error) throw error;

  await releaseBookingSlot(booking.event_date, booking.time_slot);
}

/** Admin rejects a booking entirely. */
export async function rejectBooking(id, note = "Booking rejected by admin") {
  const { data: booking, error: fetchError } = await supabase
    .from("bookings")
    .select("id, client_id, event_date, time_slot, status, packages(name), payments(id, status)")
    .eq("id", id)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!booking) throw new Error("Booking not found");

  const [withProfile] = await attachProfiles([booking]);
  const wasConfirmed = booking.status === "confirmed";

  const payment = booking.payments?.[0];
  if (payment && ["submitted", "verified"].includes(payment.status)) {
    await supabase
      .from("payments")
      .update({
        status: payment.status === "verified" ? "rejected" : "rejected",
        rejection_note: note,
      })
      .eq("id", payment.id);
  }

  const { error } = await supabase
    .from("bookings")
    .update({ status: "cancelled", notes: note, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;

  await releaseBookingSlot(booking.event_date, booking.time_slot);

  // Status trigger already creates a basic in-app notification
  if (wasConfirmed) {
    void notifyAffectedClients(
      [normalizeAffectedBooking(withProfile, "cancelled")],
      note || "Your booking has been cancelled",
      { action: "cancelled", createInApp: false }
    );
    return { notified: 1 };
  }

  try {
    await createNotification(
      booking.client_id,
      "booking",
      `Your booking was rejected by the studio. Reason: ${note}`
    );
  } catch {
    // DB trigger may have already created the notification
  }
  return { notified: 0 };
}

/** Admin reschedules a confirmed (or active) booking to a new date/slot. */
export async function rescheduleBooking(id, { event_date, time_slot, note }) {
  if (!event_date || !time_slot) throw new Error("New date and time slot are required.");

  const { data: booking, error: fetchError } = await supabase
    .from("bookings")
    .select("id, client_id, event_date, time_slot, status, notes, packages(name)")
    .eq("id", id)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!booking) throw new Error("Booking not found");

  const oldDate = booking.event_date;
  const oldSlot = booking.time_slot;

  const { data: updated, error } = await supabase
    .from("bookings")
    .update({
      event_date,
      time_slot,
      notes: note ? `${booking.notes ? booking.notes + "\n" : ""}Reschedule: ${note}` : booking.notes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id, client_id, event_date, time_slot, status, packages(name)")
    .single();
  if (error) throw error;

  await releaseBookingSlot(oldDate, oldSlot);
  await syncAvailabilitySlot(event_date, time_slot);

  const [withProfile] = await attachProfiles([updated]);
  const reason = `Your booking has been rescheduled to ${event_date} at ${time_slot}${note ? `. ${note}` : ""}`;
  // Fire-and-forget so admin UI returns immediately
  void notifyAffectedClients(
    [normalizeAffectedBooking(withProfile, "rescheduled")],
    reason,
    { action: "rescheduled", createInApp: true }
  );

  return { booking: withProfile, notified: 1 };
}

export async function getClientBookings(clientId) {
  const { data, error } = await supabase
    .from("bookings")
    .select("*, packages(name, price), payments(*)")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function saveCancellationFeeProof(bookingId, cancellationId, proofUrl, publicId, options = {}) {
  const updates = {
    fee_proof_url: proofUrl,
    fee_proof_public_id: publicId,
  };
  if (!options.keepStatus) updates.fee_status = "awaiting";
  const { error } = await supabase.from("cancellations").update(updates).eq("id", cancellationId);
  if (error) throw error;
}

export async function confirmCancellationFeeProof(bookingId, cancellationId) {
  const { error: cancelError } = await supabase
    .from("cancellations")
    .update({ fee_status: "submitted" })
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
    await releaseBookingSlot(booking.event_date, booking.time_slot);
  }
}

export async function getBookingByQrToken(token) {
  const { data, error } = await supabase.rpc("verify_booking_qr", { p_token: token });
  if (error) throw error;
  if (!data) throw new Error("Invalid or inactive verification code");
  return data;
}

export async function getBookingStats() {
  const { data, error } = await supabase.rpc("get_booking_stats");
  if (error) throw error;
  return data;
}

export async function getPaidAwaitingConfirmation() {
  const { data, error } = await supabase
    .from("bookings")
    .select("*, packages(name, price), payments(*)")
    .eq("status", "pending")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  const paid = (data || []).filter((b) =>
    (b.payments || []).some((p) => p.status === "verified")
  );
  return attachProfiles(paid);
}

export async function confirmPaidBooking(id) {
  const adminId = await getCurrentUserId();
  const { data: booking, error: fetchError } = await supabase
    .from("bookings")
    .select("id, status, payments(status)")
    .eq("id", id)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!booking) throw new Error("Booking not found");
  if (booking.status !== "pending") {
    throw new Error("This booking is not waiting for confirmation.");
  }
  const paid = (booking.payments || []).some((p) => p.status === "verified");
  if (!paid) throw new Error("This booking is not paid yet.");

  const qrToken = crypto.randomUUID().replace(/-/g, "");
  const { data, error } = await supabase
    .from("bookings")
    .update({
      status: "confirmed",
      qr_token: qrToken,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "pending")
    .select()
    .single();
  if (error) throw error;

  const { error: logError } = await supabase.from("activity_logs").insert({
    admin_id: adminId,
    action_description: `Admin confirmed Booking #${String(id).slice(0, 8)}`,
  });
  if (logError) console.warn("Activity log failed:", logError.message);
  return data;
}

export async function disapprovePaidBooking(id, note = "Booking was not approved by the studio") {
  const adminId = await getCurrentUserId();
  const result = await rejectBooking(id, note);
  const { error: logError } = await supabase.from("activity_logs").insert({
    admin_id: adminId,
    action_description: `Admin disapproved Booking #${String(id).slice(0, 8)}`,
  });
  if (logError) console.warn("Activity log failed:", logError.message);
  return result;
}

export function subscribeActivityLogs(callback) {
  const channel = supabase
    .channel("activity-logs")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "activity_logs" },
      () => callback()
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

export async function getRecentActivityLogs() {
  const { data, error } = await supabase
    .from("activity_logs")
    .select("id, action_description, created_at, profiles:admin_id(full_name)")
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw error;
  return data || [];
}

export async function getPendingVerifications() {
  const { data, error } = await supabase
    .from("bookings")
    .select("*, packages(name, price), payments(*)")
    .eq("status", "payment_submitted")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return attachProfiles(data);
}

export async function getUnreadPendingCount() {
  const { count, error } = await supabase
    .from("bookings")
    .select("*", { count: "exact", head: true })
    .in("status", ["payment_submitted", "pending"])
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
