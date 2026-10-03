import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EVENT_TYPES = [
  "Wedding", "Birthday", "Debut", "Graduation", "Christening",
  "Family", "Corporate", "Casual Portrait", "Formal Portrait",
];

const FALLBACK_CATEGORIES = {
  theme: ["Minimalist", "Modern", "Vintage", "Cinematic", "Floral", "Luxury", "Elegant", "Nature"],
  mood: ["Romantic", "Joyful", "Formal", "Playful", "Cozy", "Dramatic", "Natural"],
  location_type: ["Indoor", "Garden", "Beach", "Church", "Outdoor", "Nature"],
  photography_style: ["Editorial", "Fine Art", "Aerial", "Close-up", "Portrait", "Candid", "Traditional"],
};

type CategoryOptions = {
  theme: string[];
  mood: string[];
  location_type: string[];
  photography_style: string[];
};

function normalizeCategoryOptions(input?: Partial<CategoryOptions>): CategoryOptions {
  return {
    theme: input?.theme?.length ? [...input.theme] : [...FALLBACK_CATEGORIES.theme],
    mood: input?.mood?.length ? [...input.mood] : [...FALLBACK_CATEGORIES.mood],
    location_type: input?.location_type?.length ? [...input.location_type] : [...FALLBACK_CATEGORIES.location_type],
    photography_style: input?.photography_style?.length
      ? [...input.photography_style]
      : [...FALLBACK_CATEGORIES.photography_style],
  };
}

async function resolveCategoryOptions(body: { categoryOptions?: Partial<CategoryOptions> }): Promise<CategoryOptions> {
  if (body?.categoryOptions?.theme?.length || body?.categoryOptions?.mood?.length) {
    return normalizeCategoryOptions(body.categoryOptions);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (url && key) {
    const supabase = createClient(url, key);
    const { data } = await supabase
      .from("mood_board_categories")
      .select("category_type, label")
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true });

    const grouped: CategoryOptions = { theme: [], mood: [], location_type: [], photography_style: [] };
    for (const row of data || []) {
      const type = row.category_type as keyof CategoryOptions;
      if (grouped[type]) grouped[type].push(row.label);
    }
    if (grouped.theme.length || grouped.mood.length) {
      return normalizeCategoryOptions(grouped);
    }
  }

  return normalizeCategoryOptions();
}

function formatCategoryList(options: string[]) {
  if (!options.length) return "(none configured — leave empty)";
  return options.join(", ");
}

const SYSTEM_PROMPT =
  "You are a photography classification expert. Describe ONLY what is visible. " +
  "Occasion/event type must be proven by clothing, props, or setting — never by mood alone. " +
  "Romantic ≠ Wedding. Couple in graduation caps = Graduation. Return ONLY valid JSON.";

function buildInstruction(imageCount: number, categoryOptions: CategoryOptions) {
  const opts = normalizeCategoryOptions(categoryOptions);
  return `Analyze ${imageCount} image(s). For EACH image separately, then produce a merged result.

Return JSON:
{
  "per_image": [
    {
      "image_index": 0,
      "visual_cues": string[] (8-12 items: exact clothing, props, people, setting you SEE),
      "event_type": string (one of: ${EVENT_TYPES.join(", ")} or ""),
      "event_confidence": "high" | "medium" | "low",
      "theme": string (MUST be exactly one of: ${formatCategoryList(opts.theme)} — or ""),
      "mood": string[] (one or more of: ${formatCategoryList(opts.mood)} — or [] if unsure),
      "photography_style": string[] (one or more of: ${formatCategoryList(opts.photography_style)} — or [] if unsure),
      "location_type": string (MUST be exactly one of: ${formatCategoryList(opts.location_type)} — or ""),
      "lighting_style": string,
      "editing_style": string,
      "color_palette": string[] (4-6 hex from THIS image — real colors only),
      "color_names": string[] (human color names matching palette, e.g. "Burgundy", "Sage", "Ivory" — NOT hex codes),
      "outfit_suggestions": string[] (specific garments you SEE or would fit this look),
      "outfit_categories": string[] (each one of: Dress, Suit, Casual, Formal, Traditional, Accessories, Footwear, Other),
      "prop_suggestions": string[] (specific props/objects),
      "prop_categories": string[] (each one of: Floral, Furniture, Lighting, Decor, Backdrop, Tableware, Signage, Other),
      "tags": string[]
    }
  ],
  "occasion_reasoning": string (why the merged event_type was chosen),
  "merged": {
    "theme": string,
    "event_type": string,
    "photography_style": string[],
    "mood": string[],
    "location_type": string,
    "lighting_style": string,
    "editing_style": string,
    "description": string (1-2 sentences for clients),
    "color_palette": string[],
    "color_names": string[],
    "outfit_suggestions": string[],
    "outfit_categories": string[],
    "prop_suggestions": string[],
    "prop_categories": string[],
    "tags": string[]
  }
}

CLASSIFICATION RULES (strict):
• GRADUATION: cap/gown, mortarboard, tassel, stole, sash, diploma, campus — even if romantic couple
• WEDDING: wedding dress, veil, groom at altar, ceremony — NOT just couple or romantic pose
• BIRTHDAY: cake+candles, balloons, party hats, kids party
• DEBUT: Filipino debut/cotillion, formal 18th gown
• CHRISTENING: baptism, christening gown, baby at church
• FAMILY: parents+children, maternity, newborn session
• CORPORATE: office, business headshot setup
• CASUAL PORTRAIT: everyday wear, no celebration props
• FORMAL PORTRAIT: studio pose, evening wear, no event props

If unsure of event_type use "" and event_confidence "low". mood and photography_style must be JSON arrays using ONLY exact labels from the lists above. Do NOT invent category labels outside the lists above.`;
}

