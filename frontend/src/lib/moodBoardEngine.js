import { asStringArray } from "../services/moodBoardThemes";
import { filterThemesByEvent } from "./themeMatching";

/**
 * Mood Board recommendation engine.
 *
 * Treats every inspiration image as a scoreable candidate that inherits its
 * parent theme's metadata (event type, theme name/tags, mood, location, style,
 * color palette, and recommendations). It filters by event type, scores each
 * image against the client's optional preferences, ranks by relevance, selects
 * the top matches, and derives recommendations from the winning images.
 */

export const SCORE_WEIGHTS = {
  eventType: 10,
  theme: 5,
  mood: 4,
  location: 3,
  photographyStyle: 3,
};

export const DEFAULT_TOP_N = 3;

function norm(value) {
  return String(value || "").toLowerCase().trim();
}

function textMatches(a, b) {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

/** Most frequent non-empty value; ties resolved by first appearance (rank order). */
function mostCommon(values) {
  const counts = new Map();
  let best = "";
  let bestCount = 0;
  for (const raw of values) {
    const value = String(raw || "").trim();
    if (!value) continue;
    const count = (counts.get(value) || 0) + 1;
    counts.set(value, count);
    if (count > bestCount) {
      bestCount = count;
      best = value;
    }
  }
  return best;
}

/** Rank list items by how often they appear; ties keep first-appearance order. */
function rankByFrequency(arrays, limit, transform = (x) => x) {
  const counts = new Map();
  const order = [];
  for (const arr of arrays) {
    for (const item of asStringArray(arr)) {
      const key = transform(item);
      if (!key) continue;
      if (!counts.has(key)) order.push(key);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  return order.sort((a, b) => counts.get(b) - counts.get(a)).slice(0, limit);
}

/**
 * Build candidate images for an event type. Each image carries a reference to
 * its parent theme so it can be scored and used for recommendations.
 */
export function buildCandidateImages(themes, eventType) {
  const matching = filterThemesByEvent(themes, eventType);
  const candidates = [];
  matching.forEach((theme, themeIndex) => {
    (theme.inspiration_images || []).forEach((img, imgIndex) => {
      if (!img?.url) return;
      candidates.push({
        id: img.id || `${theme.id}-${imgIndex}`,
        url: img.url,
        caption: img.caption || "",
        themeId: theme.id,
        themeName: theme.name,
        theme,
        // Stable tie-breaker: theme sort order, then upload order within a theme.
        order: (theme.sort_order || themeIndex) * 1000 + imgIndex,
      });
    });
  });
  return candidates;
}

/** Score a single candidate image against the client's preferences. */
export function scoreCandidate(candidate, prefs) {
  const theme = candidate.theme;
  let score = 0;
  const matched = [];

  // Event type is guaranteed (candidates are pre-filtered by event type).
  score += SCORE_WEIGHTS.eventType;
  matched.push("Event type");

  if (prefs.theme) {
    const themeTokens = [theme.name, ...asStringArray(theme.tags)];
    if (themeTokens.some((token) => textMatches(token, prefs.theme))) {
      score += SCORE_WEIGHTS.theme;
      matched.push("Theme");
    }
  }
  if (prefs.mood && textMatches(theme.mood, prefs.mood)) {
    score += SCORE_WEIGHTS.mood;
    matched.push("Mood");
  }
  if (prefs.locationType && textMatches(theme.location_type, prefs.locationType)) {
    score += SCORE_WEIGHTS.location;
    matched.push("Location");
  }
  if (prefs.photographyStyle && textMatches(theme.photography_style, prefs.photographyStyle)) {
    score += SCORE_WEIGHTS.photographyStyle;
    matched.push("Photography style");
  }

  return { ...candidate, score, matched };
}

/** Distinct theme names available for a given event type (for the Theme dropdown). */
export function getThemeNamesForEvent(themes, eventType) {
  const matching = filterThemesByEvent(themes, eventType);
  return [...new Set(matching.map((t) => t.name).filter(Boolean))];
}

function buildDescription(prefs, selectedCount) {
  const parts = [];
  if (prefs.theme) parts.push(prefs.theme.toLowerCase());
  if (prefs.mood) parts.push(`${prefs.mood.toLowerCase()} mood`);
  if (prefs.photographyStyle) parts.push(`${prefs.photographyStyle.toLowerCase()} style`);
  if (prefs.locationType) parts.push(prefs.locationType.toLowerCase());
  const prefText = parts.length ? ` matched to your ${parts.join(", ")} preferences` : "";
  return `A curated ${prefs.eventType} mood board — the top ${selectedCount} inspiration ${selectedCount === 1 ? "image" : "images"}${prefText}.`;
}

/**
 * Generate a personalized mood board.
 * @returns {{ moodBoard, scoreSummary } | { error }}
 */
export function generateMoodBoard(themes, prefs, { topN = DEFAULT_TOP_N } = {}) {
  if (!prefs?.eventType) {
    return { error: "Please select your event type first." };
  }

  const candidates = buildCandidateImages(themes, prefs.eventType);
  if (!candidates.length) {
    return { error: `No inspiration images are available for ${prefs.eventType} yet. Please try another event type or contact the studio.` };
  }

  const scored = candidates
    .map((candidate) => scoreCandidate(candidate, prefs))
    .sort((a, b) => b.score - a.score || a.order - b.order);

  const top = scored.slice(0, topN);
  const selectedThemes = top.map((c) => c.theme);

  const colorPalette = rankByFrequency(
    selectedThemes.map((t) => t.color_palette),
    6,
    (c) => String(c).toUpperCase()
  );
  const outfitSuggestions = rankByFrequency(selectedThemes.map((t) => t.outfit_suggestions), 8);
  const propSuggestions = rankByFrequency(selectedThemes.map((t) => t.prop_suggestions), 8);
  const tags = rankByFrequency(selectedThemes.map((t) => t.tags), 10);

  const lightingStyle = mostCommon(selectedThemes.map((t) => t.lighting_style));
  const editingStyle = mostCommon(selectedThemes.map((t) => t.editing_style));
  const photographyStyle = mostCommon(selectedThemes.map((t) => t.photography_style));
  const mood = mostCommon(selectedThemes.map((t) => t.mood));
  const locationType = mostCommon(selectedThemes.map((t) => t.location_type));

  const sourceThemeNames = [...new Set(top.map((c) => c.themeName).filter(Boolean))];

  return {
    moodBoard: {
      id: `mb-${prefs.eventType.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`,
      name: `Your ${prefs.eventType} Mood Board`,
      description: buildDescription(prefs, top.length),
      event_type: prefs.eventType,
      is_personalized: true,
      source_theme_names: sourceThemeNames,
      inspiration_images: top.map((c) => ({
        id: c.id,
        url: c.url,
        caption: c.caption,
        themeName: c.themeName,
        score: c.score,
        matched: c.matched,
      })),
      color_palette: colorPalette,
      outfit_suggestions: outfitSuggestions,
      prop_suggestions: propSuggestions,
      tags,
      mood,
      photography_style: photographyStyle,
      location_type: locationType,
      lighting_style: lightingStyle,
      editing_style: editingStyle,
      additional_notes: "",
    },
    scoreSummary: {
      totalCandidates: candidates.length,
      selectedCount: top.length,
      weights: SCORE_WEIGHTS,
      items: top.map((c) => ({
        id: c.id,
        themeName: c.themeName,
        score: c.score,
        matched: c.matched,
      })),
    },
  };
}
