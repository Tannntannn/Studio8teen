import { FaChevronDown, FaLightbulb, FaTshirt, FaCube, FaSun, FaMagic, FaTags } from "react-icons/fa";
import { useState } from "react";
import MoodBoardCollage from "./MoodBoardCollage";
import { asColorArray, asStringArray } from "../../services/moodBoardThemes";
import { asCategoryValues } from "../../services/moodBoardCategories";
import { enrichMoodBoardWithStock } from "../../lib/enrichMoodBoardStock";
import { stockFallbackUrl } from "../../lib/eventMoodCatalog";
import { getEventDesign } from "../../lib/eventDesigns";

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

/** Recommendation text shown as labeled image cards (4 outfits / 4 props) */
function RecommendationCards({ items, emptyLabel, accent = "#A98B75" }) {
  if (!items?.length) {
    return <p className="text-sm text-gray-400 italic">{emptyLabel}</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((item) => (
        <RecommendationCard key={item.id || item.label} item={item} accent={accent} />
      ))}
    </div>
  );
}

function RecommendationCard({ item, accent }) {
  const [src, setSrc] = useState(item.url);
  const [stage, setStage] = useState(0);

  const onError = () => {
    if (stage === 0) {
      setStage(1);
      setSrc(
        item.fallbackUrl ||
          stockFallbackUrl(item.label, { kind: item.kind || "outfit", index: 0 })
      );
    } else {
      setStage(2);
      setSrc(null);
    }
  };

  return (
    <figure className="rounded-xl overflow-hidden border border-[#E8E1DA] bg-white shadow-sm">
      <div className="aspect-[4/5] relative bg-[#F8F6F3]">
        {src && stage < 2 ? (
          <img
            src={src}
            alt={item.label || ""}
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
            onError={onError}
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center p-3 text-center"
            style={{ background: `linear-gradient(145deg, ${accent}28, #f8f4ef)` }}
          >
            <span className="text-xs font-semibold text-[#5B4636] leading-snug">{item.label}</span>
          </div>
        )}
        <span
          className="absolute top-2 left-2 text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded text-white"
          style={{ backgroundColor: accent }}
        >
          {item.kind === "prop" ? "Prop" : "Outfit"}
        </span>
      </div>
      <figcaption className="px-2.5 py-2 text-xs font-medium text-[#5B4636] leading-snug text-center">
        {item.label}
      </figcaption>
    </figure>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <div className="bg-[#F8F6F3]/80 rounded-2xl border border-[#E8E1DA] p-5">
      <h3 className="flex items-center gap-2 font-semibold text-[#5B4636] mb-3">
        <Icon className="text-[#A98B75]" size={16} /> {title}
      </h3>
      {children}
    </div>
  );
}

export default function MoodBoardDisplay({ theme, eventType, sessionNotes }) {
  const [detailsOpen, setDetailsOpen] = useState(true);
  const eventLabel = eventType || theme?.event_type || "";
  const design = getEventDesign(eventLabel);

  // Always ensure 4 outfits + 4 props when rendering
  const board = enrichMoodBoardWithStock(theme, eventLabel);

  const images = board.inspiration_images || [];
  const tags = asStringArray(board.tags);
  const colors = asColorArray(board.color_palette);

  const moods = asCategoryValues(board.mood);
  const styles = asCategoryValues(board.photography_style);

  const outfitCards = board.outfit_cards || [];
  const propCards = board.prop_cards || [];
  const accent = design.accent || "#A98B75";

  const hasStyleDetails =
    colors.length > 0 ||
    outfitCards.length ||
    propCards.length ||
    asStringArray(board.outfit_suggestions).length ||
    asStringArray(board.prop_suggestions).length ||
    board.lighting_style ||
    board.editing_style ||
    moods.length ||
    styles.length ||
    board.location_type ||
    tags.length ||
    board.additional_notes;

  const collageTitle = board.main_theme_name || board.name || eventLabel || "Inspiration";
  const collageSubtitle =
    board.description?.split(/[.!?]/)[0]?.trim() ||
    (eventLabel ? `${collageTitle} · ${eventLabel}` : collageTitle);

  return (
    <div className="space-y-6 animate-[pageFadeIn_0.35s_ease-out]">
      <MoodBoardCollage
        title={collageTitle}
        subtitle={collageSubtitle}
        images={images}
        colors={colors}
        eventType={eventLabel}
        outfits={board.outfit_images || []}
        props={board.prop_images || []}
      />

      {sessionNotes && (
        <p className="text-center text-sm text-gray-500 px-2">
          <span className="text-[#5B4636]/60">Notes:</span> {sessionNotes}
        </p>
      )}

      {hasStyleDetails && (
        <div className="bg-white rounded-[1.5rem] border border-[#E8E1DA] overflow-hidden shadow-sm">
          <button
            type="button"
            onClick={() => setDetailsOpen((open) => !open)}
            className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-[#F8F6F3]/60 transition"
          >
            <span className="font-semibold text-[#5B4636]">Style details & suggestions</span>
            <FaChevronDown
              className={`text-[#A98B75] flex-shrink-0 transition-transform ${detailsOpen ? "rotate-180" : ""}`}
              size={14}
            />
          </button>

          {detailsOpen && (
            <div className="px-5 pb-5 space-y-4 border-t border-[#E8E1DA] pt-4">
              <div className="grid md:grid-cols-2 gap-4">
                <Section icon={FaTshirt} title="Suggested outfits">
                  <RecommendationCards
                    items={outfitCards}
                    emptyLabel="No outfit suggestions yet."
                    accent={accent}
                  />
                </Section>
                <Section icon={FaCube} title="Suggested props">
                  <RecommendationCards
                    items={propCards}
                    emptyLabel="No prop suggestions yet."
                    accent={accent}
                  />
                </Section>
                <Section icon={FaSun} title="Recommended lighting">
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {board.lighting_style || "Soft natural / studio-balanced light."}
                  </p>
                </Section>
                <Section icon={FaMagic} title="Recommended editing style">
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {board.editing_style || "Clean, true-to-skin tones with gentle polish."}
                  </p>
                </Section>
              </div>

              {tags.length > 0 && (
                <Section icon={FaTags} title="Tags">
                  <TagList items={tags} />
                </Section>
              )}

              {board.additional_notes && (
                <Section icon={FaLightbulb} title="Additional notes">
                  <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                    {board.additional_notes}
                  </p>
                </Section>
              )}

              {board.stock_enriched && (
                <p className="text-[11px] text-gray-400 text-center pt-1">
                  Outfit and prop visuals are auto-filled to 8 photos for this event. Studio uploads still override when available.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {!hasStyleDetails && images.length === 0 && (
        <div className="bg-white rounded-[1.5rem] border border-[#E8E1DA] p-8 text-center">
          <h3 className="font-semibold text-[#5B4636]">This theme is still being prepared</h3>
          <p className="text-gray-500 text-sm mt-2">
            The studio hasn&apos;t added inspiration images or recommendations for this theme yet. Please check back soon.
          </p>
        </div>
      )}
    </div>
  );
}
