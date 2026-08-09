import { useState } from "react";
import { getThumbnailUrl } from "../../lib/cloudinary";
import ImageLightbox from "../ui/ImageLightbox";

/**
 * Asymmetric collage layout inspired by editorial mood boards.
 * Slot sizes are fixed; extra images are omitted, fewer images leave gaps hidden.
 */
const COLLAGE_SLOTS = [
  { className: "col-span-2 row-span-2 min-h-[140px] sm:min-h-[180px]" },
  { className: "col-span-1 row-span-1 min-h-[70px] sm:min-h-[88px]" },
  { className: "col-span-1 row-span-1 min-h-[70px] sm:min-h-[88px]" },
  { className: "col-span-2 row-span-1 min-h-[70px] sm:min-h-[88px]" },
  { className: "col-span-1 row-span-1 min-h-[70px] sm:min-h-[88px]" },
  { className: "col-span-1 row-span-1 min-h-[70px] sm:min-h-[88px]" },
  { className: "col-span-1 row-span-1 min-h-[70px] sm:min-h-[88px]" },
  { className: "col-span-1 row-span-1 min-h-[70px] sm:min-h-[88px]" },
  { className: "col-span-1 row-span-1 min-h-[70px] sm:min-h-[88px]" },
  { className: "col-span-1 row-span-1 min-h-[70px] sm:min-h-[88px]" },
  { className: "col-span-1 row-span-1 min-h-[70px] sm:min-h-[88px]" },
  { className: "col-span-1 row-span-1 min-h-[70px] sm:min-h-[88px]" },
];

function ColorSwatch({ hex }) {
  return (
    <div
      className="rounded-lg border border-white/40 shadow-sm aspect-square w-full"
      style={{ backgroundColor: hex }}
      title={hex}
    />
  );
}

export default function MoodBoardCollage({
  title,
  subtitle,
  images = [],
  colors = [],
  eventType,
}) {
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const visibleImages = images.filter((img) => img?.url).slice(0, COLLAGE_SLOTS.length);
  const palette = colors.slice(0, 5);

  if (!visibleImages.length) {
    return (
      <div className="bg-[#F8F6F3] rounded-2xl border border-dashed border-[#E8E1DA] p-10 text-center text-gray-400 text-sm">
        No inspiration images yet. Check back soon or contact the studio.
      </div>
    );
  }

  const label = [title, eventType].filter(Boolean).join(" | ").toUpperCase();

  return (
    <>
      <div className="bg-white rounded-2xl border border-[#E8E1DA] overflow-hidden shadow-sm animate-[pageFadeIn_0.4s_ease-out]">
        <div className="px-4 pt-4 pb-2 sm:px-5 sm:pt-5">
          {label && (
            <p className="text-[10px] sm:text-[11px] tracking-[0.12em] text-[#5B4636]/70 font-medium truncate">
              {label}
            </p>
          )}
          {subtitle && (
            <p className="heading-serif text-lg sm:text-xl text-[#5B4636] mt-0.5 line-clamp-2">{subtitle}</p>
          )}
        </div>

        <div className="p-3 sm:p-4 pt-1">
          <div className="grid grid-cols-4 auto-rows-fr gap-1.5 sm:gap-2">
            {COLLAGE_SLOTS.map((slot, index) => {
              const img = visibleImages[index];
              if (!img) return null;

              return (
                <button
                  key={img.id || index}
                  type="button"
                  onClick={() => setLightboxIndex(index)}
                  className={`relative overflow-hidden rounded-lg bg-[#F0EBE4] group ${slot.className}`}
                >
                  <img
                    src={getThumbnailUrl(img.url, index === 0 ? 800 : 400, index === 0 ? 800 : 400)}
                    alt={img.caption || img.themeName || title || "Inspiration"}
                    loading={index < 4 ? "eager" : "lazy"}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                  <span className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                </button>
              );
            })}

            {palette.length > 0 && (
              <div className="col-span-4 flex items-stretch gap-1.5 sm:gap-2 pt-0.5">
                {palette.map((hex) => (
                  <ColorSwatch key={hex} hex={hex} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

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
