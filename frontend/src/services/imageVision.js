import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { getVisionAnalysisUrl } from "../lib/cloudinary";
import { clampSuggestionsToCategories, asCategoryValues } from "./moodBoardCategories";

const ANALYSIS_DEADLINE_MS = 55_000;
const CACHE_TTL_MS = 30 * 60 * 1000;

const visionCache = new Map();

const asArray = (v) => (Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : []);
const asText = (v) => (typeof v === "string" ? v.trim() : "");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
    photography_style: asCategoryValues(suggestions.photography_style),
    mood: asCategoryValues(suggestions.mood),
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

async function readInvokePayload(data, error) {
  if (data && typeof data === "object") return data;
  if (error instanceof FunctionsHttpError) {
    try {
      return await error.context.json();
    } catch {
      try {
        const text = await error.context.text();
        return text ? JSON.parse(text) : null;
      } catch {
        return { ok: false, error: "failed", detail: error.message };
      }
    }
  }
  if (error) {
    return { ok: false, error: "failed", detail: error.message || String(error) };
  }
  return null;
}

function parseInvokeResponse(payload) {
  if (!payload) return null;
  if (payload.suggestions && payload.ok !== false) {
    const suggestions = normalizeSuggestions(payload.suggestions);
    if (suggestions) {
      return {
        suggestions,
        meta: { source: payload.source, model: payload.model },
      };
    }
  }
  if (payload.ok === false || payload.error) {
    const code = payload.error || "failed";
    return {
      suggestions: null,
      meta: {
        error:
          code === "quota_exceeded" || code === "rate_limited" ? "rate_limited" : code,
        detail: asText(payload.detail) || asText(payload.error) || "AI analysis failed",
      },
    };
  }
  return null;
}

async function analyzeViaEdgeFunction(urls, categoryOptions, onStatus) {
  onStatus?.("AI analyzing images...");
  const { data, error } = await supabase.functions.invoke("analyze-image", {
    body: { imageUrls: urls, categoryOptions },
  });
  const payload = await readInvokePayload(data, error);
  const parsed = parseInvokeResponse(payload);
  if (parsed) return parsed;
  return {
    suggestions: null,
    meta: {
      error: "failed",
      detail: error?.message || "No response from AI service",
    },
  };
}

/**
 * Call the analyze-image edge function (OpenRouter → Gemini → OpenAI fallbacks live there).
 * Never puts API keys in the browser.
 */
export async function analyzeImagesWithVision(
  imageUrls,
  { maxImages = 2, onStatus, categoryOptions } = {}
) {
  const urls = (imageUrls || [])
    .filter(Boolean)
    .slice(-maxImages)
    .map((u) => getVisionAnalysisUrl(u, 448));

  if (!urls.length) return null;

  const cached = readCache(urls);
  if (cached) {
    onStatus?.("Using recent analysis.");
    return cached;
  }

  onStatus?.("Enhancing with AI...");

  const analysisPromise = analyzeViaEdgeFunction(urls, categoryOptions, onStatus);
  const raced = await Promise.race([
    analysisPromise,
    sleep(ANALYSIS_DEADLINE_MS).then(() => ({
      suggestions: null,
      meta: {
        error: "vision_failed",
        detail: "AI timed out — local color/mood suggestions are still shown. Try Re-analyze.",
      },
    })),
  ]);

  // If we timed out, still wait briefly for late success? Prefer timed result.
  if (raced?.suggestions) {
    writeCache(urls, raced);
    onStatus?.("AI analysis completed.");
    return raced;
  }

  return raced || {
    suggestions: null,
    meta: {
      error: "vision_failed",
      detail: "AI unavailable — local suggestions were applied. Try Re-analyze.",
    },
  };
}

export function localColorSuggestionsOnly(local, categoryOptions) {
  if (!local) return null;
  const base = {
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
  return clampSuggestionsToCategories(base, categoryOptions);
}
