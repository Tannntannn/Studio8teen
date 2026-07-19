import { supabase } from "../lib/supabase";
import { createNotification } from "./notifications";

const CONFIRMED_STATUSES = ["confirmed"];

function formatWhen(date, time) {
  return [date, time].filter(Boolean).join(" at ") || "your scheduled date";
}

function actionPhrase(action) {
  if (action === "cancelled") return "cancelled";
  if (action === "rescheduled") return "rescheduled";
  return "affected by a schedule change";
}

export function normalizeAffectedBooking(row, action = "affected") {
  return {
    id: row.id,
    clientId: row.client_id || row.clientId,
    clientEmail: row.profiles?.email || row.clientEmail || row.client_email || "",
    clientName: row.profiles?.full_name || row.clientName || row.client_name || "there",
    packageName: row.packages?.name || row.packageName || "photography",
    date: row.event_date || row.date,
    time: row.time_slot || row.time,
    action: action || row.action || "affected",
  };
}

/** Confirmed bookings on a date (optionally one time slot). */
export async function getConfirmedBookingsForDate(date, timeSlot = null) {
  let query = supabase
    .from("bookings")
    .select("id, client_id, event_date, time_slot, status, packages(name)")
    .eq("event_date", date)
    .in("status", CONFIRMED_STATUSES);

  if (timeSlot) query = query.eq("time_slot", timeSlot);

  const { data, error } = await query;
  if (error) throw error;

  const rows = data || [];
  if (!rows.length) return [];

  const clientIds = [...new Set(rows.map((r) => r.client_id).filter(Boolean))];
  let profilesById = {};
  if (clientIds.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", clientIds);
    profilesById = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
  }

  return rows.map((r) =>
    normalizeAffectedBooking({ ...r, profiles: profilesById[r.client_id] || null }, "affected")
  );
}

async function createLocalInApp(booking, reason, action) {
  const when = formatWhen(booking.date, booking.time);
  const phrase = actionPhrase(action || booking.action);
  const title = "Your booking has been affected";
  const message =
    `Your ${booking.packageName || "photography"} session on ${when} has been ${phrase}. ` +
    `Please check your bookings for updates. Reason: ${reason}`;

  const { error } = await supabase.from("notifications").insert({
    user_id: booking.clientId,
    type: "booking",
    title,
    message,
    link: `/client-bookings/${booking.id}`,
    booking_id: booking.id,
    is_read: false,
  });

  if (error) {
    await createNotification(booking.clientId, "booking", `${title}: ${message}`);
  }
}

/**
 * Notify affected clients via in-app + email (Resend) + push (OneSignal).
 * Uses edge function for email/push (and optionally in-app). Never throws.
 *
 * @param {object[]} affectedBookings
 * @param {string} reason
 * @param {{ action?: string, createInApp?: boolean }} [options]
 *   createInApp defaults true. Set false when a DB status trigger already inserts a notification.
 */
export async function notifyAffectedClients(affectedBookings, reason, options = {}) {
  const { action, createInApp = true } = options;
  const list = (affectedBookings || [])
    .map((b) => (b.clientId ? { ...b, action: action || b.action || "affected" } : normalizeAffectedBooking(b, action || "affected")))
    .filter((b) => b?.clientId && b?.id);

  if (!list.length) return { notified: 0 };

  try {
    const { data, error } = await supabase.functions.invoke("notify-schedule-change", {
      body: {
        reason,
        skipInApp: !createInApp,
        appUrl: typeof window !== "undefined" ? window.location.origin : undefined,
        bookings: list,
      },
    });
    if (error) throw error;
    console.info("notify-schedule-change result:", data);
    return { notified: list.length, result: data };
  } catch (err) {
    console.warn("notify-schedule-change failed, falling back to in-app:", err?.message || err);
    if (createInApp) {
      await Promise.allSettled(list.map((b) => createLocalInApp(b, reason, action)));
    }
    return { notified: list.length, fallback: true };
  }
}

/** Close date/slot and notify confirmed clients. Returns affected count. */
export async function notifyForClosedAvailability(date, timeSlot = null, reason = null) {
  const bookings = await getConfirmedBookingsForDate(date, timeSlot);
  if (!bookings.length) return { notified: 0, bookings: [] };

  const msg =
    reason ||
    (timeSlot
      ? `${date} at ${timeSlot} was marked unavailable. Your booking is still active — please contact the studio or check for a reschedule.`
      : `${date} was marked unavailable. Your booking is still active — please contact the studio or check for a reschedule.`);

  // Fire and forget — don't block admin UI on email/push
  void notifyAffectedClients(bookings, msg, { action: "affected", createInApp: true });
  return { notified: bookings.length, bookings };
}