const EVENT_THEME_HINTS: Record<string, string[]> = {
  Graduation: ["elegant", "formal", "classic"],
  Wedding: ["elegant", "luxury", "romantic", "floral"],
  Birthday: ["playful", "modern", "floral"],
  Debut: ["luxury", "elegant", "cinematic"],
  Christening: ["elegant", "nature", "floral"],
  Family: ["nature", "cozy", "natural"],
  Corporate: ["modern", "minimalist", "elegant"],
  "Casual Portrait": ["natural", "modern", "minimalist"],
  "Formal Portrait": ["elegant", "luxury", "classic"],
};

function pickThemeForEvent(eventType: string, themes: string[]) {
  if (!eventType || !themes.length) return "";
  const hints = EVENT_THEME_HINTS[eventType] || [];
  for (const hint of hints) {
    const match = pickFromList(hint, themes);
    if (match) return match;
  }
  return "";
}

const EVENT_SIGNALS: Record<string, RegExp> = {
  Graduation: /\b(graduation|graduate|grad\b|diploma|cap and gown|mortarboard|tassel|commencement|stole|sash|class of|academic regalia|school)\b/i,
  Wedding: /\b(wedding|bride|groom|bridal|wedding dress|wedding gown|wedding veil|matrimony|wedding ceremony|wedding bouquet)\b/i,
  Birthday: /\b(birthday|birthday cake|balloons|party hat|happy birthday|cake candles|children.?s party)\b/i,
  Debut: /\b(debut|debutante|18th birthday|cotillion)\b/i,
  Christening: /\b(christening|baptism|baptismal|baptism gown)\b/i,
  Family: /\b(family portrait|family session|maternity|newborn|baby|parents|multi.?generational)\b/i,
  Corporate: /\b(corporate|business portrait|headshot|office|executive|professional headshot)\b/i,
};

const CONFIDENCE_WEIGHT = { high: 3, medium: 2, low: 1 };

function norm(s: string) {
  return s.toLowerCase().trim();
}

function asArray(v: unknown) {
  return Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];
}
function asText(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

function pickFromList(raw: string, options: string[]): string {
  if (!raw) return "";
  const n = norm(raw);
  const exact = options.find((o) => norm(o) === n);
  if (exact) return exact;
  return options.find((o) => n.includes(norm(o)) || norm(o).includes(n)) || "";
}

function scoreEvidence(text: string): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const [event, pattern] of Object.entries(EVENT_SIGNALS)) {
    const hits = text.match(new RegExp(pattern.source, "gi"));
    if (hits) scores[event] = hits.length * 4;
  }
  return scores;
}

