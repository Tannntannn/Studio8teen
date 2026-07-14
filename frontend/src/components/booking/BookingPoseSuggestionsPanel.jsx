import { useEffect, useState } from "react";
import { FaMagic, FaThumbtack } from "react-icons/fa";
import Swal from "sweetalert2";
import {
  generatePoseSuggestions,
  getPoseSuggestionsForBooking,
  savePoseSuggestions,
  updatePoseSuggestionMeta,
} from "../../services/poseSuggestions";

export default function BookingPoseSuggestionsPanel({ booking, userId, canGenerate = false }) {
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [notes, setNotes] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await getPoseSuggestionsForBooking(booking.id);
      setRecord(data);
      setNotes(data?.photographer_notes || "");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (booking?.id) load();
  }, [booking?.id]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await generatePoseSuggestions({
        packageName: booking.packages?.name,
        eventDate: booking.event_date,
        location: booking.location,
        notes: booking.notes,
        moodHint: booking.notes || booking.packages?.name,
      });
      const saved = await savePoseSuggestions(booking.id, result, userId);
      setRecord(saved);
      Swal.fire({
        icon: "success",
        title: "Pose suggestions ready",
        text: `Generated with ${result.model_used || "AI"}`,
        timer: 1800,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire({ icon: "error", title: "Generation failed", text: err.message });
    } finally {
      setGenerating(false);
    }
  };

  const togglePin = async (index) => {
    if (!record?.id) return;
    const pinned = new Set(record.pinned_indexes || []);
    if (pinned.has(index)) pinned.delete(index);
    else pinned.add(index);
    const updated = await updatePoseSuggestionMeta(record.id, {
      pinned_indexes: [...pinned],
    });
    setRecord(updated);
  };

  const saveNotes = async () => {
    if (!record?.id) return;
    const updated = await updatePoseSuggestionMeta(record.id, { photographer_notes: notes });
    setRecord(updated);
    Swal.fire({ icon: "success", title: "Notes saved", timer: 1200, showConfirmButton: false });
  };

  const poses = record?.poses || [];
  const mood = record?.mood_board || {};

  return (
    <div className="bg-white rounded-2xl border border-[#E8E1DA] p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="font-semibold text-[#5B4636] flex items-center gap-2">
            <FaMagic className="text-[#A98B75]" /> AI Pose & Mood Board
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Session planning reference{record?.model_used ? ` · ${record.model_used}` : ""}.
          </p>
        </div>
        {canGenerate && (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="px-4 py-2 rounded-xl bg-[#A98B75] text-white text-sm font-medium hover:bg-[#8a7260] disabled:opacity-50"
          >
            {generating ? "Generating..." : poses.length ? "Regenerate" : "Generate poses"}
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading suggestions...</p>
      ) : !poses.length ? (
        <p className="text-sm text-gray-400">
          {canGenerate
            ? "No AI suggestions yet. Generate pose ideas tailored to this booking."
            : "The studio has not generated pose suggestions for this session yet."}
        </p>
      ) : (
        <div className="space-y-5">
          {mood?.name && (
            <div className="rounded-xl border border-[#E8E1DA] bg-[#F8F6F3] p-4">
              <p className="text-xs uppercase tracking-wider text-[#A98B75] font-semibold">Mood board</p>
              <h3 className="heading-serif text-xl font-bold text-[#5B4636] mt-1">{mood.name}</h3>
              {mood.vibe && <p className="text-sm text-gray-600 mt-1">{mood.vibe}</p>}
              <div className="flex flex-wrap gap-2 mt-3">
                {(mood.color_palette || []).map((hex) => (
                  <div key={hex} className="text-center">
                    <div className="w-9 h-9 rounded-lg border border-[#E8E1DA]" style={{ backgroundColor: hex }} title={hex} />
                    <span className="text-[9px] text-gray-400 font-mono">{hex}</span>
                  </div>
                ))}
              </div>
              <div className="grid sm:grid-cols-3 gap-3 mt-3 text-xs text-gray-600">
                {mood.lighting && <p><span className="font-semibold text-[#5B4636]">Lighting:</span> {mood.lighting}</p>}
                {mood.setting && <p><span className="font-semibold text-[#5B4636]">Setting:</span> {mood.setting}</p>}
                {mood.props && <p><span className="font-semibold text-[#5B4636]">Props:</span> {mood.props}</p>}
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-3">
            {poses.map((pose, index) => {
              const pinned = (record.pinned_indexes || []).includes(index);
              return (
                <div
                  key={`${pose.title}-${index}`}
                  className={`rounded-xl border p-4 ${pinned ? "border-[#A98B75] bg-[#A98B75]/5" : "border-[#E8E1DA]"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-semibold text-[#5B4636] text-sm">
                      #{index + 1} {pose.title}
                    </h4>
                    {canGenerate && (
                      <button
                        type="button"
                        onClick={() => togglePin(index)}
                        className={`p-1.5 rounded-lg ${pinned ? "text-[#A98B75]" : "text-gray-300 hover:text-[#A98B75]"}`}
                        title={pinned ? "Unpin" : "Pin favorite"}
                      >
                        <FaThumbtack size={12} />
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mt-2">{pose.description}</p>
                  <ul className="mt-3 space-y-1 text-[11px] text-gray-500">
                    {pose.positioning && <li><span className="font-medium text-gray-700">Position:</span> {pose.positioning}</li>}
                    {pose.props && <li><span className="font-medium text-gray-700">Props:</span> {pose.props}</li>}
                    {pose.mood && <li><span className="font-medium text-gray-700">Mood:</span> {pose.mood}</li>}
                    {pose.lighting && <li><span className="font-medium text-gray-700">Lighting:</span> {pose.lighting}</li>}
                  </ul>
                </div>
              );
            })}
          </div>

          {canGenerate && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Photographer notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full border border-[#E8E1DA] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#A98B75]"
                placeholder="Shooting notes for this set..."
              />
              <button
                type="button"
                onClick={saveNotes}
                className="mt-2 text-xs font-medium text-[#A98B75] hover:underline"
              >
                Save notes
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
