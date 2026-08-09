import { FaChevronDown, FaLightbulb, FaPalette, FaTshirt, FaCube, FaSun, FaMagic, FaTags } from "react-icons/fa";
import { useState } from "react";
import MoodBoardCollage from "./MoodBoardCollage";
import { asColorArray, asStringArray } from "../../services/moodBoardThemes";
import { asCategoryValues } from "../../services/moodBoardCategories";

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
    <div className="bg-[#F8F6F3]/80 rounded-2xl border border-[#E8E1DA] p-5">
      <h3 className="flex items-center gap-2 font-semibold text-[#5B4636] mb-3">
        <Icon className="text-[#A98B75]" size={16} /> {title}
      </h3>
      {children}
    </div>
  );
}

export default function MoodBoardDisplay({ theme, eventType, sessionNotes, isAggregated, isPersonalized }) {
  const [detailsOpen, setDetailsOpen] = useState(true);
  const images = theme.inspiration_images || [];
  const tags = asStringArray(theme.tags);
  const colors = asColorArray(theme.color_palette);

  const moods = asCategoryValues(theme.mood);
  const styles = asCategoryValues(theme.photography_style);

  const hasStyleDetails =
    colors.length > 0 ||
    asStringArray(theme.outfit_suggestions).length ||
    asStringArray(theme.prop_suggestions).length ||
    theme.lighting_style ||
    theme.editing_style ||
    moods.length ||
    styles.length ||
    theme.location_type ||
    tags.length ||
    theme.additional_notes;

  const eventLabel = eventType || theme.event_type || "";
  const collageSubtitle = eventLabel
    ? `${eventLabel} inspiration`
    : "Inspiration";

  return (
    <div className="space-y-6 animate-[pageFadeIn_0.35s_ease-out]">
      {/* Collage is the page — like moodboardai inspiration cards */}
      <MoodBoardCollage
        title={theme.name}
        subtitle={collageSubtitle}
        images={images}
        colors={colors}
        eventType={eventLabel}
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
              <Section icon={FaPalette} title="Recommended color palette">
                <ColorPalette colors={theme.color_palette} />
              </Section>

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
