import { getEventMoodCatalog, buildStockCutouts, isBrokenStockUrl } from "./eventMoodCatalog";

/**
 * Always provide exactly 4 outfit + 4 prop item photos with matching labels.
 * Uses paired catalog entries so image and name stay accurate.
 */
export function enrichMoodBoardWithStock(moodBoard, eventType) {
  if (!moodBoard) return moodBoard;

  const event = eventType || moodBoard.event_type || "Wedding";
  const catalog = getEventMoodCatalog(event);

  const outfitImages = buildStockCutouts(catalog.outfits, "outfit", 4, event);
  const propImages = buildStockCutouts(catalog.props, "prop", 4, event);

  const outfitCards = outfitImages.map((img, i) => ({
    id: img.id || `rec-outfit-${i}`,
    url: img.url,
    fallbackUrl: img.fallbackUrl,
    label: img.label,
    kind: "outfit",
    source: "stock",
  }));

  const propCards = propImages.map((img, i) => ({
    id: img.id || `rec-prop-${i}`,
    url: img.url,
    fallbackUrl: img.fallbackUrl,
    label: img.label,
    kind: "prop",
    source: "stock",
  }));

  const inspiration = (moodBoard.inspiration_images || []).filter(
    (img) =>
      img?.url &&
      img.source !== "stock" &&
      img.themeName !== "Atmosphere" &&
      !isBrokenStockUrl(img.url) &&
      !(Array.isArray(img.matched) && img.matched.includes("stock"))
  );

  return {
    ...moodBoard,
    outfit_suggestions: catalog.outfits,
    prop_suggestions: catalog.props,
    outfit_images: outfitImages,
    prop_images: propImages,
    outfit_cards: outfitCards,
    prop_cards: propCards,
    background_url: null,
    inspiration_images: inspiration,
    stock_enriched: true,
  };
}
