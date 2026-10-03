/** Approximate English color names from hex — for mood board palette labels. */

const NAMED = [
  ["#000000", "Black"],
  ["#FFFFFF", "White"],
  ["#F5F5F5", "Off White"],
  ["#FAF0E6", "Linen"],
  ["#F5F5DC", "Beige"],
  ["#E8D5C4", "Warm Sand"],
  ["#D2B48C", "Tan"],
  ["#C4A484", "Camel"],
  ["#8B7355", "Taupe"],
  ["#5B4636", "Espresso"],
  ["#3D2914", "Dark Brown"],
  ["#A98B75", "Mocha"],
  ["#C9A86A", "Gold"],
  ["#D4AF37", "Antique Gold"],
  ["#B8860B", "Dark Goldenrod"],
  ["#808080", "Gray"],
  ["#A9A9A9", "Dark Gray"],
  ["#D3D3D3", "Light Gray"],
  ["#708090", "Slate Gray"],
  ["#2F4F4F", "Dark Slate"],
  ["#000080", "Navy"],
  ["#191970", "Midnight Blue"],
  ["#4169E1", "Royal Blue"],
  ["#87CEEB", "Sky Blue"],
  ["#ADD8E6", "Light Blue"],
  ["#B0C4DE", "Dusty Blue"],
  ["#5F9EA0", "Cadet Blue"],
  ["#008080", "Teal"],
  ["#2E8B57", "Sea Green"],
  ["#556B2F", "Olive"],
  ["#808000", "Olive Drab"],
  ["#9CAF88", "Sage"],
  ["#90EE90", "Light Green"],
  ["#228B22", "Forest Green"],
  ["#006400", "Dark Green"],
  ["#FFD700", "Gold Yellow"],
  ["#FFA500", "Orange"],
  ["#FF7F50", "Coral"],
  ["#E9967A", "Dusty Rose"],
  ["#FFC0CB", "Pink"],
  ["#FF69B4", "Hot Pink"],
  ["#C71585", "Magenta"],
  ["#800020", "Burgundy"],
  ["#8B0000", "Dark Red"],
  ["#DC143C", "Crimson"],
  ["#A52A2A", "Brown Red"],
  ["#D2691E", "Chocolate"],
  ["#F4A460", "Sandy Brown"],
  ["#FFF8DC", "Cornsilk"],
  ["#FAEBD7", "Antique White"],
  ["#FFE4C4", "Bisque"],
  ["#DEB887", "Burlywood"],
  ["#F0E68C", "Khaki"],
  ["#E6E6FA", "Lavender"],
  ["#DDA0DD", "Plum"],
  ["#4B0082", "Indigo"],
  ["#483D8B", "Dark Slate Blue"],
];

function parseHex(raw) {
  let h = String(raw || "").trim().toUpperCase();
  if (!h) return null;
  if (!h.startsWith("#")) h = `#${h}`;
  if (h.length === 4) {
    h = `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
  }
  if (!/^#[0-9A-F]{6}$/.test(h)) return null;
  return h;
}

function hexToRgb(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

function dist(a, b) {
  return (a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2;
}

/** Return a human color name for a hex (exact or nearest named color). */
export function colorNameFromHex(hex) {
  const parsed = parseHex(hex);
  if (!parsed) return "Custom";
  const exact = NAMED.find(([h]) => h === parsed);
  if (exact) return exact[1];

  const rgb = hexToRgb(parsed);
  let best = NAMED[0];
  let bestD = Infinity;
  for (const entry of NAMED) {
    const d = dist(rgb, hexToRgb(entry[0]));
    if (d < bestD) {
      bestD = d;
      best = entry;
    }
  }
  return best[1];
}

export function paletteWithNames(colors = []) {
  return (colors || [])
    .map((c) => {
      if (c && typeof c === "object" && c.hex) {
        return { hex: parseHex(c.hex) || c.hex, name: c.name || colorNameFromHex(c.hex) };
      }
      const hex = parseHex(c);
      if (!hex) return null;
      return { hex, name: colorNameFromHex(hex) };
    })
    .filter(Boolean);
}

export const OUTFIT_CATEGORIES = [
  "Dress",
  "Suit",
  "Casual",
  "Formal",
  "Traditional",
  "Accessories",
  "Footwear",
  "Other",
];

export const PROP_CATEGORIES = [
  "Floral",
  "Furniture",
  "Lighting",
  "Decor",
  "Backdrop",
  "Tableware",
  "Signage",
  "Other",
];
