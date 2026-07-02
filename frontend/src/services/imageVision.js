import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { getVisionAnalysisUrl } from "../lib/cloudinary";
import { buildSuggestionsFromVision, buildVisionInstruction } from "../lib/visionPostProcess";

const OPENROUTER_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;

/** Accuracy-first, with fast fallback. */
const PRIMARY_VISION_MODEL = "google/gemma-4-31b-it:free";
const FALLBACK_VISION_MODELS = ["nvidia/nemotron-nano-12b-v2-vl:free", "google/gemma-4-26b-a4b-it:free"];

const ANALYSIS_DEADLINE_MS = 35_000;
const PER_REQUEST_TIMEOUT_MS = 22_000;
const RATE_LIMIT_RETRY_MS = 4_000;

const asArray = (v) => (Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : []);
const asText = (v) => (typeof v === "string" ? v.trim() : "");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const VISION_PROMPT =
  "You are a photography classification expert. Describe ONLY what is visible in the image. " +
  "List visual_cues (clothing, props, setting) before choosing event_type. " +
  "Occasion must be proven by visible evidence — never by mood alone. " +
  "Romantic couple in graduation caps = Graduation, NOT Wedding. Return ONLY valid JSON.";

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
      max_tokens: 1300,
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
  if (!raw) return { ok: false, rateLimited: false, timedOut: false, error: "empty response", body: "" };

  const parsed = parseModelJson(raw);
  const suggestions = mergeParsedToSuggestions(parsed);
  if (!suggestions) return { ok: false, rateLimited: false, timedOut: false, error: "invalid json", body: "" };

  return { ok: true, suggestions, model };
}

function buildModelList() {
  const customModel = import.meta.env.VITE_OPENROUTER_MODEL;
  const models = customModel
    ? [customModel, PRIMARY_VISION_MODEL, ...FALLBACK_VISION_MODELS]
    : [PRIMARY_VISION_MODEL, ...FALLBACK_VISION_MODELS];
  return [...new Set(models)];
}

/** Fast OpenRouter path — one primary model, one fallback, hard time cap. */
async function analyzeWithOpenRouterDirect(urls, { onStatus } = {}) {
  if (!OPENROUTER_KEY) return null;

  const content = [{ type: "text", text: buildVisionInstruction(urls.length) }];
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
    if (timeLeft() < 2000) break;

    onStatus?.(`Analyzing with ${shortModelName(model)}...`);
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
        if (!rateLimitRetried && timeLeft() > RATE_LIMIT_RETRY_MS + 3000) {
          rateLimitRetried = true;
          onStatus?.(`Busy — retrying in ${Math.round(RATE_LIMIT_RETRY_MS / 1000)}s...`);
          await sleep(RATE_LIMIT_RETRY_MS);
          const retryTimeout = Math.min(PER_REQUEST_TIMEOUT_MS, timeLeft());
          const retry = await callOpenRouter(model, content, retryTimeout);
          if (retry.ok) {
            return { suggestions: retry.suggestions, meta: { source: "openrouter-direct", model: retry.model } };
          }
          lastError = retry.body?.slice(0, 180) || retry.error;
        }
        continue;
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
        detail: "Models are busy — wait a minute and click Re-analyze.",
      },
    };
  }

  return {
    suggestions: null,
    meta: {
      error: "vision_failed",
      detail: lastError,
    },
  };
}

async function analyzeViaEdgeFunction(urls) {
  const { data, error } = await supabase.functions.invoke("analyze-image", {
    body: { imageUrls: urls },
  });
  const payload = await readInvokePayload(data, error);
  return parseInvokeResponse(payload);
}

export async function analyzeImagesWithVision(imageUrls, { maxImages = 2, onStatus } = {}) {
  const urls = (imageUrls || [])
    .filter(Boolean)
    .slice(-maxImages)
    .map((u) => getVisionAnalysisUrl(u));

  if (!urls.length) return null;

  onStatus?.("Analyzing...");

  if (OPENROUTER_KEY) {
    const direct = await analyzeWithOpenRouterDirect(urls, { onStatus });
    if (direct?.suggestions) return direct;
    if (direct?.meta) return direct;
  }

  try {
    const edge = await Promise.race([analyzeViaEdgeFunction(urls), sleep(35000).then(() => null)]);
    if (edge?.suggestions) return edge;
    return edge;
  } catch (err) {
    return { suggestions: null, meta: { error: "network_error", detail: err.message } };
  }
}

export function localColorSuggestionsOnly(local) {
  if (!local) return null;
  return {
    color_palette: local.color_palette || [],
    tags: (local.tags || []).filter((t) =>
      ["bright", "dark", "balanced", "warm tones", "cool tones", "neutral tones", "muted", "vibrant", "greenery"].some(
        (safe) => t.includes(safe)
      )
    ),
  };
}
