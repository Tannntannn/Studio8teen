import { asStringArray } from "../services/moodBoardThemes";
import { asCategoryValues } from "../services/moodBoardCategories";
import { filterThemesByEvent } from "./themeMatching";

/**
 * Mood Board recommendation engine.
 *
 * Treats every inspiration image as a scoreable candidate that inherits its
 * parent theme's metadata (event type, theme name/tags, mood, location, style,
 * color palette, and recommendations). It filters by event type, scores each
 * image against the client's optional preferences, ranks by relevance, selects
 * the top matches, and derives recommendations from the winning images (default 12 for collage).
 */

export const SCORE_WEIGHTS = {
  eventType: 20,
  exactEvent: 8,
  theme: 8,
  mood: 6,
  location: 5,
  photographyStyle: 5,
  captionHint: 2,
};

export const DEFAULT_TOP_N = 12;

function norm(value) {
  return String(value || "").toLowerCase().trim();
}

function textMatches(a, b) {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

/** Score each selected preference that appears on the theme (partial credit per match). */
function scoreMultiCategoryMatch(prefsValue, themeValue, weight, label) {
  const prefs = asCategoryValues(prefsValue);
  const themeVals = asCategoryValues(themeValue);
  if (!prefs.length || !themeVals.length) return { score: 0, matched: [] };

  const hits = prefs.filter((pref) => themeVals.some((tv) => textMatches(tv, pref)));
  return {
    score: hits.length * weight,
    matched: hits.map((h) => `${label}: ${h}`),
  };
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

function pushThemeImages(candidates, themes, { preferEventType = "" } = {}) {
  const list = Array.isArray(themes) ? themes : [];
  list.forEach((theme, themeIndex) => {
    (theme.inspiration_images || []).forEach((img, imgIndex) => {
      if (!img?.url) return;
      candidates.push({
        id: img.id || `${theme.id}-${imgIndex}`,
        url: img.url,
        caption: img.caption || "",
        themeId: theme.id,
        themeName: theme.name,
        theme,
        preferEventType: Boolean(preferEventType),
        // Stable tie-breaker: theme sort order, then upload order within a theme.
        order: (theme.sort_order || themeIndex) * 1000 + imgIndex,
      });
    });
  });
  return candidates;
}

/**
 * Build candidate images for an event type. Each image carries a reference to
 * its parent theme so it can be scored and used for recommendations.
 */
export function buildCandidateImages(themes, eventType) {
  return pushThemeImages([], filterThemesByEvent(themes, eventType), {
    preferEventType: eventType,
  });
}

/** All inspiration images across themes (used to pad to the target collage size). */
export function buildAllCandidateImages(themes) {
  return pushThemeImages([], themes);
}

/** Score a single candidate image against the client's preferences. */
export function scoreCandidate(candidate, prefs) {
  const theme = candidate.theme;
  let score = 0;
  const matched = [];

  // Event-type candidates already match the filter; exact theme.event_type gets a bonus.
  score += SCORE_WEIGHTS.eventType;
  matched.push("Event type");

  if (prefs.eventType && textMatches(theme.event_type, prefs.eventType)) {
    score += SCORE_WEIGHTS.exactEvent;
    matched.push("Exact event tag");
  }

  if (prefs.theme) {
    const themeTokens = [theme.name, ...asStringArray(theme.tags)];
    if (themeTokens.some((token) => textMatches(token, prefs.theme))) {
      score += SCORE_WEIGHTS.theme;
      matched.push("Theme");
    }
  }

  const moodMatch = scoreMultiCategoryMatch(prefs.mood, theme.mood, SCORE_WEIGHTS.mood, "Mood");
  score += moodMatch.score;
  matched.push(...moodMatch.matched);

  if (prefs.locationType && textMatches(theme.location_type, prefs.locationType)) {
    score += SCORE_WEIGHTS.location;
    matched.push("Location");
  }

  const styleMatch = scoreMultiCategoryMatch(
    prefs.photographyStyle,
    theme.photography_style,
    SCORE_WEIGHTS.photographyStyle,
    "Photography style"
  );
  score += styleMatch.score;
  matched.push(...styleMatch.matched);

  // Soft boost when caption/theme name echoes preferred theme or mood words
  const hintHay = `${candidate.caption || ""} ${candidate.themeName || ""}`.toLowerCase();
  const hintNeedles = [
    prefs.theme,
    ...asCategoryValues(prefs.mood),
    ...asCategoryValues(prefs.photographyStyle),
  ].filter(Boolean);
  if (hintNeedles.some((n) => hintHay.includes(norm(n)))) {
    score += SCORE_WEIGHTS.captionHint;
    matched.push("Caption/title hint");
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
  const moods = asCategoryValues(prefs.mood);
  if (moods.length) parts.push(`${moods.map((m) => m.toLowerCase()).join(" & ")} mood`);
  const styles = asCategoryValues(prefs.photographyStyle);
  if (styles.length) parts.push(`${styles.map((s) => s.toLowerCase()).join(" & ")} style`);
  if (prefs.locationType) parts.push(prefs.locationType.toLowerCase());
  const prefText = parts.length ? ` matched to your ${parts.join(", ")} preferences` : "";
  return `A curated ${prefs.eventType} mood board — the top ${selectedCount} inspiration ${selectedCount === 1 ? "image" : "images"}${prefText}.`;
}

/**
 * Pick exactly `topN` images: best matches for the event first, then pad from
 * the rest of the studio library so the collage always reaches the target count.
 * Prefers event-tagged images and diversifies across themes (max 3 per theme first pass).
 */
function selectExactTop(themes, prefs, topN) {
  const primary = buildCandidateImages(themes, prefs.eventType)
    .map((candidate) => scoreCandidate(candidate, prefs))
    .sort((a, b) => b.score - a.score || a.order - b.order);

  const selected = [];
  const seen = new Set();
  const themeCounts = new Map();
  const library = buildAllCandidateImages(themes);
  const maxPerTheme = Math.max(2, Math.ceil(topN / 3));

  const take = (list, { respectThemeCap = true } = {}) => {
    for (const item of list) {
      if (selected.length >= topN) break;
      const key = String(item.url || item.id);
      if (!key || seen.has(key)) continue;
      const tid = item.themeId || item.theme?.id || "unknown";
      const count = themeCounts.get(tid) || 0;
      if (respectThemeCap && count >= maxPerTheme) continue;
      seen.add(key);
      themeCounts.set(tid, count + 1);
      selected.push(item);
    }
  };

  // First: highest-scoring event matches with theme diversity
  take(primary, { respectThemeCap: true });
  // Second: more event matches without cap if still short
  if (selected.length < topN) take(primary, { respectThemeCap: false });

  if (selected.length < topN) {
    const selectedKeys = new Set(selected.map((c) => String(c.url || c.id)));
    const fillers = library
      .filter((c) => !selectedKeys.has(String(c.url || c.id)))
      .map((candidate) => {
        const scored = scoreCandidate(candidate, prefs);
        // Fillers outside the event lose the event bonus and get a penalty
        const offEvent = !textMatches(candidate.theme?.event_type, prefs.eventType);
        return {
          ...scored,
          score: Math.max(
            0,
            scored.score - SCORE_WEIGHTS.eventType - (offEvent ? 6 : 0)
          ),
          matched: scored.matched.filter((m) => m !== "Event type"),
        };
      })
      .sort((a, b) => b.score - a.score || a.order - b.order);
    take(fillers, { respectThemeCap: true });
    if (selected.length < topN) take(fillers, { respectThemeCap: false });
  }

  return { selected, primaryCount: primary.length, totalLibrary: library.length };
}

/**
 * Generate a personalized mood board.
 * Always returns exactly `topN` images (default 12), or an error if the studio
 * library does not have enough inspiration photos yet.
 * @returns {{ moodBoard, scoreSummary } | { error }}
 */
export function generateMoodBoard(themes, prefs, { topN = DEFAULT_TOP_N } = {}) {
  if (!prefs?.eventType) {
    return { error: "Please select your event type first." };
  }

  const { selected: top, primaryCount, totalLibrary } = selectExactTop(themes, prefs, topN);

  if (!primaryCount) {
    return {
      error: `No inspiration images are available for ${prefs.eventType} yet. Please try another event type or contact the studio.`,
    };
  }

  if (top.length < topN) {
    return {
      error: `A mood board needs ${topN} photos, but only ${totalLibrary} inspiration image${totalLibrary === 1 ? " is" : "s are"} in the studio library. Ask the studio to upload more Mood Board Themes.`,
    };
  }

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
  const photographyStyle = rankByFrequency(
    selectedThemes.map((t) => asCategoryValues(t.photography_style)),
    4
  );
  const mood = rankByFrequency(selectedThemes.map((t) => asCategoryValues(t.mood)), 4);
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
      totalCandidates: Math.max(primaryCount, totalLibrary),
      selectedCount: top.length,
      requiredCount: topN,
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
