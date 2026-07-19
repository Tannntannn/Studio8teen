import { supabase } from "../lib/supabase";

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

export async function verifyPayment(paymentId, bookingId, _adminId) {
  const { data, error } = await supabase.rpc("admin_verify_payment", {
    p_payment_id: paymentId,
    p_booking_id: bookingId,
  });
  if (error) throw error;
  return data;
}

export async function rejectPayment(paymentId, note, _clientId = null) {
  const { data: payment, error: fetchError } = await supabase
    .from("payments")
    .select("id, booking_id, status")
    .eq("id", paymentId)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!payment) throw new Error("Payment not found");
  if (payment.status !== "submitted") throw new Error("Only submitted payments can be rejected.");

  const { data, error } = await supabase
    .from("payments")
    .update({ status: "rejected", rejection_note: note })
    .eq("id", paymentId)
    .select()
    .single();
  if (error) throw error;

  // In-app notice comes from DB trigger — avoid duplicates
  return data;
}

export async function getRevenueStats() {
  const { data, error } = await supabase.rpc("get_revenue_stats");
  if (error) throw error;
  return data;
}
