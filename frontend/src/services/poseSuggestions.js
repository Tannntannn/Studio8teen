import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

const OPENROUTER_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;

const MODELS = [
  "anthropic/claude-3.5-sonnet",
  "openai/gpt-4o-mini",
  "google/gemini-2.0-flash-001",
];

function buildPrompt({ packageName, eventDate, location, notes, moodHint }) {
  return `You are a professional photography posing coach for Studio 8Teen.

Generate exactly 4 pose suggestions and one mood board for this session.

Package: ${packageName || "General portrait"}
Date: ${eventDate || "TBD"}
Location: ${location || "Studio"}
Client notes: ${notes || "None"}
Preferred mood/aesthetic: ${moodHint || "Elegant and natural"}

Return ONLY valid JSON (no markdown) with this shape:
{
  "poses": [
    {
      "title": "short name",
      "description": "what the subject does",
      "positioning": "camera angle / body orientation",
      "props": "props to use or Minimal",
      "mood": "emotional vibe",
      "lighting": "lighting guidance"
    }
  ],
  "mood_board": {
    "name": "mood board title",
    "color_palette": ["#hex", "#hex", "#hex", "#hex"],
    "lighting": "lighting summary",
    "setting": "setting / backdrop ideas",
    "props": "prop suggestions",
    "vibe": "overall vibe in a short phrase"
  }
}`;
}

function parseJsonContent(raw) {
  const trimmed = String(raw || "").trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return JSON.parse(fenced ? fenced[1].trim() : trimmed);
}

function normalizeResult(parsed, modelUsed) {
  const poses = Array.isArray(parsed?.poses) ? parsed.poses.slice(0, 5) : [];
  const mood = parsed?.mood_board || {};
  return {
    poses: poses.map((p) => ({
      title: String(p.title || "Pose").trim(),
      description: String(p.description || "").trim(),
      positioning: String(p.positioning || "").trim(),
      props: String(p.props || "Minimal").trim(),
      mood: String(p.mood || "").trim(),
      lighting: String(p.lighting || "").trim(),
    })),
    mood_board: {
      name: String(mood.name || "Session Mood Board").trim(),
      color_palette: Array.isArray(mood.color_palette)
        ? mood.color_palette.map((c) => String(c).toUpperCase()).filter((c) => /^#([0-9A-F]{3}|[0-9A-F]{6})$/.test(c)).slice(0, 6)
        : ["#A98B75", "#F8F6F3", "#5B4636", "#E8D5C4"],
      lighting: String(mood.lighting || "").trim(),
      setting: String(mood.setting || "").trim(),
      props: String(mood.props || "").trim(),
      vibe: String(mood.vibe || "").trim(),
    },
    model_used: modelUsed,
  };
}

async function callOpenRouter(prompt, model) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "https://studio8teen.org",
      "X-Title": "StudioBook Pose Suggestions",
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      messages: [
        { role: "system", content: "Return only valid JSON for photography pose planning." },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `OpenRouter ${res.status}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty model response");
  return normalizeResult(parseJsonContent(content), model);
}

/** Generate via edge function first, then client OpenRouter with model fallbacks. */
export async function generatePoseSuggestions(context) {
  try {
    const { data, error } = await supabase.functions.invoke("generate-pose-suggestions", {
      body: context,
    });
    if (error) throw error;
    if (data?.poses?.length) return data;
    if (data?.error) throw new Error(data.error);
  } catch (err) {
    if (err instanceof FunctionsHttpError) {
      // fall through to client
    }
  }

  if (!OPENROUTER_KEY) {
    throw new Error("AI is not configured. Set VITE_OPENROUTER_API_KEY or deploy generate-pose-suggestions.");
  }

  const prompt = buildPrompt(context);
  let lastError;
  for (const model of MODELS) {
    try {
      return await callOpenRouter(prompt, model);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error("All AI models failed");
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
  const { data, error } = await supabase
    .from("booking_pose_suggestions")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
