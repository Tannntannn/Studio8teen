import { useEffect, useMemo, useState } from "react";
import { FaPalette, FaRedo } from "react-icons/fa";
import ClientLayout from "../../components/layout/ClientLayout";
import MoodBoardDisplay from "../../components/moodboard/MoodBoardDisplay";
import { getActiveThemes } from "../../services/moodBoardThemes";
import {
  EVENT_TYPES,
  MOOD_OPTIONS,
  LOCATION_TYPES,
  PHOTOGRAPHY_STYLES,
} from "../../lib/moodBoardOptions";
import { filterThemesByEvent } from "../../lib/themeMatching";
import { generateMoodBoard, getThemeNamesForEvent } from "../../lib/moodBoardEngine";

const EMPTY_PREFS = {
  eventType: "",
  theme: "",
  mood: "",
  locationType: "",
  photographyStyle: "",
};

export default function MoodBoardGenerator() {
  const [themes, setThemes] = useState([]);
  const [loadingThemes, setLoadingThemes] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [prefs, setPrefs] = useState(EMPTY_PREFS);
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

  const themeOptions = useMemo(
    () => getThemeNamesForEvent(themes, prefs.eventType),
    [themes, prefs.eventType]
  );

  const candidateImageCount = useMemo(
    () =>
      filterThemesByEvent(themes, prefs.eventType).reduce(
        (n, t) => n + (t.inspiration_images?.length || 0),
        0
      ),
    [themes, prefs.eventType]
  );

  const setPref = (key, value) => setPrefs((p) => ({ ...p, [key]: value }));

  const handleEventChange = (value) => {
    // Reset the optional theme when the event changes (theme list depends on it).
    setPrefs((p) => ({ ...p, eventType: value, theme: "" }));
  };

  const handleGenerate = (e) => {
    e.preventDefault();
    setGenerateError(null);

    if (!prefs.eventType) {
      setGenerateError("Please select your event type first.");
      return;
    }

    setGenerating(true);
    try {
      const result = generateMoodBoard(themes, prefs, { topN: 3 });
      if (result.error) {
        setGenerateError(result.error);
        setGenerated(null);
        return;
      }
      setGenerated(result.moodBoard);
      setGeneratedMeta({
        eventType: prefs.eventType,
        sessionNotes: sessionNotes.trim() || null,
        scoreSummary: result.scoreSummary,
      });
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

  const noImagesForEvent = Boolean(prefs.eventType) && candidateImageCount === 0;

  return (
    <ClientLayout>
      <div className="max-w-4xl mx-auto w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#A98B75]/15 text-[#A98B75] mb-4">
            <FaPalette size={22} />
          </div>
          <h1 className="heading-serif text-4xl font-bold text-[#5B4636]">Mood Board Generator</h1>
          <p className="mt-2 text-gray-500 max-w-xl mx-auto">
            Tell us about your event and preferences. We&apos;ll match the studio&apos;s inspiration
            images and build a personalized mood board with the best-fitting looks.
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
            <div>
              <h2 className="font-semibold text-[#5B4636] text-lg">Tell us your preferences</h2>
              <p className="text-sm text-gray-500 mt-1">
                Only the event type is required. Add optional preferences to fine-tune your recommendations.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Event type <span className="text-red-500">*</span>
              </label>
              <select
                value={prefs.eventType}
                onChange={(e) => handleEventChange(e.target.value)}
                required
                className="w-full border border-[#E8E1DA] rounded-xl px-4 py-3 outline-none focus:border-[#A98B75] bg-white"
              >
                <option value="">What are you celebrating?</option>
                {EVENT_TYPES.map((ev) => (
                  <option key={ev} value={ev}>{ev}</option>
                ))}
              </select>
              {prefs.eventType && !noImagesForEvent && (
                <p className="text-xs text-gray-400 mt-1.5">
                  {candidateImageCount} inspiration photo{candidateImageCount !== 1 ? "s" : ""} available for {prefs.eventType}.
                </p>
              )}
              {noImagesForEvent && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-2">
                  No inspiration images are tagged for {prefs.eventType} yet. Try another event type, or contact the studio.
                </p>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Theme <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <select
                  value={prefs.theme}
                  onChange={(e) => setPref("theme", e.target.value)}
                  disabled={!prefs.eventType || themeOptions.length === 0}
                  className="w-full border border-[#E8E1DA] rounded-xl px-4 py-3 outline-none focus:border-[#A98B75] bg-white disabled:bg-gray-50 disabled:text-gray-400"
                >
                  <option value="">No preference</option>
                  {themeOptions.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mood <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <select
                  value={prefs.mood}
                  onChange={(e) => setPref("mood", e.target.value)}
                  disabled={!prefs.eventType}
                  className="w-full border border-[#E8E1DA] rounded-xl px-4 py-3 outline-none focus:border-[#A98B75] bg-white disabled:bg-gray-50 disabled:text-gray-400"
                >
                  <option value="">No preference</option>
                  {MOOD_OPTIONS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Location type <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <select
                  value={prefs.locationType}
                  onChange={(e) => setPref("locationType", e.target.value)}
                  disabled={!prefs.eventType}
                  className="w-full border border-[#E8E1DA] rounded-xl px-4 py-3 outline-none focus:border-[#A98B75] bg-white disabled:bg-gray-50 disabled:text-gray-400"
                >
                  <option value="">No preference</option>
                  {LOCATION_TYPES.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Photography style <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <select
                  value={prefs.photographyStyle}
                  onChange={(e) => setPref("photographyStyle", e.target.value)}
                  disabled={!prefs.eventType}
                  className="w-full border border-[#E8E1DA] rounded-xl px-4 py-3 outline-none focus:border-[#A98B75] bg-white disabled:bg-gray-50 disabled:text-gray-400"
                >
                  <option value="">No preference</option>
                  {PHOTOGRAPHY_STYLES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Session notes (optional)</label>
              <textarea
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
                rows={3}
                placeholder="Share any other preferences or vibe you're going for..."
                className="w-full border border-[#E8E1DA] rounded-xl px-4 py-3 resize-none outline-none focus:border-[#A98B75]"
              />
            </div>

            {generateError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{generateError}</p>
            )}

            <button
              type="submit"
              disabled={generating || !prefs.eventType || noImagesForEvent}
              className="w-full py-3.5 rounded-xl bg-[#A98B75] text-white font-medium hover:bg-[#8a7260] disabled:opacity-50 transition"
            >
              {generating ? "Generating mood board..." : "Generate Mood Board"}
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
              scoreSummary={generatedMeta?.scoreSummary}
              isPersonalized
            />
          </div>
        )}
      </div>
    </ClientLayout>
  );
}
