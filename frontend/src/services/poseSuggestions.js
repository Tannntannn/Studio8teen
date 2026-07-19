import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

/** Generate via authenticated edge function only (API key stays server-side). */
export async function generatePoseSuggestions(context) {
  const { data, error } = await supabase.functions.invoke("generate-pose-suggestions", {
    body: context,
  });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      try {
        const body = await error.context.json();
        throw new Error(body?.error || "AI request failed");
      } catch (e) {
        if (e?.message && !String(e.message).includes("Unexpected")) throw e;
      }
    }
    throw new Error(error.message || "AI is not configured. Deploy generate-pose-suggestions with OPENROUTER_API_KEY.");
  }
  if (data?.error) throw new Error(data.error);
  if (data?.poses?.length) return data;
  throw new Error("AI returned no pose suggestions.");
}

export async function getPoseSuggestionsForBooking(bookingId) {
  const { data, error } = await supabase
    .from("booking_pose_suggestions")
    .select("*")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function savePoseSuggestions(bookingId, payload, userId) {
  const existing = await getPoseSuggestionsForBooking(bookingId);
  const row = {
    booking_id: bookingId,
    poses: payload.poses,
    mood_board: payload.mood_board,
    model_used: payload.model_used || "",
    created_by: userId || null,
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    const { data, error } = await supabase
      .from("booking_pose_suggestions")
      .update(row)
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from("booking_pose_suggestions")
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updatePoseSuggestionMeta(id, updates) {
  const next = { ...updates, updated_at: new Date().toISOString() };
  if (Array.isArray(next.pinned_indexes)) {
    next.pinned_indexes = [...new Set(next.pinned_indexes.map((i) => Number(i)).filter((n) => !Number.isNaN(n)))];
  }
  const { data, error } = await supabase
    .from("booking_pose_suggestions")
    .update(next)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
