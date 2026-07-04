import { supabase } from "../lib/supabase";
import { FALLBACK_MOOD_BOARD_CATEGORIES } from "../lib/moodBoardOptions";

const CATEGORY_TYPES = ["theme", "mood", "location_type", "photography_style"];

export function emptyGroupedCategories() {
  return {
    theme: [],
    mood: [],
    location_type: [],
    photography_style: [],
  };
}

export function groupCategoryRows(rows) {
  const grouped = emptyGroupedCategories();
  for (const row of rows || []) {
    if (grouped[row.category_type]) grouped[row.category_type].push(row);
  }
  return grouped;
}

/** Label lists per type, with fallbacks when the database is empty or unavailable. */
export function groupedLabelsWithFallback(grouped) {
  const labels = emptyGroupedCategories();
  for (const type of CATEGORY_TYPES) {
    const fromDb = (grouped[type] || []).map((r) => r.label).filter(Boolean);
    labels[type] = fromDb.length ? fromDb : [...FALLBACK_MOOD_BOARD_CATEGORIES[type]];
  }
  return labels;
}

export async function getMoodBoardCategories() {
  const { data, error } = await supabase
    .from("mood_board_categories")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function getMoodBoardCategoryLabels() {
  const rows = await getMoodBoardCategories();
  return groupedLabelsWithFallback(groupCategoryRows(rows));
}

export async function addMoodBoardCategory(categoryType, label) {
  const clean = String(label || "").trim();
  if (!clean) throw new Error("Label is required.");
  if (!CATEGORY_TYPES.includes(categoryType)) throw new Error("Invalid category type.");

  const existing = await getMoodBoardCategories();
  const duplicate = existing.some(
    (r) => r.category_type === categoryType && r.label.toLowerCase() === clean.toLowerCase()
  );
  if (duplicate) throw new Error(`"${clean}" already exists in this category.`);

  const maxOrder = existing
    .filter((r) => r.category_type === categoryType)
    .reduce((max, r) => Math.max(max, r.sort_order || 0), 0);

  const { data, error } = await supabase
    .from("mood_board_categories")
    .insert({ category_type: categoryType, label: clean, sort_order: maxOrder + 1 })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMoodBoardCategory(id) {
  const { error } = await supabase.from("mood_board_categories").delete().eq("id", id);
  if (error) throw error;
}

export const MOOD_BOARD_CATEGORY_META = {
  theme: { title: "Theme", addPlaceholder: "e.g. Bohemian" },
  mood: { title: "Mood", addPlaceholder: "e.g. Serene" },
  location_type: { title: "Location Type", addPlaceholder: "e.g. Studio" },
  photography_style: { title: "Photography Style", addPlaceholder: "e.g. Documentary" },
};

export function normCategory(value) {
  return String(value || "").toLowerCase().trim();
}

/** Pick the closest admin-defined label from a list of allowed options. */
export function pickFromCategoryList(raw, options) {
  if (!raw || !options?.length) return "";
  const n = normCategory(raw);
  const exact = options.find((o) => normCategory(o) === n);
  if (exact) return exact;
  return options.find((o) => n.includes(normCategory(o)) || normCategory(o).includes(n)) || "";
}

/** Try several hint strings against admin options (first match wins). */
export function pickFromCategoryHints(hints, options) {
  if (!options?.length) return "";
  for (const hint of hints) {
    const match = pickFromCategoryList(hint, options);
    if (match) return match;
  }
  return "";
}

/** Ensure category option lists are always populated (admin DB or fallback seed). */
export function normalizeCategoryOptions(input) {
  const fb = FALLBACK_MOOD_BOARD_CATEGORIES;
  return {
    theme: input?.theme?.length ? [...input.theme] : [...fb.theme],
    mood: input?.mood?.length ? [...input.mood] : [...fb.mood],
    location_type: input?.location_type?.length ? [...input.location_type] : [...fb.location_type],
    photography_style: input?.photography_style?.length ? [...input.photography_style] : [...fb.photography_style],
  };
}

/** Restrict AI output to admin-managed category labels only. */
export function clampSuggestionsToCategories(suggestions, categoryOptions) {
  if (!suggestions) return suggestions;
  const opts = normalizeCategoryOptions(categoryOptions);
  return {
    ...suggestions,
    theme: pickFromCategoryList(suggestions.theme, opts.theme),
    mood: pickFromCategoryList(suggestions.mood, opts.mood),
    location_type: pickFromCategoryList(suggestions.location_type, opts.location_type),
    photography_style: pickFromCategoryList(suggestions.photography_style, opts.photography_style),
  };
}
