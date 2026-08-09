import { useState } from "react";
import { getThumbnailUrl } from "../../lib/cloudinary";
import ImageLightbox from "../ui/ImageLightbox";

function Tile({ img, index, title, onOpen, className = "" }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(index)}
      className={`relative overflow-hidden rounded-xl bg-[#EDE6DF] group shadow-[0_1px_0_rgba(91,70,54,0.06)] ${className}`}
    >
      <img
        src={getThumbnailUrl(img.url, index === 0 ? 900 : 480, index === 0 ? 1100 : 480)}
        alt={img.caption || img.themeName || title || "Inspiration"}
        loading={index < 4 ? "eager" : "lazy"}
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
      />
      <span className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    </button>
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
  const visibleImages = images.filter((img) => img?.url).slice(0, 12);
  const palette = (colors || []).filter(Boolean).slice(0, 5);

  if (!visibleImages.length) {
    return (
      <div className="bg-white rounded-[1.5rem] border border-dashed border-[#E8E1DA] p-10 text-center text-gray-400 text-sm">
        No inspiration images yet. Check back soon or contact the studio.
      </div>
    );
  }

  const eyebrow = [title, eventType].filter(Boolean).join(" | ").toUpperCase();
  const top = visibleImages.slice(0, 4);
  const rest = visibleImages.slice(4);

  return (
    <>
      <article className="bg-white rounded-[1.5rem] border border-[#E8E1DA]/80 shadow-[0_12px_40px_-24px_rgba(91,70,54,0.35)] overflow-hidden animate-[pageFadeIn_0.45s_ease-out]">
        <header className="px-5 pt-5 pb-3 sm:px-6 sm:pt-6">
          {eyebrow && (
            <p className="text-[10px] sm:text-[11px] tracking-[0.14em] text-[#5B4636]/55 font-medium truncate">
              {eyebrow}
            </p>
          )}
          {subtitle && (
            <h3 className="heading-serif text-xl sm:text-2xl text-[#5B4636] mt-1 leading-snug">
              {subtitle}
            </h3>
          )}
        </header>

        <div className="px-3 pb-4 sm:px-4 sm:pb-5">
          {/* Hero mosaic — fixed 2×2 placement, no empty holes */}
          {top.length > 0 && (
            <div className="grid grid-cols-4 grid-rows-2 gap-2 sm:gap-2.5 h-[260px] sm:h-[320px]">
              {top[0] && (
                <Tile
                  img={top[0]}
                  index={0}
                  title={title}
                  onOpen={setLightboxIndex}
                  className="col-span-2 row-span-2"
                />
              )}
              {top[1] && (
                <Tile
                  img={top[1]}
                  index={1}
                  title={title}
                  onOpen={setLightboxIndex}
                  className="col-span-1 row-span-1"
                />
              )}
              {top[2] && (
                <Tile
                  img={top[2]}
                  index={2}
                  title={title}
                  onOpen={setLightboxIndex}
                  className="col-span-1 row-span-1"
                />
              )}
              {top[3] && (
                <Tile
                  img={top[3]}
                  index={3}
                  title={title}
                  onOpen={setLightboxIndex}
                  className="col-span-2 row-span-1"
                />
              )}
            </div>
          )}

          {rest.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 mt-2 sm:mt-2.5">
              {rest.map((img, i) => (
                <Tile
                  key={img.id || i + 4}
                  img={img}
                  index={i + 4}
                  title={title}
                  onOpen={setLightboxIndex}
                  className="aspect-[4/3]"
                />
              ))}
            </div>
          )}

          {palette.length > 0 && (
            <div className="mt-3 sm:mt-4">
              <p className="text-[10px] tracking-[0.16em] uppercase text-[#5B4636]/45 font-medium mb-2 px-0.5">
                Color palette
              </p>
              <div
                className="grid gap-2 sm:gap-2.5"
                style={{ gridTemplateColumns: `repeat(${palette.length}, minmax(0, 1fr))` }}
              >
                {palette.map((hex) => (
                  <div
                    key={hex}
                    className="h-16 sm:h-20 md:h-24 rounded-xl border border-black/5"
                    style={{ backgroundColor: hex }}
                    title={hex}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
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
