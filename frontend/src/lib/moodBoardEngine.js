import { asStringArray } from "../services/moodBoardThemes";
import { asCategoryValues } from "../services/moodBoardCategories";
import { filterThemesByEvent, themeMatchesEvent, normalizeEventType } from "./themeMatching";
import { getEventMoodCatalog } from "./eventMoodCatalog";

/**
 * Mood Board recommendation engine.
 *
 * Treats every inspiration image as a scoreable candidate that inherits its
 * parent theme's metadata (event type, theme name/tags, mood, location, style,
 * color palette, and recommendations). It filters by event type, scores each
 * image against the client's optional preferences, ranks by relevance, selects
 * the top matches, and derives recommendations from the winning images (default 8 for collage).
 *
 * CRITICAL: photos + outfit/prop cutouts never cross event types
 * (e.g. graduation togas must not appear on a wedding board).
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

export const DEFAULT_TOP_N = 8;

/** Keywords that must NOT appear on cutouts/photos when building another event's board. */
const FOREIGN_EVENT_MARKERS = {
  Graduation: [/graduat/i, /\btoga\b/i, /mortarboard/i, /cap and gown/i, /class of/i, /\bstole\b/i, /commencement/i, /diploma folder/i],
  Wedding: [/wedding/i, /bridal/i, /\bbride\b/i, /\bgroom\b/i, /\bveil\b/i, /engagement/i, /bouquet bridal/i],
  Birthday: [/birthday/i, /\bcake\b/i, /balloon/i, /\bbday\b/i],
  Debut: [/\bdebut\b/i, /debutante/i, /eighteen/i, /18th/i],
  Christening: [/christen/i, /baptism/i],
  Family: [/maternity/i, /newborn/i],
  Corporate: [/headshot/i, /corporate/i, /office/i],
};

/** Captions that almost never belong on a photography mood board for sessions. */
const GENERIC_NOISE = [
  /christmas/i,
  /reindeer/i,
  /\bsanta\b/i,
  /\bxmas\b/i,
  /halloween/i,
  /cosplay/i,
  /anime/i,
];

function foreignMarkersForEvent(eventType) {
  const canonical = normalizeEventType(eventType) || eventType;
  // All other events' markers are "foreign"
  return Object.entries(FOREIGN_EVENT_MARKERS)
    .filter(([key]) => key !== canonical)
    .flatMap(([, patterns]) => patterns);
}

function textBlob(...parts) {
  return parts.filter(Boolean).join(" ").toLowerCase();
}

/** True if cutout/image text clearly belongs to a different event. */
function looksLikeForeignEvent(eventType, ...textParts) {
  const blob = textBlob(...textParts);
  if (!blob) return false;
  return foreignMarkersForEvent(eventType).some((re) => re.test(blob));
}

function cutoutAllowedForEvent(eventType, theme, img) {
  if (!themeMatchesEvent(theme, eventType)) return false;
  if (
    looksLikeForeignEvent(
      eventType,
      img?.label,
      img?.category,
      img?.caption,
      theme?.name,
      ...(asStringArray(theme?.tags) || [])
    )
  ) {
    return false;
  }
  return true;
}

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
 * Pick exactly `topN` images from the SAME event type only.
 * Never pads with other events (wedding boards must not get graduation photos).
 */
function selectExactTop(themes, prefs, topN) {
  const primary = buildCandidateImages(themes, prefs.eventType)
    .filter((c) => themeMatchesEvent(c.theme, prefs.eventType))
    .filter(
      (c) =>
        !looksLikeForeignEvent(
          prefs.eventType,
          c.caption,
          c.themeName,
          ...(asStringArray(c.theme?.tags) || [])
        )
    )
    .filter((c) => !GENERIC_NOISE.some((re) => re.test(textBlob(c.caption, c.themeName))))
    .map((candidate) => scoreCandidate(candidate, prefs))
    .sort((a, b) => b.score - a.score || a.order - b.order);

  const selected = [];
  const seen = new Set();
  const themeCounts = new Map();
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

  take(primary, { respectThemeCap: true });
  if (selected.length < topN) take(primary, { respectThemeCap: false });

  return {
    selected,
    primaryCount: primary.length,
    totalLibrary: primary.length,
  };
}

/**
 * Generate a personalized mood board.
 * With `allowStockFallback`, short libraries still succeed — stock enrichment
 * fills outfits, props, backgrounds, and missing collage photos.
 * @returns {{ moodBoard, scoreSummary } | { error }}
 */
