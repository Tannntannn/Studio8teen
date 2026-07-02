import { supabase } from "../lib/supabase";

export async function getActiveThemes() {
  const { data, error } = await supabase
    .from("photography_themes")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function getAllThemes() {
  const { data, error } = await supabase
    .from("photography_themes")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function getThemeById(id) {
  const { data, error } = await supabase
    .from("photography_themes")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Theme not found");
  return data;
}

export async function createTheme(theme) {
  const { data, error } = await supabase
    .from("photography_themes")
    .insert({ ...theme, updated_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTheme(id, updates) {
  const { data, error } = await supabase
    .from("photography_themes")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTheme(id) {
  const { error } = await supabase.from("photography_themes").delete().eq("id", id);
  if (error) throw error;
}

export async function addThemeImage(themeId, image) {
  const theme = await getThemeById(themeId);
  const images = [...(theme.inspiration_images || []), image];
  return updateTheme(themeId, { inspiration_images: images });
}

export async function removeThemeImage(themeId, imageId) {
  const theme = await getThemeById(themeId);
  const images = (theme.inspiration_images || []).filter((img) => img.id !== imageId);
  return updateTheme(themeId, { inspiration_images: images });
}

/** Parse JSONB array fields safely */
export function asStringArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return [];
}

export function asColorArray(value) {
  return asStringArray(value);
}
