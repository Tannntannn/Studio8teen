import { useEffect, useMemo, useState } from "react";
import { FaPalette, FaRedo } from "react-icons/fa";
import ClientLayout from "../../components/layout/ClientLayout";
import MoodBoardDisplay from "../../components/moodboard/MoodBoardDisplay";
import { getActiveThemes, getThemeById } from "../../services/moodBoardThemes";
import { EVENT_TYPES } from "../../lib/moodBoardOptions";
import { filterThemesByEvent, getThemeEventLabels } from "../../lib/themeMatching";
import { ALL_THEMES_VALUE, mergeThemesForEvent } from "../../lib/mergeEventMoodBoard";

export default function MoodBoardGenerator() {
  const [themes, setThemes] = useState([]);
  const [loadingThemes, setLoadingThemes] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [eventType, setEventType] = useState("");
  const [themeId, setThemeId] = useState("");
  const [sessionNotes, setSessionNotes] = useState("");

  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState(null);
  const [generated, setGenerated] = useState(null);
  const [generatedMeta, setGeneratedMeta] = useState(null);

  useEffect(() => {
    setLoadingThemes(true);
    getActiveThemes()
      .then(setThemes)
      .catch((err) => setLoadError(err.message || "Could not load themes."))
      .finally(() => setLoadingThemes(false));
  }, []);

  const filteredThemes = useMemo(
    () => filterThemesByEvent(themes, eventType),
    [themes, eventType]
  );

  const browseAll = themeId === ALL_THEMES_VALUE;
  const selectedTheme = browseAll ? null : filteredThemes.find((t) => t.id === themeId);

  const totalImages = useMemo(
    () =>
      filteredThemes.reduce((n, t) => n + (t.inspiration_images?.length || 0), 0),
    [filteredThemes]
  );

  // Reset theme when it no longer matches the event; default to browse-all.
  useEffect(() => {
    if (!eventType) {
      setThemeId("");
      return;
    }
    if (themeId && themeId !== ALL_THEMES_VALUE && !filteredThemes.some((t) => t.id === themeId)) {
      setThemeId(filteredThemes.length ? ALL_THEMES_VALUE : "");
    }
  }, [eventType, filteredThemes, themeId]);

  const handleEventChange = (value) => {
    setEventType(value);
    setThemeId(value && filterThemesByEvent(themes, value).length ? ALL_THEMES_VALUE : "");
  };

  const canGenerate =
    Boolean(eventType) &&
    (browseAll ? filteredThemes.length > 0 : Boolean(themeId));

  const handleGenerate = async (e) => {
    e.preventDefault();
    setGenerateError(null);

    if (!eventType) {
      setGenerateError("Please select your event type first.");
      return;
    }

    setGenerating(true);
    try {
      if (browseAll) {
        const merged = mergeThemesForEvent(themes, eventType);
        if (!merged) {
          setGenerateError(`No inspiration available for ${eventType} yet.`);
          return;
        }
        setGenerated(merged);
        setGeneratedMeta({ eventType, sessionNotes: sessionNotes.trim() || null, isAggregated: true });
      } else {
        if (!themeId) {
          setGenerateError("Pick a theme or choose “Browse all inspiration”.");
          return;
        }
        const theme = await getThemeById(themeId);
        setGenerated(theme);
        setGeneratedMeta({ eventType, sessionNotes: sessionNotes.trim() || null, isAggregated: false });
      }
    } catch (err) {
      setGenerateError(err.message || "Failed to generate mood board.");
      setGenerated(null);
    } finally {
      setGenerating(false);
    }
  };

  const handleReset = () => {
    setGenerated(null);
    setGeneratedMeta(null);
    setGenerateError(null);
  };

  return (
    <ClientLayout>
      <div className="max-w-4xl mx-auto w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#A98B75]/15 text-[#A98B75] mb-4">
            <FaPalette size={22} />
          </div>
          <h1 className="heading-serif text-4xl font-bold text-[#5B4636]">Mood Board Generator</h1>
          <p className="mt-2 text-gray-500 max-w-xl mx-auto">
            Pick your event, then browse all inspiration or narrow down to one photography style.
          </p>
        </div>

        {loadingThemes && (
          <div className="bg-white rounded-2xl border border-[#E8E1DA] p-12 text-center text-gray-400">
            Loading available themes...
          </div>
        )}

        {loadError && !loadingThemes && (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-8 text-center text-red-600">
            {loadError}
          </div>
        )}

        {!loadingThemes && !loadError && themes.length === 0 && (
          <div className="bg-white rounded-2xl border border-[#E8E1DA] p-12 text-center">
            <h2 className="font-semibold text-[#5B4636]">No themes available yet</h2>
            <p className="text-gray-500 mt-2 text-sm">The studio is preparing mood board themes. Please check back soon.</p>
          </div>
        )}

        {!loadingThemes && !loadError && themes.length > 0 && !generated && (
          <form onSubmit={handleGenerate} className="bg-white rounded-2xl border border-[#E8E1DA] p-6 md:p-8 space-y-5 shadow-sm">
            <h2 className="font-semibold text-[#5B4636] text-lg">Before you generate</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Event type <span className="text-red-500">*</span>
              </label>
              <select
                value={eventType}
                onChange={(e) => handleEventChange(e.target.value)}
                required
                className="w-full border border-[#E8E1DA] rounded-xl px-4 py-3 outline-none focus:border-[#A98B75] bg-white"
              >
                <option value="">What are you celebrating?</option>
                {EVENT_TYPES.map((ev) => (
                  <option key={ev} value={ev}>{ev}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Photography theme <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <select
                value={themeId}
                onChange={(e) => setThemeId(e.target.value)}
                disabled={!eventType}
                className="w-full border border-[#E8E1DA] rounded-xl px-4 py-3 outline-none focus:border-[#A98B75] bg-white disabled:bg-gray-50 disabled:text-gray-400"
              >
                <option value="">
                  {!eventType
                    ? "Select an event type first"
                    : filteredThemes.length
                      ? "Choose how to browse"
                      : `No themes for ${eventType} yet`}
                </option>
                {eventType && filteredThemes.length > 0 && (
                  <option value={ALL_THEMES_VALUE}>
                    Browse all {eventType} inspiration ({totalImages} photo{totalImages !== 1 ? "s" : ""})
                  </option>
                )}
                {filteredThemes.length > 0 && (
                  <option disabled>──────────────</option>
                )}
                {filteredThemes.map((t) => {
                  const labels = getThemeEventLabels(t);
                  const imgCount = (t.inspiration_images || []).length;
                  const suffix = labels.length ? ` — ${labels.join(", ")}` : "";
                  const photos = imgCount ? ` (${imgCount} photo${imgCount !== 1 ? "s" : ""})` : "";
                  return (
                    <option key={t.id} value={t.id}>
                      {t.name}{suffix}{photos}
                    </option>
                  );
                })}
              </select>

              {eventType && filteredThemes.length === 0 && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-2">
                  No themes are tagged for {eventType} yet. Try another event type, or contact the studio.
                </p>
              )}

              {browseAll && filteredThemes.length > 0 && (
                <p className="text-xs text-[#5B4636] bg-[#A98B75]/10 border border-[#A98B75]/20 rounded-lg px-3 py-2 mt-2">
                  Shows every inspiration image and recommendation from all {filteredThemes.length}{" "}
                  {eventType} theme{filteredThemes.length !== 1 ? "s" : ""} — no need to pick just one.
                </p>
              )}

              {selectedTheme && (
                <p className="text-xs text-gray-500 mt-2">{selectedTheme.description}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Session notes (optional)</label>
              <textarea
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
                rows={3}
                placeholder="Share any preferences, locations, or vibe you're going for..."
                className="w-full border border-[#E8E1DA] rounded-xl px-4 py-3 resize-none outline-none focus:border-[#A98B75]"
              />
            </div>

            {generateError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{generateError}</p>
            )}

            <button
              type="submit"
              disabled={generating || !canGenerate}
              className="w-full py-3.5 rounded-xl bg-[#A98B75] text-white font-medium hover:bg-[#8a7260] disabled:opacity-50 transition"
            >
              {generating
                ? "Generating mood board..."
                : browseAll
                  ? `Generate all ${eventType} inspiration`
                  : "Generate Mood Board"}
            </button>
          </form>
        )}

        {generated && (
          <div className="space-y-6">
            <div className="flex justify-center">
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[#A98B75] text-[#A98B75] text-sm font-medium hover:bg-[#A98B75]/10"
              >
                <FaRedo size={12} /> Start over
              </button>
            </div>
            <MoodBoardDisplay
              theme={generated}
              eventType={generatedMeta?.eventType}
              sessionNotes={generatedMeta?.sessionNotes}
              isAggregated={generatedMeta?.isAggregated}
            />
          </div>
        )}
      </div>
    </ClientLayout>
  );
}