function voteEvent(perImage: Record<string, unknown>[], evidenceText: string): string {
  const votes: Record<string, number> = {};
  const evidenceScores = scoreEvidence(evidenceText);

  for (const img of perImage) {
    const cues = asArray(img.visual_cues).join(" ");
    const cueScores = scoreEvidence(cues);
    const modelEvent = pickFromList(asText(img.event_type), EVENT_TYPES);
    const conf = CONFIDENCE_WEIGHT[asText(img.event_confidence) as keyof typeof CONFIDENCE_WEIGHT] || 1;

    // Evidence from cues beats model label
    const cueTop = Object.entries(cueScores).sort((a, b) => b[1] - a[1])[0];
    if (cueTop && cueTop[1] >= 4) {
      votes[cueTop[0]] = (votes[cueTop[0]] || 0) + cueTop[1];
    } else if (modelEvent) {
      votes[modelEvent] = (votes[modelEvent] || 0) + conf * 2;
    }
  }

  for (const [event, score] of Object.entries(evidenceScores)) {
    votes[event] = (votes[event] || 0) + score;
  }

  // Graduation beats Wedding when grad evidence exists without wedding proof
  if (votes.Graduation && !EVENT_SIGNALS.Wedding.test(evidenceText)) {
    votes.Graduation += 5;
    if (votes.Wedding) votes.Wedding = Math.max(0, votes.Wedding - 5);
  }

  const ranked = Object.entries(votes).sort((a, b) => b[1] - a[1]);
  const [winner, score] = ranked[0] || ["", 0];
  return score >= 4 ? winner : "";
}

function asCategoryValues(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((x) => String(x).trim()).filter(Boolean);
  const text = asText(value);
  return text ? [text] : [];
}

function voteFieldMulti(perImage: Record<string, unknown>[], key: string, options: string[], limit = 3): string[] {
  const votes: Record<string, number> = {};
  for (const img of perImage) {
    const candidates = asCategoryValues(img[key]);
    for (const candidate of candidates) {
      const val = pickFromList(candidate, options);
      if (val) votes[val] = (votes[val] || 0) + 1;
    }
  }
  return Object.entries(votes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value]) => value);
}

function voteField(perImage: Record<string, unknown>[], key: string, options: string[]): string {
  const votes: Record<string, number> = {};
  for (const img of perImage) {
    const val = pickFromList(asText(img[key]), options);
    if (val) votes[val] = (votes[val] || 0) + 1;
  }
  const ranked = Object.entries(votes).sort((a, b) => b[1] - a[1]);
  return ranked[0]?.[0] || "";
}

function mergeUnique(perImage: Record<string, unknown>[], key: string, limit = 8): string[] {
  const set = new Set<string>();
  for (const img of perImage) {
    for (const item of asArray(img[key])) set.add(item);
  }
  return [...set].slice(0, limit);
}

