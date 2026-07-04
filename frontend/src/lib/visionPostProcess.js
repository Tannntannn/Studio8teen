import { EVENT_TYPES } from "./moodBoardOptions";
import { normalizeEventType } from "./themeMatching";
import {
  normalizeCategoryOptions,
  pickFromCategoryHints,
  pickFromCategoryList,
  asCategoryValues,
} from "../services/moodBoardCategories";

const EVENT_SIGNALS = {
  Graduation: /\b(graduation|graduate|grad\b|diploma|cap and gown|mortarboard|tassel|commencement|stole|sash|class of|academic regalia|school)\b/i,
  Wedding: /\b(wedding|bride|groom|bridal|wedding dress|wedding gown|wedding veil|matrimony|wedding ceremony|wedding bouquet)\b/i,
  Birthday: /\b(birthday|birthday cake|balloons|party hat|happy birthday|cake candles|children.?s party)\b/i,
  Debut: /\b(debut|debutante|18th birthday|cotillion)\b/i,
  Christening: /\b(christening|baptism|baptismal|baptism gown)\b/i,
  Family: /\b(family portrait|family session|maternity|newborn|baby|parents|multi.?generational)\b/i,
  Corporate: /\b(corporate|business portrait|headshot|office|executive|professional headshot)\b/i,
};

const EVENT_THEME_HINTS = {
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

const CONFIDENCE_WEIGHT = { high: 3, medium: 2, low: 1 };

const asArray = (v) => (Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : []);
const asText = (v) => (typeof v === "string" ? v.trim() : "");

function pickThemeForEvent(eventType, themes) {
  if (!eventType || !themes?.length) return "";
  return pickFromCategoryHints(EVENT_THEME_HINTS[eventType] || [], themes);
}

function scoreEvidence(text) {
  const scores = {};
  for (const [event, pattern] of Object.entries(EVENT_SIGNALS)) {
    const hits = text.match(new RegExp(pattern.source, "gi"));
    if (hits) scores[event] = hits.length * 4;
  }
  return scores;
}

function voteEvent(perImage, evidenceText) {
  const votes = {};
  const evidenceScores = scoreEvidence(evidenceText);

  for (const img of perImage) {
    const cues = asArray(img.visual_cues).join(" ");
    const cueScores = scoreEvidence(cues);
    const modelEvent = pickFromCategoryList(asText(img.event_type), EVENT_TYPES);
    const conf = CONFIDENCE_WEIGHT[asText(img.event_confidence)] || 1;

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

  if (votes.Graduation && !EVENT_SIGNALS.Wedding.test(evidenceText)) {
    votes.Graduation += 5;
    if (votes.Wedding) votes.Wedding = Math.max(0, votes.Wedding - 5);
  }

  const ranked = Object.entries(votes).sort((a, b) => b[1] - a[1]);
  const [winner, score] = ranked[0] || ["", 0];
  return score >= 4 ? winner : "";
}

function voteField(perImage, key, options) {
  const votes = {};
  for (const img of perImage) {
    const val = pickFromCategoryList(asText(img[key]), options);
    if (val) votes[val] = (votes[val] || 0) + 1;
  }
  const ranked = Object.entries(votes).sort((a, b) => b[1] - a[1]);
  return ranked[0]?.[0] || "";
}

function voteFieldMulti(perImage, key, options, limit = 3) {
  const votes = {};
  for (const img of perImage) {
    const raw = img[key];
    const candidates = Array.isArray(raw)
      ? raw.flatMap((v) => asCategoryValues(v))
      : asCategoryValues(raw);
    for (const candidate of candidates) {
      const val = pickFromCategoryList(candidate, options);
      if (val) votes[val] = (votes[val] || 0) + 1;
    }
  }
  return Object.entries(votes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value]) => value);
}

function mergeUnique(perImage, key, limit = 8) {
  const set = new Set();
  for (const img of perImage) {
    for (const item of asArray(img[key])) set.add(item);
  }
  return [...set].slice(0, limit);
}

