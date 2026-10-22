import { supabase } from "../lib/supabase";

export async function getRefundForBooking(bookingId) {
  const { data, error } = await supabase
    .from("refund_requests")
    .select("*")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createRefundRequest({ bookingId, clientId, amount, reason }) {
  const { data, error } = await supabase
    .from("refund_requests")
    .insert({
      booking_id: bookingId,
      client_id: clientId,
      amount,
      reason,
      status: "pending",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getRefundRequests() {
  const { data, error } = await supabase
    .from("refund_requests")
    .select("*, bookings(event_date, client_id, packages(name))")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = data || [];
  const clientIds = [...new Set(rows.map((row) => row.bookings?.client_id).filter(Boolean))];
  if (!clientIds.length) return rows;
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", clientIds);
  if (profileError) return rows;
  const byId = Object.fromEntries((profiles || []).map((profile) => [profile.id, profile]));
  return rows.map((row) => ({
    ...row,
    bookings: row.bookings
      ? { ...row.bookings, profiles: byId[row.bookings.client_id] || null }
      : row.bookings,
  }));
}

export async function reviewRefundRequest(id, { status, adminNote, reviewedBy }) {
  const { data, error } = await supabase
    .from("refund_requests")
    .update({
      status,
      admin_note: adminNote || "",
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewedBy,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
