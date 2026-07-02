// Client-side image analysis for Mood Board theme suggestions.
// Uses a canvas to read pixel data, then derives palette + mood/style heuristics.
// Runs fully in the browser on the selected File (no external API required).

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function toHex(r, g, b) {
  const h = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h *= 60;
  }
  return { h, s, l };
}

function hueName(h) {
  if (h < 15 || h >= 345) return "red";
  if (h < 45) return "orange";
  if (h < 70) return "yellow";
  if (h < 165) return "green";
  if (h < 200) return "teal";
  if (h < 255) return "blue";
  if (h < 290) return "purple";
  if (h < 345) return "pink";
  return "neutral";
}

/** Extract a representative color palette + aggregate metrics from image data. */
function analyzePixels(data) {
  const buckets = new Map();
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let lumSum = 0;
  let lumSqSum = 0;
  let satSum = 0;
  let count = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 125) continue;

    count += 1;
    rSum += r;
    gSum += g;
    bSum += b;

    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    lumSum += lum;
    lumSqSum += lum * lum;

    const { s } = rgbToHsl(r, g, b);
    satSum += s;

    // Quantize to 4 bits per channel for palette bucketing
    const key = `${r >> 4}-${g >> 4}-${b >> 4}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      bucket.n += 1;
    } else {
      buckets.set(key, { r, g, b, n: 1 });
    }
  }

  if (!count) {
    return { palette: [], brightness: 0.5, saturation: 0.3, warmth: 0, greenness: 0, contrast: 0.3 };
  }

  const sorted = [...buckets.values()].sort((a, b) => b.n - a.n);
  const palette = [];
  for (const bucket of sorted) {
    const r = bucket.r / bucket.n;
    const g = bucket.g / bucket.n;
    const b = bucket.b / bucket.n;
    // Skip colors too similar to ones already chosen
    const tooClose = palette.some((p) => Math.abs(p.r - r) + Math.abs(p.g - g) + Math.abs(p.b - b) < 60);
    if (tooClose) continue;
    palette.push({ r, g, b });
    if (palette.length >= 5) break;
  }

  const brightness = lumSum / count / 255;
  const meanLum = lumSum / count;
  const variance = Math.max(0, lumSqSum / count - meanLum * meanLum);
  const contrast = Math.min(1, Math.sqrt(variance) / 128);
  const avgR = rSum / count;
  const avgG = gSum / count;
  const avgB = bSum / count;

  return {
    palette: palette.map((p) => toHex(p.r, p.g, p.b)),
    brightness,
    saturation: satSum / count,
    warmth: (avgR - avgB) / 255,
    greenness: (avgG - (avgR + avgB) / 2) / 255,
    contrast,
    dominant: palette[0] ? rgbToHsl(palette[0].r, palette[0].g, palette[0].b) : { h: 0, s: 0, l: 0.5 },
  };
}

function deriveSuggestions(m) {
  const { brightness, saturation, warmth, greenness, contrast, dominant } = m;

  // Mood
  let mood;
  if (brightness > 0.62 && saturation < 0.35) mood = "Bright & Airy";
  else if (brightness < 0.38) mood = "Dark & Moody";
  else if (contrast > 0.55) mood = "Bold & Dramatic";
  else if (warmth > 0.08) mood = "Warm & Romantic";
  else if (warmth < -0.04) mood = "Cool & Modern";
  else if (saturation > 0.5) mood = "Vibrant & Playful";
  else mood = "Soft & Natural";

  // Theme
  let theme;
  if (brightness > 0.62 && saturation < 0.35) theme = "Bright & Airy";
  else if (brightness < 0.38) theme = "Dark & Moody";
  else if (contrast > 0.55) theme = "Cinematic";
  else if (greenness > 0.06) theme = "Garden";
  else if (warmth > 0.12) theme = "Vintage";
  else if (saturation < 0.2) theme = "Minimalist";
  else if (warmth < -0.04) theme = "Modern";
  else theme = "Classic";

  // Location
  let location;
  if (greenness > 0.06) location = "Outdoor Garden";
  else if (dominant && dominant.h >= 165 && dominant.h < 255 && brightness > 0.55) location = "Beach";
  else if (brightness < 0.4 && saturation < 0.3) location = "Indoor Studio";
  else if (greenness > 0.02) location = "Nature / Forest";
  else location = "Indoor Studio";

  // Photography style
  let style;
  if (contrast > 0.55) style = "Editorial / Fashion";
  else if (brightness < 0.4) style = "Cinematic";
  else if (greenness > 0.04 || brightness > 0.6) style = "Natural Light";
  else style = "Studio Portrait";

  // Lighting
  let lighting;
  if (brightness > 0.62) lighting = "Soft, bright natural light with airy highlights.";
  else if (brightness < 0.38) lighting = "Low-key dramatic lighting with deep shadows.";
  else if (contrast > 0.55) lighting = "Directional key light with strong contrast.";
  else if (warmth > 0.08) lighting = "Warm golden-hour or tungsten-toned lighting.";
  else lighting = "Even, diffused lighting for a balanced look.";

  // Editing
  let editing;
  if (mood === "Bright & Airy") editing = "Light and airy edit, lifted shadows, soft pastel tones.";
  else if (mood === "Dark & Moody") editing = "Moody edit, rich shadows, desaturated cool tones.";
  else if (warmth > 0.08) editing = "Warm tones, creamy highlights, subtle film grain.";
  else if (contrast > 0.55) editing = "High-contrast edit, punchy colors, crisp detail.";
  else editing = "True-to-life colors with natural skin tones.";

  // Event type cannot be guessed from colors alone — leave empty for admin to set or use AI vision.
  const eventType = "";

  // Tags — describe tones only, not occasion (avoid misleading "romantic" → wedding confusion)
  const tagSet = new Set();
  tagSet.add(brightness > 0.6 ? "bright" : brightness < 0.4 ? "dark" : "balanced");
  tagSet.add(warmth > 0.06 ? "warm tones" : warmth < -0.04 ? "cool tones" : "neutral tones");
  if (saturation < 0.2) tagSet.add("muted");
  else if (saturation > 0.5) tagSet.add("vibrant");
  if (contrast > 0.55) tagSet.add("high contrast");
  if (greenness > 0.05) tagSet.add("greenery");
  if (dominant) tagSet.add(`${hueName(dominant.h)} accents`);
  tagSet.add(mood.toLowerCase().replace(/ & /g, " "));
  tagSet.add(theme.toLowerCase());

  return {
    mood,
    theme,
    location_type: location,
    photography_style: style,
    lighting_style: lighting,
    editing_style: editing,
    event_type: eventType,
    color_palette: m.palette,
    tags: [...tagSet],
  };
}

/** Analyze a single image File and return derived metrics. */
export async function analyzeImageFile(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const size = 120;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);
    return analyzePixels(data);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function mergeMetrics(list) {
  if (!list.length) return null;
  const avg = (key) => list.reduce((s, m) => s + m[key], 0) / list.length;
  const palette = [];
  for (const m of list) {
    for (const hex of m.palette) {
      if (!palette.includes(hex) && palette.length < 6) palette.push(hex);
    }
  }
  return {
    palette,
    brightness: avg("brightness"),
    saturation: avg("saturation"),
    warmth: avg("warmth"),
    greenness: avg("greenness"),
    contrast: avg("contrast"),
    dominant: list[0].dominant,
  };
}

/**
 * Analyze one or more image Files and return theme-field suggestions.
 * Returns null if analysis fails for all files.
 */
export async function analyzeImageFiles(files) {
  const metrics = [];
  for (const file of files) {
    try {
      metrics.push(await analyzeImageFile(file));
    } catch {
      /* skip unreadable image */
    }
  }
  const merged = mergeMetrics(metrics);
  if (!merged) return null;
  return deriveSuggestions(merged);
}

/** Analyze remote image URLs (e.g. after Cloudinary upload). Uses the most recent image. */
export async function analyzeImageUrls(urls) {
  const metrics = [];
  for (const url of (urls || []).filter(Boolean).slice(-1)) {
    try {
      const img = await loadImage(url);
      const size = 120;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, size, size);
      const { data } = ctx.getImageData(0, 0, size, size);
      metrics.push(analyzePixels(data));
    } catch {
      /* skip CORS or broken URL */
    }
  }
  const merged = mergeMetrics(metrics);
  if (!merged) return null;
  return deriveSuggestions(merged);
}
