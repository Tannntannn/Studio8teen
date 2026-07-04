import { FaLightbulb, FaPalette, FaTshirt, FaCube, FaSun, FaMagic, FaCamera, FaMapMarkerAlt, FaSmile, FaTags } from "react-icons/fa";
import { useState } from "react";
import ImageLightbox from "../ui/ImageLightbox";
import { getThumbnailUrl } from "../../lib/cloudinary";
import { asColorArray, asStringArray } from "../../services/moodBoardThemes";

function TagList({ items, emptyLabel = "None listed" }) {
  const list = asStringArray(items);
  if (!list.length) {
    return <p className="text-sm text-gray-400 italic">{emptyLabel}</p>;
  }
  return (
    <ul className="flex flex-wrap gap-2">
      {list.map((item) => (
        <li key={item} className="text-sm px-3 py-1.5 rounded-full bg-[#F8F6F3] border border-[#E8E1DA] text-[#5B4636]">
          {item}
        </li>
      ))}
    </ul>
  );
}

function ColorPalette({ colors }) {
  const palette = asColorArray(colors);
  if (!palette.length) {
    return <p className="text-sm text-gray-400 italic">No palette defined for this theme yet.</p>;
  }
  return (
    <div className="flex flex-wrap gap-3">
      {palette.map((hex) => (
        <div key={hex} className="text-center">
          <div
            className="w-12 h-12 rounded-xl border border-[#E8E1DA] shadow-sm"
            style={{ backgroundColor: hex }}
            title={hex}
          />
          <span className="text-[10px] text-gray-400 mt-1 block font-mono">{hex}</span>
        </div>
      ))}
    </div>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E8E1DA] p-5">
      <h3 className="flex items-center gap-2 font-semibold text-[#5B4636] mb-3">
        <Icon className="text-[#A98B75]" size={16} /> {title}
      </h3>
      {children}
    </div>
  );
}