function mergeColors(perImage: Record<string, unknown>[]): string[] {
  const set = new Set<string>();
  for (const img of perImage) {
    for (const c of asArray(img.color_palette)) {
      const hex = c.toUpperCase();
      if (/^#([0-9A-F]{6}|[0-9A-F]{3})$/.test(hex)) set.add(hex);
    }
  }
  return [...set].slice(0, 6);
}

type Suggestions = {
  theme: string;
  event_type: string;
  photography_style: string[];
  mood: string[];
  location_type: string;
  lighting_style: string;
  editing_style: string;
  description: string;
  color_palette: string[];
  color_names: string[];
  outfit_suggestions: string[];
  outfit_categories: string[];
  prop_suggestions: string[];
  prop_categories: string[];
  tags: string[];
};

function buildFromPerImage(
  perImage: Record<string, unknown>[],
  merged: Record<string, unknown>,
  reasoning: string,
  categoryOptions: CategoryOptions
): {
  suggestions: Suggestions;
  visual_cues: string[];
  occasion_reasoning: string;
  confidence: string;
} {
  const opts = normalizeCategoryOptions(categoryOptions);
  const allCues = perImage.flatMap((img) => asArray(img.visual_cues));
  const evidenceText = [reasoning, ...allCues, asText(merged.description)].join(" ").toLowerCase();

  const event_type = voteEvent(perImage, evidenceText) || pickFromList(asText(merged.event_type), EVENT_TYPES);

  let theme = voteField(perImage, "theme", opts.theme) || pickFromList(asText(merged.theme), opts.theme);
  if (!theme && event_type) {
    theme = pickThemeForEvent(event_type, opts.theme);
  }

  const moodVotes = voteFieldMulti(perImage, "mood", opts.mood, 3);
  const mood = moodVotes.length
    ? moodVotes
    : asCategoryValues(merged.mood)
        .map((m) => pickFromList(m, opts.mood))
        .filter(Boolean)
        .filter((v, i, arr) => arr.indexOf(v) === i)
        .slice(0, 3);

  const tagSet = new Set<string>();
  mergeUnique(perImage, "tags", 20).forEach((t) => tagSet.add(t.toLowerCase()));
  asArray(merged.tags).forEach((t) => tagSet.add(t.toLowerCase()));
  if (event_type) tagSet.add(event_type.toLowerCase());
  if (event_type !== "Wedding") ["wedding", "bridal", "bride", "groom"].forEach((w) => tagSet.delete(w));

  const highConf = perImage.filter((i) => asText(i.event_confidence) === "high").length;
  const confidence = highConf >= perImage.length / 2 ? "high" : event_type ? "medium" : "low";

  const styleVotes = voteFieldMulti(perImage, "photography_style", opts.photography_style, 3);

  return {
    suggestions: {
      theme,
      event_type,
      photography_style: styleVotes.length
        ? styleVotes
        : asCategoryValues(merged.photography_style)
            .map((s) => pickFromList(s, opts.photography_style))
            .filter(Boolean)
            .filter((v, i, arr) => arr.indexOf(v) === i)
            .slice(0, 3),
      mood,
      location_type:
        voteField(perImage, "location_type", opts.location_type) ||
        pickFromList(asText(merged.location_type), opts.location_type),
      lighting_style: asText(merged.lighting_style) || asText(perImage[0]?.lighting_style),
      editing_style: asText(merged.editing_style) || asText(perImage[0]?.editing_style),
      description: asText(merged.description),
      color_palette: mergeColors(perImage).length ? mergeColors(perImage) : asArray(merged.color_palette).map((c) => c.toUpperCase()).filter((c) => /^#([0-9A-F]{6}|[0-9A-F]{3})$/.test(c)),
      color_names: mergeUnique(perImage, "color_names", 6).length
        ? mergeUnique(perImage, "color_names", 6)
        : asArray(merged.color_names),
      outfit_suggestions: mergeUnique(perImage, "outfit_suggestions", 6).length ? mergeUnique(perImage, "outfit_suggestions", 6) : asArray(merged.outfit_suggestions),
      outfit_categories: mergeUnique(perImage, "outfit_categories", 6).length
        ? mergeUnique(perImage, "outfit_categories", 6)
        : asArray(merged.outfit_categories),
      prop_suggestions: mergeUnique(perImage, "prop_suggestions", 6).length ? mergeUnique(perImage, "prop_suggestions", 6) : asArray(merged.prop_suggestions),
      prop_categories: mergeUnique(perImage, "prop_categories", 6).length
        ? mergeUnique(perImage, "prop_categories", 6)
        : asArray(merged.prop_categories),
      tags: [...tagSet].slice(0, 10),
    },
    visual_cues: allCues.slice(0, 15),
    occasion_reasoning: reasoning,
    confidence,
  };
}

function parseJsonContent(raw: string) {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1].trim() : trimmed;
  try {
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    const start = body.indexOf("{");
    const end = body.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(body.slice(start, end + 1)) as Record<string, unknown>;
    }
    throw new Error("unparseable_model_json");
  }
}

