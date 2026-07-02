import { supabase } from "../lib/supabase";

export async function getProfile(userId) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (error) throw error;
  return data;
}

export async function updateProfile(userId, updates) {
  const { data, error } = await supabase.from("profiles").update(updates).eq("id", userId).select().single();
  if (error) throw error;
  return data;
}

export async function getAllClients() {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "client")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getCancellations() {
  const { data, error } = await supabase
    .from("cancellations")
    .select("*, bookings(id, event_date, status, packages(name), profiles:client_id(full_name, email))")
    .order("cancelled_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function updateCancellation(id, updates) {
  const { data, error } = await supabase.from("cancellations").update(updates).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function verifyCancellationFee(id, approved, notes = "") {
  const updates = {
    fee_status: approved ? "verified" : "rejected",
    fee_admin_notes: notes,
    fee_verified_at: new Date().toISOString(),
    refund_status: "na",
  };
  const cancellation = await updateCancellation(id, updates);
  if (cancellation.booking_id) {
    if (approved) {
      await supabase.from("bookings").update({ status: "cancelled" }).eq("id", cancellation.booking_id);
    } else {
      await supabase.from("bookings").update({ status: "cancellation_pending" }).eq("id", cancellation.booking_id);
    }
  }
  return cancellation;
}

export async function getFaqEntries() {
  const { data, error } = await supabase.from("faq_entries").select("*");
  if (error) throw error;
  return data || [];
}

export async function searchFaq(query) {
  const entries = await getFaqEntries();
  const q = query.toLowerCase();
  const words = q.split(/\s+/).filter(Boolean);

  let best = null;
  let bestScore = 0;

  for (const entry of entries) {
    let score = 0;
    for (const word of words) {
      if (entry.question.toLowerCase().includes(word)) score += 2;
      if (entry.answer.toLowerCase().includes(word)) score += 1;
      if (entry.keywords?.some((k) => k.includes(word) || word.includes(k))) score += 3;
    }
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }

  if (bestScore === 0) {
    return {
      answer: "I'm not sure about that. Please contact us through the Contact section or call Studio 8Teen directly for assistance.",
      matched: false,
    };
  }

  return { answer: best.answer, matched: true, question: best.question };
}