export function generateMoodBoard(themes, prefs, { topN = DEFAULT_TOP_N, allowStockFallback = false } = {}) {
  if (!prefs?.eventType) {
    return { error: "Please select your event type first." };
  }

  const catalog = getEventMoodCatalog(prefs.eventType);
  const { selected: top, primaryCount, totalLibrary } = selectExactTop(themes, prefs, topN);

  if (!primaryCount && !allowStockFallback) {
    return {
      error: `No inspiration images are available for ${prefs.eventType} yet. Please try another event type or contact the studio.`,
    };
  }

  if (top.length < topN && !allowStockFallback) {
    return {
      error: `A ${prefs.eventType} mood board needs ${topN} photos from ${prefs.eventType} themes, but only ${primaryCount} matching image${primaryCount === 1 ? " is" : "s are"} available. Ask the studio to upload more ${prefs.eventType} inspiration photos (other event types are not mixed in).`,
    };
  }

  // Only same-event themes — never pull graduation cutouts into a wedding board
  const eventThemes = filterThemesByEvent(themes, prefs.eventType);
  const selectedThemes = top
    .map((c) => c.theme)
    .filter((t) => t && themeMatchesEvent(t, prefs.eventType));

  // Main theme = most frequent among winning photos (must be event-matched)
  const mainThemeId = mostCommon(top.map((c) => c.themeId));
  const mainTheme =
    selectedThemes.find((t) => t?.id === mainThemeId) ||
    selectedThemes[0] ||
    eventThemes[0] ||
    null;
  const secondaryThemes = selectedThemes.filter((t) => t && t.id !== mainTheme?.id);

  const colorPalette = rankByFrequency(
    [
      ...(mainTheme ? [mainTheme.color_palette] : []),
      ...secondaryThemes.map((t) => t.color_palette),
    ],
    5,
    (c) => String(c).toUpperCase()
  );
  let outfitSuggestions = rankByFrequency(
    [
      ...(mainTheme ? [mainTheme.outfit_suggestions] : []),
      ...secondaryThemes.map((t) => t.outfit_suggestions),
    ],
    8
  );
  let propSuggestions = rankByFrequency(
    [
      ...(mainTheme ? [mainTheme.prop_suggestions] : []),
      ...secondaryThemes.map((t) => t.prop_suggestions),
    ],
    8
  );
  if (!outfitSuggestions.length) outfitSuggestions = catalog.outfits.slice(0, 4);
  if (!propSuggestions.length) propSuggestions = catalog.props.slice(0, 4);
  const tags = rankByFrequency(
    [
      ...(mainTheme ? [mainTheme.tags] : []),
      ...secondaryThemes.map((t) => t.tags),
    ],
    10
  );

  // Outfits/props: main theme first, then other SAME-EVENT themes only
  const outfitImages = [];
  const propImages = [];
  const seenCut = new Set();
  const themeOrder = [mainTheme, ...secondaryThemes, ...eventThemes].filter(Boolean);
  const uniqueThemes = [];
  const seenTheme = new Set();
  for (const theme of themeOrder) {
    if (!theme?.id || seenTheme.has(theme.id)) continue;
    if (!themeMatchesEvent(theme, prefs.eventType)) continue;
    seenTheme.add(theme.id);
    uniqueThemes.push(theme);
  }

  for (const theme of uniqueThemes) {
    for (const img of theme.outfit_images || []) {
      if (!img?.url || seenCut.has(img.url)) continue;
      if (!cutoutAllowedForEvent(prefs.eventType, theme, img)) continue;
      seenCut.add(img.url);
      outfitImages.push({
        id: img.id || `outfit-${outfitImages.length}`,
        url: img.url,
        public_id: img.public_id,
        label: img.label || outfitSuggestions[outfitImages.length] || "Outfit",
        category: img.category || "Other",
        themeName: theme.name,
      });
    }
    for (const img of theme.prop_images || []) {
      if (!img?.url || seenCut.has(img.url)) continue;
      if (!cutoutAllowedForEvent(prefs.eventType, theme, img)) continue;
      seenCut.add(img.url);
      propImages.push({
        id: img.id || `prop-${propImages.length}`,
        url: img.url,
        public_id: img.public_id,
        label: img.label || propSuggestions[propImages.length] || "Prop",
        category: img.category || "Other",
        themeName: theme.name,
      });
    }
  }

  const lightingStyle =
    mainTheme?.lighting_style || mostCommon(selectedThemes.map((t) => t.lighting_style));
  const editingStyle =
    mainTheme?.editing_style || mostCommon(selectedThemes.map((t) => t.editing_style));
  const photographyStyle = rankByFrequency(
    [
      ...(mainTheme ? [asCategoryValues(mainTheme.photography_style)] : []),
      ...secondaryThemes.map((t) => asCategoryValues(t.photography_style)),
    ],
    4
  );
  const mood = rankByFrequency(
    [
      ...(mainTheme ? [asCategoryValues(mainTheme.mood)] : []),
      ...secondaryThemes.map((t) => asCategoryValues(t.mood)),
    ],
    4
  );
  const locationType =
    mainTheme?.location_type || mostCommon(selectedThemes.map((t) => t.location_type));

  const sourceThemeNames = [...new Set(top.map((c) => c.themeName).filter(Boolean))];
  const boardTitle = mainTheme?.name
    ? `${mainTheme.name}`
    : `Your ${prefs.eventType} Mood Board`;

  return {
    moodBoard: {
      id: `mb-${prefs.eventType.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`,
      name: boardTitle,
      description: buildDescription(prefs, top.length),
      event_type: prefs.eventType,
      is_personalized: true,
      main_theme_name: mainTheme?.name || sourceThemeNames[0] || "",
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
      outfit_images: outfitImages.slice(0, 4),
      prop_images: propImages.slice(0, 4),
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
      mainTheme: mainTheme?.name || null,
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
