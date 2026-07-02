import { asStringArray } from "../services/moodBoardThemes";
import { filterThemesByEvent } from "./themeMatching";

/**
 * Merge every active theme tagged for an event into one browsable mood board.
 * Used when the client skips picking a specific photography theme.
 */
export function mergeThemesForEvent(themes, eventType) {
  const matching = filterThemesByEvent(themes, eventType);
  if (!matching.length) return null;

  const images = [];
  const colors = new Set();
  const outfits = new Set();
  const props = new Set();
  const tags = new Set();
  const moods = new Set();
  const styles = new Set();
  const locations = new Set();
  const lighting = new Set();
  const editing = new Set();
  const notes = [];

  for (const theme of matching) {
    for (const img of theme.inspiration_images || []) {
      images.push({
        ...img,
        id: img.id || `${theme.id}-${img.url}`,
        themeName: theme.name,
      });
    }
    asStringArray(theme.color_palette).forEach((c) => colors.add(c.toUpperCase()));
    asStringArray(theme.outfit_suggestions).forEach((o) => outfits.add(o));
    asStringArray(theme.prop_suggestions).forEach((p) => props.add(p));
    asStringArray(theme.tags).forEach((t) => tags.add(t.toLowerCase()));
    if (theme.mood) moods.add(theme.mood);
    if (theme.photography_style) styles.add(theme.photography_style);
    if (theme.location_type) locations.add(theme.location_type);
    if (theme.lighting_style) lighting.add(theme.lighting_style);
    if (theme.editing_style) editing.add(theme.editing_style);
    if (theme.additional_notes?.trim()) notes.push(theme.additional_notes.trim());
  }

  const count = matching.length;
  const themeNames = matching.map((t) => t.name);

  return {
    id: `all-${eventType.toLowerCase().replace(/\s+/g, "-")}`,
    name: `All ${eventType} Inspiration`,
    description:
      `Browse every studio style for ${eventType} — ${images.length} inspiration photo${images.length !== 1 ? "s" : ""} ` +
      `from ${count} theme${count !== 1 ? "s" : ""}.`,
    event_type: eventType,
    is_aggregated: true,
    source_theme_count: count,
    source_theme_names: themeNames,
    inspiration_images: images,
    color_palette: [...colors],
    outfit_suggestions: [...outfits],
    prop_suggestions: [...props],
    tags: [...tags],
    mood: [...moods].join(" · "),
    photography_style: [...styles].join(" · "),
    location_type: [...locations].join(" · "),
    lighting_style: [...lighting].join(" "),
    editing_style: [...editing].join(" "),
    additional_notes: notes.join("\n\n"),
  };
}

export const ALL_THEMES_VALUE = "__all__";
