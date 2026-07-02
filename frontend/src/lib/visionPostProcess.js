import {
  EVENT_TYPES,
  DEFAULT_THEMES,
  MOOD_OPTIONS,
  LOCATION_TYPES,
  PHOTOGRAPHY_STYLES,
} from "./moodBoardOptions";
import { normalizeEventType } from "./themeMatching";

const EVENT_SIGNALS = {
  Graduation: /\b(graduation|graduate|grad\b|diploma|cap and gown|mortarboard|tassel|commencement|stole|sash|class of|academic regalia|school)\b/i,
  Wedding: /\b(wedding|bride|groom|bridal|wedding dress|wedding gown|wedding veil|matrimony|wedding ceremony|wedding bouquet)\b/i,
  Birthday: /\b(birthday|birthday cake|balloons|party hat|happy birthday|cake candles|children.?s party)\b/i,
  Debut: /\b(debut|debutante|18th birthday|cotillion)\b/i,
  Christening: /\b(christening|baptism|baptismal|baptism gown)\b/i,
  Family: /\b(family portrait|family session|maternity|newborn|baby|parents|multi.?generational)\b/i,
  Corporate: /\b(corporate|business portrait|headshot|office|executive|professional headshot)\b/i,
};

const CONFIDENCE_WEIGHT = { high: 3, medium: 2, low: 1 };

const asArray = (v) => (Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : []);
const asText = (v) => (typeof v === "string" ? v.trim() : "");
const norm = (s) => s.toLowerCase().trim();

function pickFromList(raw, options) {
  if (!raw) return "";
  const n = norm(raw);
  const exact = options.find((o) => norm(o) === n);
  if (exact) return exact;
  return options.find((o) => n.includes(norm(o)) || norm(o).includes(n)) || "";
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
    const modelEvent = pickFromList(asText(img.event_type), EVENT_TYPES);
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
    const val = pickFromList(asText(img[key]), options);
    if (val) votes[val] = (votes[val] || 0) + 1;
  }
  const ranked = Object.entries(votes).sort((a, b) => b[1] - a[1]);
  return ranked[0]?.[0] || "";
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

/** Turn raw model JSON into validated, evidence-weighted suggestions. */
export function buildSuggestionsFromVision(parsed) {
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
    pickFromList(asText(merged.event_type), EVENT_TYPES);

  let theme = voteField(perImage, "theme", DEFAULT_THEMES) || pickFromList(asText(merged.theme), DEFAULT_THEMES);
  if (!theme || theme === "Classic") {
    const eventThemes = {
      Graduation: "Elegant",
      Wedding: "Elegant",
      Birthday: "Bright & Airy",
      Debut: "Luxury",
      Christening: "Bright & Airy",
      Family: "Garden",
      Corporate: "Modern",
      "Casual Portrait": "Bright & Airy",
      "Formal Portrait": "Elegant",
    };
    theme = event_type ? eventThemes[event_type] || "Elegant" : theme || "Elegant";
  }

  const mood =
    voteField(perImage, "mood", MOOD_OPTIONS) ||
    pickFromList(asText(merged.mood), MOOD_OPTIONS) ||
    "Soft & Natural";

  const tagSet = new Set();
  mergeUnique(perImage, "tags", 20).forEach((t) => tagSet.add(t.toLowerCase()));
  asArray(merged.tags).forEach((t) => tagSet.add(t.toLowerCase()));
  if (event_type) tagSet.add(event_type.toLowerCase());
  if (event_type !== "Wedding") ["wedding", "bridal", "bride", "groom"].forEach((w) => tagSet.delete(w));

  const colors = mergeColors(perImage);
  const outfits = mergeUnique(perImage, "outfit_suggestions", 6);
  const props = mergeUnique(perImage, "prop_suggestions", 6);

  return {
    theme,
    event_type,
    photography_style:
      voteField(perImage, "photography_style", PHOTOGRAPHY_STYLES) ||
      pickFromList(asText(merged.photography_style), PHOTOGRAPHY_STYLES) ||
      "Natural Light",
    mood,
    location_type:
      voteField(perImage, "location_type", LOCATION_TYPES) ||
      pickFromList(asText(merged.location_type), LOCATION_TYPES) ||
      "Indoor Studio",
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

export function buildVisionInstruction(imageCount) {
  return `Analyze ${imageCount} photo(s). For EACH image separately, then produce a merged result.

Return JSON:
{
  "per_image": [{
    "image_index": 0,
    "visual_cues": ["8-12 items: exact clothing, props, people, setting you SEE"],
    "event_type": "one of: ${EVENT_TYPES.join(", ")} or empty",
    "event_confidence": "high|medium|low",
    "theme": "one of: ${DEFAULT_THEMES.join(", ")}",
    "mood": "one of: ${MOOD_OPTIONS.join(", ")}",
    "photography_style": "one of: ${PHOTOGRAPHY_STYLES.join(", ")}",
    "location_type": "one of: ${LOCATION_TYPES.join(", ")}",
    "lighting_style": "",
    "editing_style": "",
    "color_palette": ["#hex"],
    "outfit_suggestions": [],
    "prop_suggestions": [],
    "tags": []
  }],
  "occasion_reasoning": "why merged event_type was chosen",
  "merged": { "theme": "", "event_type": "", "photography_style": "", "mood": "", "location_type": "", "lighting_style": "", "editing_style": "", "description": "", "color_palette": [], "outfit_suggestions": [], "prop_suggestions": [], "tags": [] }
}

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

List visual_cues BEFORE choosing event_type. If unsure use "" and event_confidence "low". Do NOT guess Wedding or Classic.`;
}
