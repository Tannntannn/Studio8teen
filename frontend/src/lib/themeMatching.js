import { EVENT_TYPES } from "./moodBoardOptions";

/** Map loose labels (from AI or legacy data) to canonical event types. */
export const EVENT_ALIASES = {
  Wedding: ["wedding", "bridal", "bride", "groom", "engagement", "elopement", "matrimony", "nuptial"],
  Birthday: ["birthday", "party", "celebration", "kids", "kid", "children", "child", "cake", "balloons", "bday", "turning"],
  Debut: ["debut", "18th", "eighteen", "coming of age", "debutante"],
  Graduation: ["graduation", "graduate", "grad", "school", "cap and gown", "diploma", "commencement", "mortarboard", "tassel", "stole", "class of"],
  Christening: ["christening", "baptism", "baptismal", "naming ceremony", "christen"],
  Family: ["family", "maternity", "newborn", "baby", "parents", "siblings", "generational", "parenting"],
  Corporate: ["corporate", "business", "professional", "headshot", "office", "team", "company", "executive"],
  "Casual Portrait": ["casual", "lifestyle", "everyday", "solo portrait", "creative", "personal", "portrait"],
  "Formal Portrait": ["formal", "studio portrait", "elegant portrait", "posed portrait", "classic portrait"],
};

function norm(s) {
  return String(s || "").toLowerCase().trim();
}

function asStringArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  return [];
}

/** Normalize any label to a canonical EVENT_TYPES value, or "" if no match. */
export function normalizeEventType(value) {
  if (!value) return "";
  const n = norm(value);
  const exact = EVENT_TYPES.find((e) => norm(e) === n);
  if (exact) return exact;

  for (const event of EVENT_TYPES) {
    const aliases = EVENT_ALIASES[event] || [];
    if (aliases.some((a) => n === a || n.includes(a) || a.includes(n))) return event;
  }
  return "";
}

export function getThemeEventLabels(theme) {
  const labels = new Set();
  const primary = normalizeEventType(theme?.event_type);
  if (primary) labels.add(primary);
  asStringArray(theme?.event_types).forEach((e) => {
    const canonical = normalizeEventType(e) || e.trim();
    if (canonical) labels.add(canonical);
  });
  return [...labels];
}

function labelMatchesEvent(label, eventType) {
  const canonical = normalizeEventType(eventType) || eventType;
  const nl = norm(label);
  const nc = norm(canonical);
  if (!nl || !nc) return false;
  if (nl === nc) return true;

  const aliases = EVENT_ALIASES[canonical] || [];
  return aliases.some((a) => nl === a || nl.includes(a) || a.includes(nl));
}

/** True when a theme is tagged for the selected event type. */
export function themeMatchesEvent(theme, eventType) {
  if (!eventType) return true;

  const canonical = normalizeEventType(eventType);
  if (!canonical) return true;

  const labels = getThemeEventLabels(theme);
  if (!labels.length) return false;

  return labels.some((label) => labelMatchesEvent(label, canonical));
}

export function filterThemesByEvent(themes, eventType) {
  if (!eventType) return themes;
  return themes.filter((t) => themeMatchesEvent(t, eventType));
}
