import { useState } from "react";
import { getThumbnailUrl } from "../../lib/cloudinary";
import ImageLightbox from "../ui/ImageLightbox";
import { paletteWithNames } from "../../lib/colorNames";
import { getEventDesign } from "../../lib/eventDesigns";
import { stockFallbackUrl } from "../../lib/eventMoodCatalog";

/**
 * Flat-lay mood board:
 * - Polaroids clustered in the center (studio inspiration)
 * - 4 props (left) + 4 outfits (right) as labeled item cards
 * - No quote note card, no inside color swatches, no people wash
 */

const POLAROIDS = [
  { top: "16%", left: "27%", width: "20%", height: "28%", rotate: "-6deg", z: 9 },
  { top: "12%", left: "41%", width: "19%", height: "27%", rotate: "3deg", z: 11 },
  { top: "15%", left: "53%", width: "18%", height: "26%", rotate: "-4deg", z: 8 },
  { top: "40%", left: "26%", width: "19%", height: "27%", rotate: "5deg", z: 10 },
  { top: "38%", left: "40%", width: "20%", height: "28%", rotate: "-3deg", z: 12 },
  { top: "41%", left: "53%", width: "18%", height: "26%", rotate: "6deg", z: 9 },
  { top: "62%", left: "31%", width: "18%", height: "24%", rotate: "-5deg", z: 10 },
  { top: "60%", left: "47%", width: "18%", height: "24%", rotate: "4deg", z: 11 },
];

const ITEMS = [
  { top: "8%", left: "2.5%", width: "20%", height: "19%", rotate: "-7deg", z: 7, role: "prop" },
  { top: "29%", left: "1.5%", width: "21%", height: "19%", rotate: "5deg", z: 7, role: "prop" },
  { top: "50%", left: "2.5%", width: "20%", height: "18%", rotate: "-4deg", z: 7, role: "prop" },
  { top: "70%", left: "2%", width: "21%", height: "18%", rotate: "3deg", z: 7, role: "prop" },
  { top: "7%", left: "75%", width: "22%", height: "20%", rotate: "5deg", z: 7, role: "outfit" },
  { top: "29%", left: "76%", width: "21%", height: "19%", rotate: "-4deg", z: 7, role: "outfit" },
  { top: "50%", left: "75%", width: "22%", height: "19%", rotate: "3deg", z: 7, role: "outfit" },
  { top: "71%", left: "76%", width: "21%", height: "17%", rotate: "-3deg", z: 7, role: "outfit" },
];

