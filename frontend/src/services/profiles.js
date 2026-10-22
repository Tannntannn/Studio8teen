import { supabase } from "../lib/supabase";
import { STUDIO_EMAIL, STUDIO_PHONE, STUDIO_PHONE_DISPLAY } from "../lib/constants";

export async function getProfile(userId) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (error) throw error;
  return data;
}

export async function updateProfile(userId, updates) {
  const {
    role: _role,
    id: _id,
    ...safe
  } = updates || {};
  // email is allowed for walk-in guests filling contact info (DB trigger still blocks role changes)
  const { data, error } = await supabase.from("profiles").update(safe).eq("id", userId).select().single();
  if (error) throw error;
  return data;
}

export async function manageClientAccount(userId, action) {
  const { data, error } = await supabase.functions.invoke("manage-client-account", {
    body: { user_id: userId, action },
  });
  if (error) {
    let message = error.message;
    try {
      const body = await error.context?.json?.();
      if (body?.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message || "Could not update the account.");
  }
  if (data?.error) throw new Error(data.error);
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

export async function getFaqEntries() {
  const { data, error } = await supabase.from("faq_entries").select("*");
  if (error) throw error;
  return data || [];
}

const FAQ_STOP = new Set([
  "how", "do", "does", "did", "i", "a", "an", "the", "my", "to", "is", "are", "what", "can", "you",
  "your", "of", "for", "and", "or", "it", "me", "we", "our", "about", "please", "there", "this",
]);

const FAQ_SYNONYMS = {
  book: ["booking", "book", "reserve", "appointment", "walk-in", "walkin"],
  pay: ["payment", "pay", "gcash", "paymongo", "maya", "downpayment", "deposit", "cash"],
  cancel: ["cancel", "cancellation", "refund", "reschedule"],
  photo: ["photo", "photos", "gallery", "portfolio", "pictures", "softcopy", "enhanced"],
  hour: ["hours", "open", "operating", "sunday", "monday"],
  late: ["late", "arrival", "arrive", "tardy"],
  companion: ["companion", "companions", "guest", "guests", "friend"],
  damage: ["damage", "damaged", "penalty", "penalties", "equipment", "backdrop"],
  belong: ["belongings", "lost", "valuables", "personal"],
};

function faqTokens(query) {
  const q = query.toLowerCase().trim();
  const words = q
    .split(/[^a-z0-9₱]+/i)
    .map((w) => w.trim())
    .filter((w) => w.length > 2 && !FAQ_STOP.has(w));
  const expanded = new Set(words);
  for (const word of words) {
    for (const [key, list] of Object.entries(FAQ_SYNONYMS)) {
      if (list.some((s) => s === word || word.includes(s) || s.includes(word))) {
        expanded.add(key);
        list.forEach((s) => expanded.add(s));
      }
    }
  }
  return { q, expanded };
}

export async function searchFaq(query) {
  const entries = await getFaqEntries();
  const { q, expanded } = faqTokens(query);
  const ranked = [];

  for (const entry of entries) {
    const question = (entry.question || "").toLowerCase();
    const answer = (entry.answer || "").toLowerCase();
    const keywords = (entry.keywords || []).map((k) => String(k).toLowerCase());
    let score = 0;

    if (question === q) score += 30;
    if (q && (question.includes(q) || keywords.some((k) => k === q || q.includes(k)))) score += 14;

    for (const word of expanded) {
      if (keywords.some((k) => k === word)) score += 8;
      else if (keywords.some((k) => k.includes(word) || word.includes(k))) score += 4;
      if (question.includes(word)) score += 3;
      if (answer.includes(word)) score += 1;
    }

    ranked.push({ entry, score });
  }

  ranked.sort((a, b) => b.score - a.score);
  const best = ranked[0];
  const suggestions = ranked
    .filter((row) => row.score > 0 && row.entry?.question)
    .slice(0, 3)
    .map((row) => row.entry.question);

  const contactFallback = `I'm not sure about that. Try one of the suggestions, or contact Studio 8Teen.\n\nPhone: ${STUDIO_PHONE_DISPLAY}\nEmail: ${STUDIO_EMAIL}\nFacebook: facebook.com/profile.php?id=61556578913301`;

  if (!best || best.score < 8) {
    return { answer: contactFallback, matched: false, suggestions };
  }

  return {
    answer: best.entry.answer,
    matched: true,
    question: best.entry.question,
    suggestions: suggestions.filter((s) => s !== best.entry.question).slice(0, 2),
  };
}
