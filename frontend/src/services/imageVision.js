import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { getVisionAnalysisUrl } from "../lib/cloudinary";
import { buildSuggestionsFromVision, buildFastVisionInstruction } from "../lib/visionPostProcess";

const OPENROUTER_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;

/** Fastest free models first — fewer fallbacks = less waiting when busy. */
const FAST_VISION_MODELS = [
  "nvidia/nemotron-nano-12b-v2-vl:free",
  "google/gemma-4-26b-a4b-it:free",
  "google/gemma-4-31b-it:free",
];

const ANALYSIS_DEADLINE_MS = 22_000;
const PER_REQUEST_TIMEOUT_MS = 14_000;
const RATE_LIMIT_RETRY_MS = 2_500;
const CACHE_TTL_MS = 30 * 60 * 1000;

const visionCache = new Map();

const asArray = (v) => (Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : []);
const asText = (v) => (typeof v === "string" ? v.trim() : "");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const VISION_PROMPT =
  "You are a photography classification expert. Describe ONLY what is visible. " +
  "Occasion must be proven by clothing/props/setting — never mood alone. Return ONLY valid JSON.";

function cacheKey(urls) {
  return urls.map((u) => u.split("/").slice(-2).join("/")).join("|");
}

function readCache(urls) {
  const hit = visionCache.get(cacheKey(urls));
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    visionCache.delete(cacheKey(urls));
    return null;
  }
  return hit.result;
}

function writeCache(urls, result) {
  if (result?.suggestions) {
    visionCache.set(cacheKey(urls), { at: Date.now(), result });
  }
}

function normalizeSuggestions(suggestions) {
  if (!suggestions || typeof suggestions !== "object") return null;
  return {
    theme: asText(suggestions.theme),
    event_type: asText(suggestions.event_type),
    photography_style: asText(suggestions.photography_style),
    mood: asText(suggestions.mood),
    location_type: asText(suggestions.location_type),
    lighting_style: asText(suggestions.lighting_style),
    editing_style: asText(suggestions.editing_style),
    description: asText(suggestions.description),
    color_palette: asArray(suggestions.color_palette).map((c) => c.toUpperCase()),
    outfit_suggestions: asArray(suggestions.outfit_suggestions),
    prop_suggestions: asArray(suggestions.prop_suggestions),
    tags: asArray(suggestions.tags).map((t) => t.toLowerCase()),
  };
}

function parseModelJson(raw) {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return JSON.parse(fenced ? fenced[1].trim() : trimmed);
}

function mergeParsedToSuggestions(parsed) {
  return normalizeSuggestions(buildSuggestionsFromVision(parsed));
}

function isRateLimited(status, body) {
  return status === 429 || body.includes("rate-limited") || body.includes("RESOURCE_EXHAUSTED");
}

function isUnavailableModel(status, body) {
  return (
    status === 404 ||
    body.includes("No endpoints found") ||
    body.includes("not found") ||
    body.includes("does not exist")
  );
}

function shortModelName(model) {
  return model.split("/")[1]?.split(":")[0] || model;
}

async function readInvokePayload(data, error) {
  if (data && typeof data === "object") return data;
  if (error instanceof FunctionsHttpError) {
    try {
      return await error.context.json();
    } catch {
      /* ignore */
    }
  }
  return null;
}

function parseInvokeResponse(payload) {
  if (!payload) return null;
  if (payload.suggestions && payload.ok !== false) {
    const suggestions = normalizeSuggestions(payload.suggestions);
    if (suggestions) return { suggestions, meta: { source: payload.source, model: payload.model } };
  }
  if (payload.ok === false || payload.error) {
    return { suggestions: null, meta: { error: payload.error || "failed", detail: asText(payload.detail) } };
  }
  return null;
}

function buildModelList() {
  const customModel = import.meta.env.VITE_OPENROUTER_MODEL;
  const models = customModel ? [customModel, ...FAST_VISION_MODELS] : FAST_VISION_MODELS;
  return [...new Set(models)];
}

