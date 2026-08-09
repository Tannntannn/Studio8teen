import { getActiveThemes } from "./moodBoardThemes";
import { generateMoodBoard, buildAllCandidateImages } from "../lib/moodBoardEngine";
import { EVENT_TYPES } from "../lib/moodBoardOptions";
import { upsertMoodBoard, getMoodBoard } from "./gallery";
import { uploadToCloudinary, CLOUDINARY_FOLDERS } from "../lib/cloudinary";

function inferEventType(packageName = "", notes = "") {
  const hay = `${packageName} ${notes}`.toLowerCase();
  const hit = EVENT_TYPES.find((ev) => hay.includes(ev.toLowerCase()));
  return hit || "Casual Portrait";
}

/**
 * Generate a collage from studio themes and save it on the booking's mood_boards row.
 * Soft-fails (returns null) if the inspiration library is empty.
 */
export async function generateAndSaveBookingCollage(bookingId, clientId, { packageName, notes, eventType } = {}) {
  const themes = await getActiveThemes();
  const librarySize = buildAllCandidateImages(themes).length;
  if (!librarySize) return null;

  const prefs = {
    eventType: eventType || inferEventType(packageName, notes),
    theme: "",
    mood: [],
    locationType: "",
    photographyStyle: [],
  };

  let result = null;
  for (const topN of [12, 8, 5, 3, 1]) {
    if (topN > librarySize) continue;
    result = generateMoodBoard(themes, prefs, { topN });
    if (!result.error) break;
  }

  if (!result || result.error) {
    console.warn("Mood board collage skipped:", result?.error);
    return null;
  }

  const board = result.moodBoard;
  const collage = {
    name: board.name,
    description: board.description,
    event_type: board.event_type,
    images: board.inspiration_images || [],
    colors: board.color_palette || [],
    outfit_suggestions: board.outfit_suggestions || [],
    prop_suggestions: board.prop_suggestions || [],
    lighting_style: board.lighting_style || "",
    editing_style: board.editing_style || "",
    mood: board.mood || [],
    photography_style: board.photography_style || [],
    location_type: board.location_type || "",
    source_theme_names: board.source_theme_names || [],
    generated_at: new Date().toISOString(),
  };

  const existing = await getMoodBoard(bookingId);
  const items = existing?.items || [];

  return upsertMoodBoard(bookingId, clientId, items, collage);
}

export async function saveBookingCollage(bookingId, clientId, collage, items = []) {
  return upsertMoodBoard(bookingId, clientId, items, collage);
}

export async function uploadMoodBoardReference(bookingId, clientId, file) {
  const existing = await getMoodBoard(bookingId);
  const { url, publicId } = await uploadToCloudinary(file, CLOUDINARY_FOLDERS.moodBoard(bookingId));
  const item = {
    id: crypto.randomUUID(),
    url,
    publicId,
    caption: file.name || "Reference",
  };
  const items = [...(existing?.items || []), item];
  return upsertMoodBoard(bookingId, clientId, items, existing?.collage || null);
}

export async function removeMoodBoardReference(bookingId, clientId, itemId) {
  const existing = await getMoodBoard(bookingId);
  if (!existing) return null;
  const items = (existing.items || []).filter((i) => i.id !== itemId);
  return upsertMoodBoard(bookingId, clientId, items, existing.collage || null);
}
