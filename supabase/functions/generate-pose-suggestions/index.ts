import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODELS = [
  "anthropic/claude-3.5-sonnet",
  "openai/gpt-4o-mini",
  "google/gemini-2.0-flash-001",
];

function buildPrompt(body: Record<string, unknown>) {
  return `You are a professional photography posing coach for Studio 8Teen.

Generate exactly 4 pose suggestions and one mood board for this session.

Package: ${body.packageName || "General portrait"}
Date: ${body.eventDate || "TBD"}
Location: ${body.location || "Studio"}
Client notes: ${body.notes || "None"}
Preferred mood/aesthetic: ${body.moodHint || "Elegant and natural"}

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

function parseJsonContent(raw: string) {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return JSON.parse(fenced ? fenced[1].trim() : trimmed);
}

function normalizeResult(parsed: Record<string, unknown>, modelUsed: string) {
  const poses = Array.isArray(parsed?.poses) ? (parsed.poses as Record<string, unknown>[]).slice(0, 5) : [];
  const mood = (parsed?.mood_board || {}) as Record<string, unknown>;
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
        ? mood.color_palette
            .map((c) => String(c).toUpperCase())
            .filter((c) => /^#([0-9A-F]{3}|[0-9A-F]{6})$/.test(c))
            .slice(0, 6)
        : ["#A98B75", "#F8F6F3", "#5B4636", "#E8D5C4"],
      lighting: String(mood.lighting || "").trim(),
      setting: String(mood.setting || "").trim(),
      props: String(mood.props || "").trim(),
      vibe: String(mood.vibe || "").trim(),
    },
    model_used: modelUsed,
  };
}

async function callOpenRouter(apiKey: string, prompt: string, model: string) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://studio8teen.org",
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("OPENROUTER_API_KEY") || Deno.env.get("VITE_OPENROUTER_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "OPENROUTER_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const prompt = buildPrompt(body || {});
    let lastError: Error | null = null;

    for (const model of MODELS) {
      try {
        const result = await callOpenRouter(apiKey, prompt, model);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }

    return new Response(JSON.stringify({ error: lastError?.message || "All models failed" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