async function callOpenRouter(model, content, timeoutMs) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_KEY}`,
      "HTTP-Referer": window.location.origin,
      "X-Title": "StudioBook",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: VISION_PROMPT },
        { role: "user", content },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: 900,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  const bodyText = await res.text();
  if (!res.ok) {
    return {
      ok: false,
      rateLimited: isRateLimited(res.status, bodyText),
      unavailable: isUnavailableModel(res.status, bodyText),
      error: `HTTP ${res.status}`,
      body: bodyText,
    };
  }

  const data = JSON.parse(bodyText);
  const raw = data?.choices?.[0]?.message?.content;
  if (!raw) return { ok: false, rateLimited: false, error: "empty response", body: "" };

  const parsed = parseModelJson(raw);
  const suggestions = mergeParsedToSuggestions(parsed);
  if (!suggestions) return { ok: false, rateLimited: false, error: "invalid json", body: "" };

  return { ok: true, suggestions, model };
}

async function analyzeWithOpenRouterDirect(urls, { onStatus } = {}) {
  if (!OPENROUTER_KEY) return null;

  const content = [{ type: "text", text: buildFastVisionInstruction(urls.length) }];
  for (const url of urls) {
    content.push({ type: "image_url", image_url: { url } });
  }

  const models = buildModelList();
  const deadline = Date.now() + ANALYSIS_DEADLINE_MS;
  const timeLeft = () => deadline - Date.now();
  let lastError = "Analysis timed out.";
  let sawRateLimit = false;
  let rateLimitRetried = false;

  for (const model of models) {
    if (timeLeft() < 1500) break;

    onStatus?.(`AI analyzing (${shortModelName(model)})...`);
    const timeoutMs = Math.min(PER_REQUEST_TIMEOUT_MS, timeLeft());

    try {
      const result = await callOpenRouter(model, content, timeoutMs);
      if (result.ok) {
        return { suggestions: result.suggestions, meta: { source: "openrouter-direct", model: result.model } };
      }

      if (result.unavailable) continue;

      lastError = result.body?.slice(0, 180) || result.error;

      if (result.rateLimited) {
        sawRateLimit = true;
        if (!rateLimitRetried && timeLeft() > RATE_LIMIT_RETRY_MS + 2000) {
          rateLimitRetried = true;
          onStatus?.(`Models busy — quick retry...`);
          await sleep(RATE_LIMIT_RETRY_MS);
          const retry = await callOpenRouter(model, content, Math.min(PER_REQUEST_TIMEOUT_MS, timeLeft()));
          if (retry.ok) {
            return { suggestions: retry.suggestions, meta: { source: "openrouter-direct", model: retry.model } };
          }
          lastError = retry.body?.slice(0, 180) || retry.error;
        }
        break;
      }
    } catch (err) {
      lastError = err.name === "TimeoutError" || err.name === "AbortError" ? "Request timed out." : err.message;
    }
  }

  if (sawRateLimit) {
    return {
      suggestions: null,
      meta: {
        error: "rate_limited",
        detail: "AI models are busy — quick local suggestions were applied. Try Re-analyze in a minute.",
      },
    };
  }

  return {
    suggestions: null,
    meta: { error: "vision_failed", detail: lastError },
  };
}

async function analyzeViaEdgeFunction(urls) {
  const { data, error } = await supabase.functions.invoke("analyze-image", {
    body: { imageUrls: urls },
  });
  const payload = await readInvokePayload(data, error);
  return parseInvokeResponse(payload);
}

function raceVisionProviders(urls, { onStatus } = {}) {
  const attempts = [];

  if (OPENROUTER_KEY) {
    attempts.push(
      analyzeWithOpenRouterDirect(urls, { onStatus }).then((result) => {
        if (result?.suggestions) return result;
        throw result;
      })
    );
  }

  attempts.push(
    analyzeViaEdgeFunction(urls).then((result) => {
      if (result?.suggestions) return result;
      throw result;
    })
  );

  if (!attempts.length) return Promise.resolve(null);

  return Promise.any(attempts).catch(() => null);
}

export async function analyzeImagesWithVision(imageUrls, { maxImages = 1, onStatus } = {}) {
  const urls = (imageUrls || [])
    .filter(Boolean)
    .slice(-maxImages)
    .map((u) => getVisionAnalysisUrl(u));

  if (!urls.length) return null;

  const cached = readCache(urls);
  if (cached) {
    onStatus?.("Using recent analysis.");
    return cached;
  }

  onStatus?.("Enhancing with AI...");

  const raced = await Promise.race([
    raceVisionProviders(urls, { onStatus }),
    sleep(ANALYSIS_DEADLINE_MS).then(() => null),
  ]);

  if (raced?.suggestions) {
    writeCache(urls, raced);
    return raced;
  }

  if (raced?.meta) return raced;

  return {
    suggestions: null,
    meta: {
      error: "vision_failed",
      detail: "AI timed out — local color/mood suggestions are still shown.",
    },
  };
}

export function localColorSuggestionsOnly(local) {
  if (!local) return null;
  return {
    theme: local.theme,
    mood: local.mood,
    location_type: local.location_type,
    photography_style: local.photography_style,
    lighting_style: local.lighting_style,
    editing_style: local.editing_style,
    color_palette: local.color_palette || [],
    tags: (local.tags || []).filter((t) =>
      ["bright", "dark", "balanced", "warm tones", "cool tones", "neutral tones", "muted", "vibrant", "greenery"].some(
        (safe) => t.includes(safe)
      )
    ),
  };
}
