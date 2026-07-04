// Event types stay fixed; theme/mood/location/style are admin-managed in the database.

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

/** Used when the database has no rows yet (offline / migration not applied). */
export const FALLBACK_MOOD_BOARD_CATEGORIES = {
  theme: ["Minimalist", "Modern", "Vintage", "Cinematic", "Floral", "Luxury", "Elegant", "Nature"],
  mood: ["Romantic", "Joyful", "Formal", "Playful", "Cozy", "Dramatic", "Natural"],
  location_type: ["Indoor", "Garden", "Beach", "Church", "Outdoor", "Nature"],
  photography_style: ["Editorial", "Fine Art", "Aerial", "Close-up", "Portrait", "Candid", "Traditional"],
};

// Aliases for AI vision post-processing fallbacks
export const DEFAULT_THEMES = FALLBACK_MOOD_BOARD_CATEGORIES.theme;
export const MOOD_OPTIONS = FALLBACK_MOOD_BOARD_CATEGORIES.mood;
export const LOCATION_TYPES = FALLBACK_MOOD_BOARD_CATEGORIES.location_type;
export const PHOTOGRAPHY_STYLES = FALLBACK_MOOD_BOARD_CATEGORIES.photography_style;
