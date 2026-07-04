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
