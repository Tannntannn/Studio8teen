import { supabase } from "../lib/supabase";
import { STUDIO_EMAIL, STUDIO_PHONE, STUDIO_PHONE_DISPLAY } from "../lib/constants";

export async function getProfile(userId) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (error) throw error;
  return data;
}

export async function updateProfile(userId, updates) {
  const { role: _role, id: _id, ...safe } = updates || {};
  const { data, error } = await supabase.from("profiles").update(safe).eq("id", userId).select().single();
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
  const q = query.toLowerCase().trim();
  const words = q.split(/\s+/).filter((w) => w.length > 1);

  const synonyms = {
    book: ["booking", "book", "schedule", "reserve", "appointment", "walk-in", "walk in", "online"],
    pay: ["payment", "pay", "gcash", "downpayment", "deposit", "proof"],
    cancel: ["cancel", "cancellation", "refund", "reschedule"],
    photo: ["photo", "photos", "gallery", "portfolio", "pictures", "images", "soft copies", "soft copy", "enhanced"],
    hour: ["hour", "hours", "open", "time", "schedule", "operating"],
    price: ["price", "cost", "package", "rate", "fee"],
    mood: ["mood", "theme", "board", "inspiration"],
    pose: ["pose", "poses", "posing"],
    deliver: ["delivery", "deliver", "turnaround", "ready", "receive", "upload"],
    late: ["late", "arrival", "arrive", "minutes", "tardy"],
    companion: ["companion", "companions", "guest", "guests", "extra", "friend"],
    damage: ["damage", "damaged", "penalty", "penalties", "equipment", "backdrop", "break"],
    belong: ["belongings", "lost", "valuables", "personal", "items"],
  };

  const expandedWords = new Set(words);
  for (const word of words) {
    for (const [key, list] of Object.entries(synonyms)) {
      if (list.some((s) => word.includes(s) || s.includes(word))) {
        expandedWords.add(key);
        list.forEach((s) => expandedWords.add(s));
      }
    }
  }

  let best = null;
  let bestScore = 0;

  for (const entry of entries) {
    const question = entry.question.toLowerCase();
    const answer = entry.answer.toLowerCase();
    const keywords = (entry.keywords || []).map((k) => k.toLowerCase());
    const blob = `${question} ${answer} ${keywords.join(" ")}`;
    let score = 0;

    if (question === q) score += 20;
    if (blob.includes(q)) score += 12;
    if (question.includes(q) || q.includes(question.slice(0, Math.min(question.length, 24)))) score += 8;

    for (const word of expandedWords) {
      if (question.includes(word)) score += 4;
      if (answer.includes(word)) score += 2;
      if (keywords.some((k) => k === word || k.includes(word) || word.includes(k))) score += 6;
    }

    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }

  const contactFallback = `I'm not sure about that. Please contact Studio 8Teen about your question.\n\nPhone: ${STUDIO_PHONE_DISPLAY} (${STUDIO_PHONE})\nEmail: ${STUDIO_EMAIL}\nFacebook: facebook.com/profile.php?id=61556578913301`;

  if (!best || bestScore < 5) {
    return { answer: contactFallback, matched: false };
  }

  return { answer: best.answer, matched: true, question: best.question };
}
