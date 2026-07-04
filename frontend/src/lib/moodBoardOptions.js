// Shared option lists for the Mood Board Generator

export const EVENT_TYPES = [
  "Wedding",
  "Birthday",
  "Debut",
  "Graduation",
  "Christening",
  "Family",
  "Corporate",
  "Casual Portrait",
  "Formal Portrait",
];

export const DEFAULT_THEMES = [
  "Rustic",
  "Elegant",
  "Vintage",
  "Modern",
  "Minimalist",
  "Bohemian",
  "Garden",
  "Beach",
  "Nature",
  "Floral",
  "Studio Portrait",
  "Classic",
  "Luxury",
  "Bright & Airy",
  "Dark & Moody",
  "Cinematic",
];

export const MOOD_OPTIONS = [
  "Bright & Airy",
  "Dark & Moody",
  "Warm & Romantic",
  "Cool & Modern",
  "Bold & Dramatic",
  "Soft & Natural",
  "Vibrant & Playful",
];

export const LOCATION_TYPES = [
  "Indoor Studio",
  "Outdoor Garden",
  "Beach",
  "Urban / City",
  "Nature / Forest",
  "Home / Lifestyle",
  "Venue / Hall",
];

export const PHOTOGRAPHY_STYLES = [
  "Natural Light",
  "Studio Portrait",
  "Editorial / Fashion",
  "Candid Lifestyle",
  "Fine Art",
  "Documentary",
  "Cinematic",
];

/** Client dropdown options — static catalogs plus any extra names from admin themes. */
export function getClientThemeOptions(adminThemeNames = []) {
  const merged = new Set([...DEFAULT_THEMES, ...adminThemeNames.filter(Boolean)]);
  return [...merged].sort((a, b) => a.localeCompare(b));
}
