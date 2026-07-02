import { supabase } from "../lib/supabase";
import { createNotification } from "./notifications";

export async function createPayment(payment) {
  const { data, error } = await supabase.from("payments").insert(payment).select().single();
  if (error) throw error;
  return data;
}

export async function updatePayment(id, updates) {
  const { data, error } = await supabase.from("payments").update(updates).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function verifyPayment(paymentId, bookingId, adminId) {
  const qrToken = crypto.randomUUID().slice(0, 8);

  const { error: paymentError } = await supabase
    .from("payments")
    .update({ status: "verified", verified_by: adminId, verified_at: new Date().toISOString() })
    .eq("id", paymentId);
  if (paymentError) throw paymentError;

  const { error: bookingError } = await supabase
    .from("bookings")
    .update({ status: "confirmed", qr_token: qrToken })
    .eq("id", bookingId);
  if (bookingError) throw bookingError;

  return qrToken;
}

export async function rejectPayment(paymentId, note, clientId = null) {
  const { data, error } = await supabase
    .from("payments")
    .update({ status: "rejected", rejection_note: note })
    .eq("id", paymentId)
    .select()
    .single();
  if (error) throw error;

  if (clientId) {
    try {
      await createNotification(
        clientId,
        "payment",
        `Payment proof rejected. Reason: ${note || "Please re-upload your payment proof."}`
      );
    } catch {
      // DB trigger may have already created the notification
    }
  }

  return data;
}

export async function getRevenueStats() {
  const { data, error } = await supabase.rpc("get_revenue_stats");
  if (error) throw error;
  return data;
}