async function fetchImagePart(url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid image URL");
  }
  const host = parsed.hostname.toLowerCase();
  const allowed =
    host === "res.cloudinary.com" ||
    host.endsWith(".cloudinary.com") ||
    host === "cdn.studio8teen.org";
  if (parsed.protocol !== "https:" || !allowed) {
    throw new Error("Image host not allowed");
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not fetch image: ${url}`);
  const mimeType = res.headers.get("content-type") || "image/jpeg";
  const bytes = new Uint8Array(await res.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return { inline_data: { mime_type: mimeType.split(";")[0], data: btoa(binary) } };
}

function looksTechnical(text: string) {
  return /[{}"]|gemini_|models\/|not found|api key|openrouter|openai|error code|status/i.test(text);
}

function friendlyVisionDetail(code: string, detail: string) {
  if (code === "quota_exceeded" || code === "rate_limited") {
    return "AI is busy right now. Your photo suggestions are already filled in. Try Re-analyze in a minute.";
  }
  if (detail && !looksTechnical(detail)) return detail;
  return "Photo suggestions are ready. AI enhancement is unavailable right now, so you can keep editing or try Re-analyze later.";
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function geminiRequestBody(
  urls: string[],
  imageParts: Awaited<ReturnType<typeof fetchImagePart>>[],
  categoryOptions: CategoryOptions,
  jsonMode: boolean
) {
  const generationConfig: Record<string, unknown> = {
    temperature: 0,
    maxOutputTokens: 1800,
  };
  if (jsonMode) generationConfig.responseMimeType = "application/json";
  return {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{
      role: "user",
      parts: [
        { text: buildInstruction(urls.length, categoryOptions) },
        ...imageParts.map((part, i) => [
          { text: `--- Image ${i + 1} of ${urls.length} ---` },
          part,
        ]).flat(),
      ],
    }],
    generationConfig,
  };
}

async function callGeminiModel(
  apiKey: string,
  model: string,
  urls: string[],
  imageParts: Awaited<ReturnType<typeof fetchImagePart>>[],
  categoryOptions: CategoryOptions
) {
  const post = (jsonMode: boolean) =>
    fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiRequestBody(urls, imageParts, categoryOptions, jsonMode)),
        signal: AbortSignal.timeout(18000),
      }
    );

  let res = await post(true);
  let bodyText = await res.text();
  if (!res.ok && res.status === 400) {
    res = await post(false);
    bodyText = await res.text();
  }

  if (res.ok) {
    const data = JSON.parse(bodyText);
    const parts = data?.candidates?.[0]?.content?.parts;
    const raw = Array.isArray(parts)
      ? parts.map((part: { text?: string }) => part?.text || "").join("\n")
      : "";
    if (!raw.trim()) return { ok: false as const, isQuota: false, status: 502, body: "empty_gemini_response", model };
    return { ok: true as const, raw, model };
  }

  const missingModel = res.status === 404 || bodyText.includes("is not found") || bodyText.includes("NOT_FOUND");
  if (missingModel) {
    return { ok: false as const, isQuota: false, status: res.status, body: "model_not_found", model };
  }

  const isQuota = res.status === 429 || bodyText.includes("RESOURCE_EXHAUSTED") || bodyText.includes("quota");
  return { ok: false as const, isQuota, status: res.status, body: bodyText.slice(0, 300), model };
}

const RETIRED_GEMINI_MODELS = new Set([
  "gemini-1.5-flash",
  "gemini-1.5-flash-latest",
  "gemini-1.5-flash-001",
  "gemini-1.5-flash-002",
  "gemini-1.5-pro",
  "gemini-1.5-pro-latest",
  "gemini-2.0-flash",
  "gemini-2.0-flash-001",
  "gemini-2.0-flash-exp",
]);

function geminiModels(): string[] {
  const preferred = Deno.env.get("GEMINI_MODEL") || "";
  const fallbacks = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-flash-latest",
    "gemini-3.5-flash-lite",
    "gemini-3.8-flash",
  ];
  const list = preferred && !RETIRED_GEMINI_MODELS.has(preferred)
    ? [preferred, ...fallbacks]
    : fallbacks;
  return [...new Set(list)];
}

async function analyzeWithGemini(urls: string[], categoryOptions: CategoryOptions) {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return null;

  const imageParts = await Promise.all(urls.map((url) => fetchImagePart(url)));
  let lastError = "";
  let allQuota = true;

  for (const model of geminiModels()) {
    const attempt = await callGeminiModel(apiKey, model, urls, imageParts, categoryOptions);
    if (attempt.ok) {
      try {
        const parsed = parseJsonContent(attempt.raw);
        const perImage: Record<string, unknown>[] = Array.isArray(parsed.per_image)
          ? (parsed.per_image as Record<string, unknown>[])
          : [{ visual_cues: parsed.visual_cues, ...parsed } as Record<string, unknown>];
        const merged = (parsed.merged as Record<string, unknown>) || parsed;
        const reasoning = asText(parsed.occasion_reasoning);
        const result = buildFromPerImage(perImage, merged, reasoning, categoryOptions);

        return {
          suggestions: result.suggestions,
          visual_cues: result.visual_cues,
          occasion_reasoning: result.occasion_reasoning,
          confidence: result.confidence,
          per_image: perImage.map((img) => ({
            event_type: pickFromList(asText(img.event_type), EVENT_TYPES),
            event_confidence: asText(img.event_confidence),
            visual_cues: asArray(img.visual_cues).slice(0, 6),
          })),
          source: "gemini",
          model: attempt.model,
        };
      } catch (e) {
        lastError = (e as Error).message;
        allQuota = false;
        console.warn(`Gemini model ${model} returned unreadable JSON`);
        continue;
      }
    }

    lastError = attempt.body;
    if (!attempt.isQuota) allQuota = false;
    console.warn(`Gemini model ${model} failed:`, attempt.status, attempt.body.slice(0, 200));
  }

  if (allQuota) {
    throw new Error("quota_exceeded");
  }
  console.error("Gemini models unavailable:", lastError.slice(0, 300));
  throw new Error("gemini_unavailable");
}

async function analyzeWithOpenRouter(urls: string[], categoryOptions: CategoryOptions) {
  const apiKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!apiKey) return null;

  const envModel = Deno.env.get("OPENROUTER_MODEL");
  // openrouter/free auto-picks a free model that supports vision when images are sent.
  // Specific :free VL models as fallbacks when the router is busy.
  const models = [
    ...(envModel ? [envModel] : []),
    "google/gemma-4-26b-a4b-it:free",
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    "google/gemma-4-31b-it:free",
    "openrouter/free",
  ];
  let lastError = "";
  let sawRateLimit = false;

  const siteUrl = Deno.env.get("APP_URL") || "https://www.studio8teen.org";

  for (const model of [...new Set(models)]) {
    const content: Array<Record<string, unknown>> = [
      { type: "text", text: buildInstruction(Math.min(urls.length, 2), categoryOptions) },
    ];
    for (const url of urls.slice(0, 2)) {
      content.push({ type: "image_url", image_url: { url } });
    }

    try {
      const body: Record<string, unknown> = {
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content },
        ],
        temperature: 0,
        max_tokens: 1600,
      };
      // Structured JSON helps when supported; some free models reject it — retry without below
      body.response_format = { type: "json_object" };

      let res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": siteUrl,
          "X-Title": "StudioBook Mood Board",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(14000),
      });

      let bodyText = await res.text();

      // Retry without response_format if model rejects it
      if (
        !res.ok &&
        (bodyText.includes("response_format") ||
          bodyText.includes("json_object") ||
          res.status === 400)
      ) {
        delete body.response_format;
        res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            "HTTP-Referer": siteUrl,
            "X-Title": "StudioBook Mood Board",
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(14000),
        });
        bodyText = await res.text();
      }

    if (!res.ok) {
        lastError = `HTTP ${res.status}: ${bodyText.slice(0, 180)}`;
        if (res.status === 401 || res.status === 403) break;
        if (res.status === 429 || bodyText.includes("rate-limited") || bodyText.includes("Rate limit")) {
          sawRateLimit = true;
        }
        console.warn(`OpenRouter ${model} failed:`, lastError);
        continue;
      }

      const data = JSON.parse(bodyText);
      const raw = data?.choices?.[0]?.message?.content;
      if (!raw) {
        lastError = "empty_openrouter_response";
        continue;
      }

      const parsed = parseJsonContent(raw);
      const perImage: Record<string, unknown>[] = Array.isArray(parsed.per_image)
        ? (parsed.per_image as Record<string, unknown>[])
        : [parsed as Record<string, unknown>];
      const merged = (parsed.merged as Record<string, unknown>) || parsed;
      const result = buildFromPerImage(perImage, merged, asText(parsed.occasion_reasoning), categoryOptions);

      return {
        suggestions: result.suggestions,
        visual_cues: result.visual_cues,
        occasion_reasoning: result.occasion_reasoning,
        confidence: result.confidence,
        per_image: perImage,
        source: "openrouter",
        model: data?.model || model,
      };
    } catch (e) {
      lastError = (e as Error).message;
      console.warn(`OpenRouter ${model} error:`, lastError);
    }
  }

  const err = new Error(lastError || "openrouter_request_failed") as Error & { rateLimited?: boolean };
  err.rateLimited = sawRateLimit;
  throw err;
}

async function analyzeWithOpenAI(urls: string[], categoryOptions: CategoryOptions) {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return null;

  const model = Deno.env.get("OPENAI_MODEL") || "gpt-4o";
  const content: Array<Record<string, unknown>> = [{ type: "text", text: buildInstruction(urls.length, categoryOptions) }];
  for (const url of urls) {
    content.push({ type: "image_url", image_url: { url, detail: "high" } });
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: 2000,
    }),
  });

  if (!res.ok) throw new Error(`openai_request_failed: ${await res.text()}`);

  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content;
  if (!raw) throw new Error("empty_openai_response");

  const parsed = parseJsonContent(raw);
  const perImage: Record<string, unknown>[] = Array.isArray(parsed.per_image)
    ? (parsed.per_image as Record<string, unknown>[])
    : [parsed as Record<string, unknown>];
  const merged = (parsed.merged as Record<string, unknown>) || parsed;
  const result = buildFromPerImage(perImage, merged, asText(parsed.occasion_reasoning), categoryOptions);

  return {
    suggestions: result.suggestions,
    visual_cues: result.visual_cues,
    occasion_reasoning: result.occasion_reasoning,
    confidence: result.confidence,
    per_image: perImage,
    source: "openai",
    model,
  };
}

function firstUseful<T>(tasks: Promise<T | null>[]): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!tasks.length) {
      reject(new Error("unavailable"));
      return;
    }
    let pending = tasks.length;
    let lastError: Error & { rateLimited?: boolean } = new Error("unavailable");
    const finish = () => {
      pending -= 1;
      if (pending === 0) reject(lastError);
    };
    for (const task of tasks) {
      task.then((result) => {
        if (result) resolve(result);
        else finish();
      }).catch((err) => {
        lastError = err as Error & { rateLimited?: boolean };
        finish();
      });
    }
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) return jsonResponse({ error: "Unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) return jsonResponse({ error: "Unauthorized" }, 401);

    const { imageUrls, categoryOptions: rawCategoryOptions } = await req.json();
    const urls: string[] = Array.isArray(imageUrls) ? imageUrls.filter(Boolean).slice(0, 2) : [];
    if (!urls.length) return jsonResponse({ error: "imageUrls required" }, 400);

    const categoryOptions = await resolveCategoryOptions({ categoryOptions: rawCategoryOptions });

    const hasOpenRouter = Boolean(Deno.env.get("OPENROUTER_API_KEY"));
    const hasGemini = Boolean(Deno.env.get("GEMINI_API_KEY"));
    const hasOpenAI = Boolean(Deno.env.get("OPENAI_API_KEY"));
    if (!hasOpenRouter && !hasGemini && !hasOpenAI) {
      return jsonResponse({
        ok: false,
        error: "vision_not_configured",
        detail: "Set OPENROUTER_API_KEY (recommended) or GEMINI_API_KEY in Supabase secrets.",
      });
    }

    const tasks = [];
    if (hasOpenRouter) tasks.push(analyzeWithOpenRouter(urls, categoryOptions));
    if (hasGemini) tasks.push(analyzeWithGemini(urls, categoryOptions));
    if (hasOpenAI) tasks.push(analyzeWithOpenAI(urls, categoryOptions));

    try {
      const result = await firstUseful(tasks);
      return jsonResponse({ ok: true, ...result });
    } catch (e) {
      const err = e as Error & { rateLimited?: boolean };
      const busy = err.message === "quota_exceeded" || Boolean(err.rateLimited);
      console.error("Vision providers failed:", err.message?.slice(0, 300));
      return jsonResponse({
        ok: false,
        error: busy ? "quota_exceeded" : "failed",
        detail: friendlyVisionDetail(busy ? "quota_exceeded" : "failed", ""),
      });
    }
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === "quota_exceeded") {
      return jsonResponse({
        ok: false,
        error: "quota_exceeded",
        detail: "Gemini rate limit reached. Wait a moment and try Re-analyze again.",
      });
    }
    return jsonResponse({
      ok: false,
      error: "failed",
      detail: "Photo suggestions are ready. AI enhancement is unavailable right now, so you can keep editing or try Re-analyze later.",
    });
  }
});
