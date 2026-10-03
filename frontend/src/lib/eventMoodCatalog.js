/**
 * Outfit / prop stock: each label is paired with a verified item-only Unsplash photo.
 * (No people in frame; caption always matches the image.)
 */

const u = (id, w = 640) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80&fm=jpg`;

const EVENT_STOCK = {
  Wedding: {
    outfits: [
      { label: "White bridal gown", id: "photo-1594552072238-b8a33785b261" },
      { label: "Ivory crystal heels", id: "photo-1518049362265-d5b2a6467637" },
      { label: "Folded dress shirts", id: "photo-1602810318383-e386cc2a3ccf" },
      { label: "Soft knit layer", id: "photo-1434389677669-e08b4cac3105" },
    ],
    props: [
      { label: "Peony bouquet", id: "photo-1563241527-3004b7be0ffd" },
      { label: "Gold wedding rings", id: "photo-1606800052052-a08af7148866" },
      { label: "Pearl necklace set", id: "photo-1515562141207-7a88fb7ce338" },
      { label: "Formal table setting", id: "photo-1519225421980-715cb0215aed" },
    ],
  },
  Birthday: {
    outfits: [
      { label: "Colorful tee rack", id: "photo-1489987707025-afc232f7ea0f" },
      { label: "Soft knit layer", id: "photo-1434389677669-e08b4cac3105" },
      { label: "White sweatshirt set", id: "photo-1620799140408-edc6dcb6d633" },
      { label: "Red statement handbag", id: "photo-1584917865442-de89df76afd3" },
    ],
    props: [
      { label: "Chocolate drip cake", id: "photo-1578985545062-69928b1d9587" },
      { label: "Heart balloon bunch", id: "photo-1530103862676-de8c9debad1d" },
      { label: "Pink gift box", id: "photo-1549465220-1a8b9238cd48" },
      { label: "Polaroid camera", id: "photo-1526170375885-4d8ecf77b99f" },
    ],
  },
  Debut: {
    outfits: [
      { label: "White ball gown", id: "photo-1594552072238-b8a33785b261" },
      { label: "Ivory crystal heels", id: "photo-1518049362265-d5b2a6467637" },
      { label: "Red leather handbag", id: "photo-1584917865442-de89df76afd3" },
      { label: "Soft knit layer", id: "photo-1434389677669-e08b4cac3105" },
    ],
    props: [
      { label: "Peony bouquet", id: "photo-1563241527-3004b7be0ffd" },
      { label: "Pearl necklace set", id: "photo-1515562141207-7a88fb7ce338" },
      { label: "Gold rings", id: "photo-1606800052052-a08af7148866" },
      { label: "Formal table setting", id: "photo-1519225421980-715cb0215aed" },
    ],
  },
  Graduation: {
    outfits: [
      { label: "Folded dress shirts", id: "photo-1602810318383-e386cc2a3ccf" },
      { label: "White sweatshirt set", id: "photo-1620799140408-edc6dcb6d633" },
      { label: "Soft knit layer", id: "photo-1434389677669-e08b4cac3105" },
      { label: "Cream graphic tee", id: "photo-1576566588028-4147f3842f27" },
    ],
    props: [
      { label: "Celebration balloons", id: "photo-1530103862676-de8c9debad1d" },
      { label: "Peony bouquet", id: "photo-1563241527-3004b7be0ffd" },
      { label: "Spiral notebooks", id: "photo-1531346878377-a5be20888e57" },
      { label: "Polaroid camera", id: "photo-1526170375885-4d8ecf77b99f" },
    ],
  },
  Christening: {
    outfits: [
      { label: "Soft knit layer", id: "photo-1434389677669-e08b4cac3105" },
      { label: "White sweatshirt set", id: "photo-1620799140408-edc6dcb6d633" },
      { label: "Folded dress shirts", id: "photo-1602810318383-e386cc2a3ccf" },
      { label: "Ivory crystal heels", id: "photo-1518049362265-d5b2a6467637" },
    ],
    props: [
      { label: "Peony bouquet", id: "photo-1563241527-3004b7be0ffd" },
      { label: "Pearl necklace set", id: "photo-1515562141207-7a88fb7ce338" },
      { label: "Pink gift box", id: "photo-1549465220-1a8b9238cd48" },
      { label: "Storybook stack", id: "photo-1544947950-fa07a98d237f" },
    ],
  },
  Family: {
    outfits: [
      { label: "Colorful tee rack", id: "photo-1489987707025-afc232f7ea0f" },
      { label: "Soft knit layer", id: "photo-1434389677669-e08b4cac3105" },
      { label: "White sweatshirt set", id: "photo-1620799140408-edc6dcb6d633" },
      { label: "Cream graphic tee", id: "photo-1576566588028-4147f3842f27" },
    ],
    props: [
      { label: "Wooden toys", id: "photo-1587654780291-39c9404d746b" },
      { label: "Polaroid camera", id: "photo-1526170375885-4d8ecf77b99f" },
      { label: "Storybook stack", id: "photo-1544947950-fa07a98d237f" },
      { label: "Travel backpack", id: "photo-1553062407-98eeb64c6a62" },
    ],
  },
  Corporate: {
    outfits: [
      { label: "Folded dress shirts", id: "photo-1602810318383-e386cc2a3ccf" },
      { label: "White sweatshirt set", id: "photo-1620799140408-edc6dcb6d633" },
      { label: "Soft knit layer", id: "photo-1434389677669-e08b4cac3105" },
      { label: "Red leather handbag", id: "photo-1584917865442-de89df76afd3" },
    ],
    props: [
      { label: "Laptop on desk", id: "photo-1496181133206-80ce9b88a853" },
      { label: "Espresso coffee set", id: "photo-1511920170033-f8396924c348" },
      { label: "Spiral notebooks", id: "photo-1531346878377-a5be20888e57" },
      { label: "Polaroid camera", id: "photo-1526170375885-4d8ecf77b99f" },
    ],
  },
  "Casual Portrait": {
    outfits: [
      { label: "White sweatshirt set", id: "photo-1620799140408-edc6dcb6d633" },
      { label: "Soft knit layer", id: "photo-1434389677669-e08b4cac3105" },
      { label: "Colorful tee rack", id: "photo-1489987707025-afc232f7ea0f" },
      { label: "Cream graphic tee", id: "photo-1576566588028-4147f3842f27" },
    ],
    props: [
      { label: "Round sunglasses", id: "photo-1511499767150-a48a237f0083" },
      { label: "Grey baseball cap", id: "photo-1521369909029-2afed882baee" },
      { label: "Espresso coffee set", id: "photo-1511920170033-f8396924c348" },
      { label: "Polaroid camera", id: "photo-1526170375885-4d8ecf77b99f" },
    ],
  },
  "Formal Portrait": {
    outfits: [
      { label: "Folded dress shirts", id: "photo-1602810318383-e386cc2a3ccf" },
      { label: "White bridal gown", id: "photo-1594552072238-b8a33785b261" },
      { label: "Ivory crystal heels", id: "photo-1518049362265-d5b2a6467637" },
      { label: "Red leather handbag", id: "photo-1584917865442-de89df76afd3" },
    ],
    props: [
      { label: "Pearl necklace set", id: "photo-1515562141207-7a88fb7ce338" },
      { label: "Gold wedding rings", id: "photo-1606800052052-a08af7148866" },
      { label: "Signature perfume", id: "photo-1541643600914-78b084683601" },
      { label: "Spiral notebooks", id: "photo-1531346878377-a5be20888e57" },
    ],
  },
};

function stockFor(eventType) {
  return EVENT_STOCK[eventType] || EVENT_STOCK.Wedding;
}

export function getEventMoodCatalog(eventType) {
  const stock = stockFor(eventType);
  return {
    outfits: stock.outfits.map((x) => x.label),
    props: stock.props.map((x) => x.label),
  };
}

export const EVENT_MOOD_CATALOG = Object.fromEntries(
  Object.keys(EVENT_STOCK).map((key) => [key, getEventMoodCatalog(key)])
);

export function isBrokenStockUrl(url) {
  if (!url || typeof url !== "string") return true;
  const lower = url.toLowerCase();
  return (
    lower.includes("pollinations.ai") ||
    lower.includes("placehold") ||
    lower.includes("via.placeholder") ||
    lower.startsWith("data:text")
  );
}

export function stockImageUrl(_label, { kind = "outfit", index = 0, eventType = "Wedding", width = 640 } = {}) {
  const stock = stockFor(eventType);
  const list = kind === "prop" ? stock.props : stock.outfits;
  const entry = list[index % list.length];
  return u(entry.id, width);
}

export function stockFallbackUrl(label, { kind = "outfit", index = 0 } = {}) {
  const seed = `${kind}-${index}-${label || kind}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 64);
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/640/800`;
}

/** Always builds exactly `limit` cutouts — label and image stay paired. */
export function buildStockCutouts(_labels, kind, limit = 4, eventType = "Wedding") {
  const stock = stockFor(eventType);
  const list = kind === "prop" ? stock.props : stock.outfits;

  return list.slice(0, limit).map((entry, i) => ({
    id: `stock-${kind}-${i}`,
    url: u(entry.id, 720),
    fallbackUrl: stockFallbackUrl(entry.label, { kind, index: i }),
    label: entry.label,
    category: kind === "outfit" ? "Outfit" : "Prop",
    themeName: "Auto suggestion",
    source: "stock",
  }));
}