function mergeColors(perImage) {
  const set = new Set();
  for (const img of perImage) {
    for (const c of asArray(img.color_palette)) {
      const hex = c.toUpperCase();
      if (/^#([0-9A-F]{6}|[0-9A-F]{3})$/.test(hex)) set.add(hex);
    }
  }
  return [...set].slice(0, 6);
}

function formatCategoryList(options) {
  if (!options?.length) return "(none configured — leave empty)";
  return options.join(", ");
}

/** Turn raw model JSON into validated suggestions using admin category lists only. */
export function buildSuggestionsFromVision(parsed, categoryOptions) {
  const opts = normalizeCategoryOptions(categoryOptions);
  const perImage = Array.isArray(parsed?.per_image)
    ? parsed.per_image
    : [{ visual_cues: parsed?.visual_cues, ...parsed }];
  const merged = parsed?.merged || parsed || {};
  const reasoning = asText(parsed?.occasion_reasoning);

  const allCues = perImage.flatMap((img) => asArray(img.visual_cues));
  const evidenceText = [reasoning, ...allCues, asText(merged.description)].join(" ").toLowerCase();

  const event_type =
    voteEvent(perImage, evidenceText) ||
    normalizeEventType(merged.event_type) ||
    pickFromCategoryList(asText(merged.event_type), EVENT_TYPES);

  let theme =
    voteField(perImage, "theme", opts.theme) ||
    pickFromCategoryList(asText(merged.theme), opts.theme);
  if (!theme && event_type) {
    theme = pickThemeForEvent(event_type, opts.theme);
  }

  const moodVotes = voteFieldMulti(perImage, "mood", opts.mood, 3);
  const mood = moodVotes.length
    ? moodVotes
    : asCategoryValues(merged.mood)
        .map((m) => pickFromCategoryList(m, opts.mood))
        .filter(Boolean)
        .filter((v, i, arr) => arr.indexOf(v) === i)
        .slice(0, 3);

  const tagSet = new Set();
  mergeUnique(perImage, "tags", 20).forEach((t) => tagSet.add(t.toLowerCase()));
  asArray(merged.tags).forEach((t) => tagSet.add(t.toLowerCase()));
  if (event_type) tagSet.add(event_type.toLowerCase());
  if (event_type !== "Wedding") ["wedding", "bridal", "bride", "groom"].forEach((w) => tagSet.delete(w));

  const colors = mergeColors(perImage);
  const outfits = mergeUnique(perImage, "outfit_suggestions", 6);
  const props = mergeUnique(perImage, "prop_suggestions", 6);

  const styleVotes = voteFieldMulti(perImage, "photography_style", opts.photography_style, 3);

  return {
    theme,
    event_type,
    photography_style: styleVotes.length
      ? styleVotes
      : asCategoryValues(merged.photography_style)
          .map((s) => pickFromCategoryList(s, opts.photography_style))
          .filter(Boolean)
          .filter((v, i, arr) => arr.indexOf(v) === i)
          .slice(0, 3),
    mood,
    location_type:
      voteField(perImage, "location_type", opts.location_type) ||
      pickFromCategoryList(asText(merged.location_type), opts.location_type),
    lighting_style: asText(merged.lighting_style) || asText(perImage[0]?.lighting_style),
    editing_style: asText(merged.editing_style) || asText(perImage[0]?.editing_style),
    description: asText(merged.description),
    color_palette: colors.length
      ? colors
      : asArray(merged.color_palette)
          .map((c) => c.toUpperCase())
          .filter((c) => /^#([0-9A-F]{6}|[0-9A-F]{3})$/.test(c)),
    outfit_suggestions: outfits.length ? outfits : asArray(merged.outfit_suggestions),
    prop_suggestions: props.length ? props : asArray(merged.prop_suggestions),
    tags: [...tagSet].slice(0, 10),
  };
}

export function buildVisionInstruction(imageCount, categoryOptions) {
  const opts = normalizeCategoryOptions(categoryOptions);
  return `Analyze ${imageCount} photo(s). For EACH image separately, then produce a merged result.

Return JSON:
{
  "per_image": [{
    "image_index": 0,
    "visual_cues": ["8-12 items: exact clothing, props, people, setting you SEE"],
    "event_type": "one of: ${EVENT_TYPES.join(", ")} or empty",
    "event_confidence": "high|medium|low",
    "theme": "MUST be exactly one of: ${formatCategoryList(opts.theme)} — or empty if unsure",
    "mood": ["one or more of: ${formatCategoryList(opts.mood)} — or [] if unsure"],
    "photography_style": ["one or more of: ${formatCategoryList(opts.photography_style)} — or [] if unsure"],
    "location_type": "MUST be exactly one of: ${formatCategoryList(opts.location_type)} — or empty if unsure",
    "lighting_style": "",
    "editing_style": "",
    "color_palette": ["#hex"],
    "outfit_suggestions": [],
    "prop_suggestions": [],
    "tags": []
  }],
  "occasion_reasoning": "why merged event_type was chosen",
  "merged": { "theme": "", "event_type": "", "photography_style": [], "mood": [], "location_type": "", "lighting_style": "", "editing_style": "", "description": "", "color_palette": [], "outfit_suggestions": [], "prop_suggestions": [], "tags": [] }
}

STRICT: theme and location_type use a single exact label. mood and photography_style must be JSON arrays using ONLY the exact labels listed above.

CLASSIFICATION RULES (strict):
• GRADUATION: cap/gown, mortarboard, tassel, stole, diploma — even if romantic couple
• WEDDING: wedding dress, veil, altar ceremony — NOT just couple or romantic pose
• BIRTHDAY: cake+candles, balloons, party hats
• DEBUT: Filipino debut/cotillion, formal 18th gown
• CHRISTENING: baptism, christening gown, baby at church
• FAMILY: parents+children, maternity, newborn
• CORPORATE: office, business headshot
• CASUAL PORTRAIT: everyday wear, no celebration props
• FORMAL PORTRAIT: studio pose, evening wear, no event props

List visual_cues BEFORE choosing event_type. If unsure use "" and event_confidence "low".`;
}

/** Shorter prompt for faster vision API responses (single image). */
export function buildFastVisionInstruction(imageCount = 1, categoryOptions) {
  const opts = normalizeCategoryOptions(categoryOptions);
  return `Analyze ${imageCount} photo(s). Return JSON only:
{
  "per_image":[{"visual_cues":["8 items max"],"event_type":"","event_confidence":"high|medium|low","theme":"","mood":[],"photography_style":[],"location_type":"","lighting_style":"","editing_style":"","color_palette":["#hex"],"outfit_suggestions":[],"prop_suggestions":[],"tags":[]}],
  "occasion_reasoning":"",
  "merged":{"theme":"","event_type":"","photography_style":[],"mood":[],"location_type":"","lighting_style":"","editing_style":"","description":"","color_palette":[],"outfit_suggestions":[],"prop_suggestions":[],"tags":[]}
}
event_type options: ${EVENT_TYPES.join(", ")}.
theme options (exact labels only): ${formatCategoryList(opts.theme)}.
mood options (array, exact labels only): ${formatCategoryList(opts.mood)}.
photography_style options (array, exact labels only): ${formatCategoryList(opts.photography_style)}.
location_type options (exact labels only): ${formatCategoryList(opts.location_type)}.
Graduation=caps/gowns. Wedding=wedding dress/veil only. List cues before event_type.`;
}
