import { useState } from "react";
import { getThumbnailUrl } from "../../lib/cloudinary";
import ImageLightbox from "../ui/ImageLightbox";

/**
 * Layered overlapping collage inspired by editorial mood boards (moodboardai-style).
 * Positions are % based so the board scales; photos stack with slight rotation.
 */
const LAYER_LAYOUT = [
  { top: "6%", left: "4%", width: "48%", height: "46%", rotate: "-2deg", z: 2 },
  { top: "4%", left: "48%", width: "28%", height: "28%", rotate: "3deg", z: 4 },
  { top: "8%", left: "72%", width: "24%", height: "32%", rotate: "-4deg", z: 3 },
  { top: "34%", left: "52%", width: "30%", height: "26%", rotate: "2deg", z: 5 },
  { top: "50%", left: "2%", width: "26%", height: "28%", rotate: "4deg", z: 4 },
  { top: "48%", left: "26%", width: "24%", height: "24%", rotate: "-3deg", z: 6 },
  { top: "56%", left: "48%", width: "22%", height: "26%", rotate: "1deg", z: 3 },
  { top: "42%", left: "72%", width: "24%", height: "30%", rotate: "-2deg", z: 5 },
  { top: "74%", left: "8%", width: "22%", height: "20%", rotate: "2deg", z: 7 },
  { top: "72%", left: "32%", width: "20%", height: "22%", rotate: "-5deg", z: 6 },
  { top: "76%", left: "54%", width: "20%", height: "18%", rotate: "3deg", z: 4 },
  { top: "70%", left: "74%", width: "22%", height: "24%", rotate: "-1deg", z: 5 },
];

export default function MoodBoardCollage({
  title,
  subtitle,
  images = [],
  colors = [],
  eventType,
}) {
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const visibleImages = images.filter((img) => img?.url).slice(0, LAYER_LAYOUT.length);
  const palette = (colors || []).filter(Boolean).slice(0, 5);

  if (!visibleImages.length) {
    return (
      <div className="bg-white rounded-[1.75rem] border border-dashed border-[#E8E1DA] p-10 text-center text-gray-400 text-sm">
        No inspiration images yet. Check back soon or contact the studio.
      </div>
    );
  }

  const eyebrow = [title, eventType].filter(Boolean).join(" | ").toUpperCase();

  return (
    <>
      <article className="bg-white rounded-[1.75rem] border border-[#E8E1DA]/90 shadow-[0_18px_50px_-28px_rgba(40,30,20,0.45)] overflow-hidden animate-[pageFadeIn_0.45s_ease-out]">
        <header className="px-5 pt-5 pb-2 sm:px-6 sm:pt-6">
          {eyebrow && (
            <p className="text-[10px] sm:text-[11px] tracking-[0.14em] text-[#1a1a1a]/70 font-medium truncate">
              {eyebrow}
            </p>
          )}
          {subtitle && (
            <h3 className="heading-serif text-xl sm:text-2xl text-[#1a1a1a] mt-1 leading-snug">
              {subtitle}
            </h3>
          )}
        </header>

        {/* Overlapping collage canvas */}
        <div className="relative mx-3 mb-3 sm:mx-4 sm:mb-4 rounded-2xl bg-gradient-to-br from-[#f4f0ea] via-[#ebe4db] to-[#e2d8cc] overflow-hidden">
          <div className="relative w-full" style={{ paddingBottom: "118%" }}>
            {visibleImages.map((img, index) => {
              const layout = LAYER_LAYOUT[index];
              if (!layout) return null;
              return (
                <button
                  key={img.id || index}
                  type="button"
                  onClick={() => setLightboxIndex(index)}
                  className="absolute overflow-hidden rounded-lg bg-[#ddd5cb] shadow-[0_8px_24px_rgba(0,0,0,0.18)] ring-1 ring-black/5 transition-transform duration-300 hover:scale-[1.03] hover:z-20 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#A98B75]"
                  style={{
                    top: layout.top,
                    left: layout.left,
                    width: layout.width,
                    height: layout.height,
                    transform: `rotate(${layout.rotate})`,
                    zIndex: layout.z,
                  }}
                >
                  <img
                    src={getThumbnailUrl(img.url, index === 0 ? 900 : 500, index === 0 ? 900 : 500)}
                    alt={img.caption || img.themeName || title || "Inspiration"}
                    loading={index < 5 ? "eager" : "lazy"}
                    className="absolute inset-0 w-full h-full object-cover"
                    draggable={false}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* Compact color palette (reference: small chips, not tall bars) */}
        {palette.length > 0 && (
          <div className="px-5 pb-5 sm:px-6 sm:pb-6">
            <p className="text-[10px] tracking-[0.18em] uppercase text-[#1a1a1a]/45 font-medium mb-2">
              Color palette
            </p>
            <div className="flex items-center gap-2">
              {palette.map((hex) => (
                <div
                  key={hex}
                  className="h-7 w-7 sm:h-8 sm:w-8 rounded-md border border-black/10 shadow-sm flex-shrink-0"
                  style={{ backgroundColor: hex }}
                  title={hex}
                />
              ))}
            </div>
          </div>
        )}
      </article>

      <ImageLightbox
        images={visibleImages.map((img) => ({
          url: img.url,
          caption: img.caption || img.themeName,
        }))}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onNavigate={setLightboxIndex}
      />
    </>
  );
}