function cleanPalette(colors) {
  const seen = new Set();
  return paletteWithNames(colors)
    .slice(0, 5)
    .filter((s) => {
      const key = s.name.toLowerCase().replace(/grey/g, "gray");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function shortHeadline(title, eventType) {
  const raw = String(title || eventType || "Mood Board").trim();
  return (
    raw
      .replace(/^your\s+/i, "")
      .replace(/\s+mood\s*board$/i, "")
      .trim()
      .toUpperCase() || "INSPIRATION"
  );
}

function thumb(url, w = 560, h = 700) {
  if (!url) return url;
  if (String(url).includes("cloudinary.com")) return getThumbnailUrl(url, w, h);
  return url;
}

function PolaroidFrame({ children, frameBg = "#fffcf7", foot = "16%" }) {
  return (
    <span
      className="block w-full h-full"
      style={{
        backgroundColor: frameBg,
        padding: `4.5% 4.5% ${foot} 4.5%`,
        boxShadow:
          "0 1px 1px rgba(255,255,255,0.9) inset, 0 18px 34px rgba(40,30,20,0.26), 0 3px 8px rgba(40,30,20,0.12)",
      }}
    >
      <span
        className="relative block w-full h-full overflow-hidden bg-[#d9d0c4]"
        style={{ boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.05)" }}
      >
        {children}
      </span>
    </span>
  );
}

function SafeImg({ url, fallbackUrl, alt, className, style, eager }) {
  const [src, setSrc] = useState(url);
  const [stage, setStage] = useState(0);

  if (!src || stage >= 2) {
    return (
      <span
        className={`flex items-center justify-center text-center p-2 ${className || ""}`}
        style={{ background: "linear-gradient(145deg, #efe8df, #f8f4ef)", ...style }}
      >
        <span className="text-[9px] font-medium text-[#5B4636]/70 leading-tight">{alt}</span>
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={alt || ""}
      className={className}
      style={style}
      loading={eager ? "eager" : "lazy"}
      draggable={false}
      onError={() => {
        if (stage === 0 && fallbackUrl) {
          setStage(1);
          setSrc(fallbackUrl);
        } else {
          setStage(2);
          setSrc(null);
        }
      }}
    />
  );
}

/** Labeled outfit / prop item card */
function ItemCard({ item, accent, index, frameBg }) {
  const label = item.label || (item.kind === "outfit" ? "Outfit" : "Prop");
  const isProp = item.kind === "prop";
  const [src, setSrc] = useState(thumb(item.url, 480, 560));
  const [stage, setStage] = useState(0);

  return (
    <div
      className="w-full h-full flex flex-col overflow-hidden"
      style={{
        backgroundColor: frameBg || "#fffcf8",
        borderRadius: isProp ? "1rem" : "0.35rem",
        boxShadow:
          "0 12px 24px rgba(40,30,20,0.2), 0 2px 5px rgba(40,30,20,0.1), inset 0 0 0 1px rgba(255,255,255,0.7)",
        padding: "5.5% 5.5% 0 5.5%",
      }}
    >
      <div
        className="relative flex-1 min-h-0 overflow-hidden bg-[#ebe4db]"
        style={{ borderRadius: isProp ? "0.7rem" : "0.15rem" }}
      >
        {src && stage < 2 ? (
          <img
            src={src}
            alt={label}
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
            draggable={false}
            onError={() => {
              if (stage === 0) {
                setStage(1);
                setSrc(
                  item.fallbackUrl ||
                    stockFallbackUrl(label, { kind: item.kind || "outfit", index })
                );
              } else {
                setStage(2);
                setSrc(null);
              }
            }}
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center p-2 text-center"
            style={{ background: `linear-gradient(145deg, ${accent}35, #f8f4ef)` }}
          >
            <span className="text-[9px] font-semibold text-[#5B4636]/85">{label}</span>
          </div>
        )}
        <span
          className="absolute top-1 left-1 text-[6px] uppercase tracking-[0.12em] font-bold px-1.5 py-0.5 rounded-sm text-white"
          style={{ backgroundColor: accent }}
        >
          {isProp ? "Prop" : "Outfit"}
        </span>
      </div>
      <div className="pt-1 pb-1.5 px-0.5">
        <p className="text-[7px] sm:text-[8px] font-semibold text-[#2A1F18] text-center leading-tight line-clamp-2">
          {label}
        </p>
      </div>
    </div>
  );
}

function buildPolaroids(images) {
  return (images || [])
    .filter(
      (img) =>
        img?.url &&
        img.source !== "stock" &&
        img.themeName !== "Atmosphere" &&
        !(Array.isArray(img.matched) && img.matched.includes("stock"))
    )
    .slice(0, POLAROIDS.length);
}

function buildItems(outfits, props) {
  const o = (outfits || []).filter((x) => x?.url).map((x) => ({ ...x, kind: "outfit" }));
  const p = (props || []).filter((x) => x?.url).map((x) => ({ ...x, kind: "prop" }));
  const list = [];
  for (const slot of ITEMS) {
    const next = slot.role === "outfit" ? o.shift() : p.shift();
    if (next) list.push({ ...next, slot });
  }
  return list;
}

export default function MoodBoardCollage({
  title,
  subtitle,
  images = [],
  colors = [],
  eventType,
  outfits = [],
  props = [],
}) {
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const design = getEventDesign(eventType);

  const polaroids = buildPolaroids(images);
  const items = buildItems(outfits.slice(0, 4), props.slice(0, 4));
  const palette = cleanPalette(colors);

  const lightboxImages = [
    ...polaroids.map((img) => ({ url: img.url, caption: img.caption || img.themeName })),
    ...items.map((c) => ({
      url: c.url,
      caption: `${c.kind === "outfit" ? "Outfit" : "Prop"}: ${c.label || ""}`,
    })),
  ];

  if (!polaroids.length && !items.length) {
    return (
      <div className="bg-white rounded-[1.75rem] border border-dashed border-[#E8E1DA] p-10 text-center text-gray-400 text-sm">
        No inspiration images yet. Check back soon or contact the studio.
      </div>
    );
  }

  const headline = shortHeadline(title, eventType);
  const subline = eventType ? `${String(eventType).toUpperCase()} MOODBOARD` : "MOODBOARD";
  const footerTitle = String(subtitle || title || design.tagline || "Inspiration")
    .replace(/\s*color\s*palette\s*$/i, "")
    .trim()
    .toUpperCase();

  return (
    <>
      <article
        className="bg-white rounded-[1.75rem] border border-[#E8E1DA]/90 shadow-[0_20px_55px_-30px_rgba(40,30,20,0.5)] overflow-hidden animate-[pageFadeIn_0.45s_ease-out]"
        style={{ borderColor: `${design.accent}33` }}
      >
        <div className="relative m-3 sm:m-4 rounded-2xl overflow-hidden">
          {/* Fabric ground only — no photo wash */}
          <div className="absolute inset-0" style={{ background: design.ground }} />
          <div
            className="absolute inset-0 opacity-[0.15] pointer-events-none mix-blend-multiply"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E")`,
            }}
          />
          <div
            className="absolute inset-0 pointer-events-none opacity-50"
            style={{
              background:
                "radial-gradient(ellipse 75% 45% at 25% 25%, rgba(255,255,255,0.5), transparent 60%), radial-gradient(ellipse 65% 40% at 78% 72%, rgba(255,255,255,0.28), transparent 55%)",
            }}
          />

          <div className="relative w-full" style={{ paddingBottom: "124%" }}>
            <header className="absolute z-20 left-[4%] top-[3.5%] max-w-[40%] pointer-events-none">
              <p
                className="text-[13px] sm:text-[15px] font-bold tracking-[-0.02em] leading-none uppercase"
                style={{ color: design.ink }}
              >
                {headline}
              </p>
              <p
                className="text-[8px] sm:text-[9px] tracking-[0.2em] font-semibold mt-1.5 uppercase"
                style={{ color: design.sublineColor }}
              >
                {subline}
              </p>
            </header>

            {/* Labeled props / outfits on the sides */}
            {items.map((item, i) => {
              const slot = item.slot;
              return (
                <button
                  key={item.id || `item-${i}`}
                  type="button"
                  onClick={() => setLightboxIndex(polaroids.length + i)}
                  className="absolute transition-transform duration-300 hover:scale-[1.05] hover:z-40 focus:outline-none"
                  style={{
                    top: slot.top,
                    left: slot.left,
                    width: slot.width,
                    height: slot.height,
                    transform: `rotate(${slot.rotate})`,
                    zIndex: slot.z,
                  }}
                  title={item.label || ""}
                >
                  <ItemCard
                    item={item}
                    accent={design.accent}
                    index={i}
                    frameBg={design.frameBg}
                  />
                </button>
              );
            })}

            {/* Center polaroids — no quote card */}
            {polaroids.map((img, index) => {
              const slot = POLAROIDS[index];
              if (!slot) return null;
              return (
                <button
                  key={img.id || `pol-${index}`}
                  type="button"
                  onClick={() => setLightboxIndex(index)}
                  className="absolute transition-transform duration-300 hover:scale-[1.04] hover:z-30 focus:outline-none origin-center"
                  style={{
                    top: slot.top,
                    left: slot.left,
                    width: slot.width,
                    height: slot.height,
                    transform: `rotate(${slot.rotate})`,
                    zIndex: slot.z,
                  }}
                >
                  <PolaroidFrame frameBg={design.frameBg} foot={design.frameFoot}>
                    <SafeImg
                      url={thumb(img.url, 560, 700)}
                      fallbackUrl={img.fallbackUrl}
                      alt={img.caption || title || "Inspiration"}
                      className="absolute inset-0 w-full h-full object-cover"
                      eager={index < 3}
                    />
                  </PolaroidFrame>
                </button>
              );
            })}
          </div>
        </div>

        <footer className="px-5 sm:px-7 pb-5 pt-1 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h3
              className="heading-serif text-[15px] sm:text-lg tracking-[0.12em] uppercase text-center sm:text-left leading-tight"
              style={{ color: design.ink }}
            >
              {footerTitle}
            </h3>
            {eventType && (
              <span
                className={`inline-block mt-2 text-[10px] uppercase tracking-wide px-2.5 py-1 rounded-full border font-semibold ${design.chip}`}
              >
                {eventType}
              </span>
            )}
          </div>

          {palette.length > 0 && (
            <div className="flex items-end justify-center sm:justify-end gap-2.5">
              {palette.map((swatch) => (
                <div key={`footer-${swatch.hex}`} className="text-center w-10">
                  <div
                    className="w-8 h-8 mx-auto border border-[#E8E1DA] shadow-sm"
                    style={{ backgroundColor: swatch.hex }}
                    title={swatch.name}
                  />
                  <span className="block mt-1 text-[8px] text-[#5B4636]/75 font-medium truncate">
                    {swatch.name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </footer>
      </article>

      <ImageLightbox
        images={lightboxImages}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onNavigate={setLightboxIndex}
      />
    </>
  );
}