function Attribute({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-3 bg-white rounded-xl border border-[#E8E1DA] px-4 py-3">
      <div className="w-9 h-9 rounded-lg bg-[#A98B75]/10 text-[#A98B75] flex items-center justify-center flex-shrink-0">
        <Icon size={15} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-gray-400">{label}</p>
        <p className="text-sm font-medium text-[#5B4636] truncate">{value}</p>
      </div>
    </div>
  );
}

export default function MoodBoardDisplay({ theme, eventType, sessionNotes, isAggregated, isPersonalized, scoreSummary }) {
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const images = theme.inspiration_images || [];
  const tags = asStringArray(theme.tags);
  const sourceThemes = asStringArray(theme.source_theme_names);

  const hasRecommendations =
    theme.color_palette?.length ||
    asStringArray(theme.outfit_suggestions).length ||
    asStringArray(theme.prop_suggestions).length ||
    theme.lighting_style ||
    theme.editing_style ||
    theme.mood ||
    theme.photography_style ||
    theme.location_type;

  return (
    <>
    <div className="space-y-6 animate-[pageFadeIn_0.35s_ease-out]">
      <div className="bg-gradient-to-br from-[#5B4636] to-[#A98B75] rounded-2xl p-6 md:p-8 text-white text-center">
        <p className="text-white/70 text-sm uppercase tracking-wider mb-1">
          {isPersonalized || theme.is_personalized
            ? "Your personalized mood board"
            : isAggregated || theme.is_aggregated
              ? "Event mood board"
              : "Your mood board"}
        </p>
        <h2 className="heading-serif text-3xl md:text-4xl font-bold">{theme.name}</h2>
        {theme.description && (
          <p className="mt-3 text-white/90 max-w-2xl mx-auto text-sm md:text-base">{theme.description}</p>
        )}
        {(isAggregated || theme.is_aggregated || isPersonalized || theme.is_personalized) && sourceThemes.length > 0 && (
          <div className="mt-4 flex flex-wrap justify-center gap-1.5">
            {sourceThemes.map((name) => (
              <span
                key={name}
                className="px-2.5 py-1 rounded-full bg-white/10 border border-white/20 text-[11px]"
              >
                {name}
              </span>
            ))}
          </div>
        )}
        {(eventType || sessionNotes) && (
          <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs">
            {eventType && (
              <span className="px-3 py-1 rounded-full bg-white/15 border border-white/20">{eventType}</span>
            )}
            {sessionNotes && (
              <span className="px-3 py-1 rounded-full bg-white/15 border border-white/20 max-w-md truncate">
                Notes: {sessionNotes}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Personalized match summary */}
      {scoreSummary && scoreSummary.items?.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#E8E1DA] p-5">
          <h3 className="flex items-center gap-2 font-semibold text-[#5B4636] mb-1">
            <FaTags className="text-[#A98B75]" size={16} /> Why these images
          </h3>
          <p className="text-xs text-gray-500 mb-4">
            Ranked {scoreSummary.selectedCount} of {scoreSummary.totalCandidates} inspiration photo
            {scoreSummary.totalCandidates !== 1 ? "s" : ""} by how well they match your preferences.
          </p>
          <ul className="space-y-2">
            {scoreSummary.items.map((item, i) => (
              <li
                key={item.id || i}
                className="flex items-center justify-between gap-3 bg-[#F8F6F3] rounded-xl px-4 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#5B4636] truncate">
                    <span className="text-[#A98B75] font-semibold">#{i + 1}</span> {item.themeName || "Inspiration"}
                  </p>
                  <p className="text-[11px] text-gray-500 truncate">
                    Matched: {(item.matched || []).join(", ") || "Event type"}
                  </p>
                </div>
                <span className="flex-shrink-0 text-xs font-semibold text-white bg-[#A98B75] rounded-full px-2.5 py-1">
                  {item.score} pts
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Theme attributes */}
      {(eventType || theme.event_type || theme.photography_style || theme.mood || theme.location_type) && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Attribute icon={FaCamera} label="Event type" value={eventType || theme.event_type} />
          <Attribute icon={FaMagic} label="Photography style" value={theme.photography_style} />
          <Attribute icon={FaSmile} label="Mood" value={theme.mood} />
          <Attribute icon={FaMapMarkerAlt} label="Location" value={theme.location_type} />
        </div>
      )}

      <Section icon={FaPalette} title="Recommended color palette">
        <ColorPalette colors={theme.color_palette} />
      </Section>

      {images.length > 0 ? (
        <div className="bg-white rounded-2xl border border-[#E8E1DA] p-5">
          <h3 className="font-semibold text-[#5B4636] mb-1">
            {isPersonalized || theme.is_personalized
              ? "Top matched inspiration"
              : isAggregated || theme.is_aggregated
                ? "All inspiration photos"
                : "Inspiration gallery"}
          </h3>
          {(isPersonalized || theme.is_personalized) && (
            <p className="text-xs text-gray-500 mb-4">
              The {images.length} best-matching photo{images.length !== 1 ? "s" : ""} for your {eventType || theme.event_type} session.
            </p>
          )}
          {(isAggregated || theme.is_aggregated) && (
            <p className="text-xs text-gray-500 mb-4">
              {images.length} photo{images.length !== 1 ? "s" : ""} from every {eventType || theme.event_type} style
            </p>
          )}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {images.map((img, index) => (
              <button
                key={img.id}
                type="button"
                onClick={() => setLightboxIndex(index)}
                className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group text-left"
              >
                <img
                  src={getThumbnailUrl(img.url, 400, 400)}
                  alt={img.caption || img.themeName || theme.name}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
                {(isPersonalized || theme.is_personalized) && typeof img.score === "number" && (
                  <span className="absolute top-1.5 right-1.5 text-[10px] font-semibold text-white bg-[#A98B75]/90 rounded-full px-2 py-0.5 shadow">
                    {img.score} pts
                  </span>
                )}
                {img.themeName && (
                  <span className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-2 text-[10px] text-white font-medium truncate opacity-0 group-hover:opacity-100 transition">
                    {img.themeName}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-[#F8F6F3] rounded-2xl border border-dashed border-[#E8E1DA] p-8 text-center text-gray-400 text-sm">
          No inspiration images uploaded for this theme yet. Check back soon or contact the studio.
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <Section icon={FaTshirt} title="Suggested outfits">
          <TagList items={theme.outfit_suggestions} emptyLabel="No outfit suggestions yet." />
        </Section>
        <Section icon={FaCube} title="Suggested props">
          <TagList items={theme.prop_suggestions} emptyLabel="No prop suggestions yet." />
        </Section>
        <Section icon={FaSun} title="Recommended lighting">
          <p className="text-sm text-gray-600 leading-relaxed">{theme.lighting_style || "Not specified yet."}</p>
        </Section>
        <Section icon={FaMagic} title="Recommended editing style">
          <p className="text-sm text-gray-600 leading-relaxed">{theme.editing_style || "Not specified yet."}</p>
        </Section>
      </div>

      {tags.length > 0 && (
        <Section icon={FaTags} title="Tags">
          <TagList items={tags} />
        </Section>
      )}

      {theme.additional_notes && (
        <Section icon={FaLightbulb} title="Additional notes">
          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{theme.additional_notes}</p>
        </Section>
      )}

      {!hasRecommendations && images.length === 0 && (
        <div className="bg-white rounded-2xl border border-[#E8E1DA] p-8 text-center">
          <h3 className="font-semibold text-[#5B4636]">This theme is still being prepared</h3>
          <p className="text-gray-500 text-sm mt-2">
            The studio hasn&apos;t added inspiration images or recommendations for this theme yet. Please check back soon.
          </p>
        </div>
      )}
    </div>

    <ImageLightbox
      images={images.map((img) => ({ url: img.url, caption: img.caption || img.themeName }))}
      index={lightboxIndex}
      onClose={() => setLightboxIndex(null)}
      onNavigate={setLightboxIndex}
    />
    </>
  );
}
