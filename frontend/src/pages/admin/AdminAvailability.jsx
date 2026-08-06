import { useEffect, useMemo, useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import AvailabilityHeatmap from "../../components/admin/AvailabilityHeatmap";
import { clearTimeSlotsCache, getTimeSlots, updateStudioSettings } from "../../services/settings";
import { DEFAULT_TIME_SLOTS } from "../../lib/constants";
import { formatTime12h, formatTime12hCompact, isAmSlot } from "../../lib/dateUtils";
import Swal from "sweetalert2";
import { FaClock, FaChevronDown, FaChevronUp } from "react-icons/fa";

function normalizeSlot(raw) {
  const s = String(raw).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function parseSlots(text) {
  return [
    ...new Set(
      text
        .split(/[\n,]/)
        .map(normalizeSlot)
        .filter(Boolean)
    ),
  ].sort();
}

export default function AdminAvailability() {
  const [timeSlotsText, setTimeSlotsText] = useState(DEFAULT_TIME_SLOTS.join("\n"));
  const [savedSlots, setSavedSlots] = useState(DEFAULT_TIME_SLOTS);
  const [savingSlots, setSavingSlots] = useState(false);
  const [heatmapKey, setHeatmapKey] = useState(0);
  const [slotsOpen, setSlotsOpen] = useState(false);

  useEffect(() => {
    getTimeSlots()
      .then((slots) => {
        setSavedSlots(slots);
        setTimeSlotsText(slots.join("\n"));
      })
      .catch(() => {});
  }, [heatmapKey]);

  const previewSlots = useMemo(() => parseSlots(timeSlotsText), [timeSlotsText]);
  const amPreview = previewSlots.filter(isAmSlot);
  const pmPreview = previewSlots.filter((s) => !isAmSlot(s));

  const saveTimeSlots = async () => {
    const slots = parseSlots(timeSlotsText);
    if (!slots.length) {
      Swal.fire({ icon: "warning", title: "Add at least one time slot", text: "Use 24h format like 09:00 or 14:30." });
      return;
    }
    setSavingSlots(true);
    try {
      await updateStudioSettings({ time_slots: slots });
      clearTimeSlotsCache();
      setSavedSlots(slots);
      setHeatmapKey((k) => k + 1);
      setSlotsOpen(false);
      Swal.fire({
        icon: "success",
        title: "Time slots saved",
        text: `${slots.length} slots · clients see AM/PM labels`,
        timer: 1800,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire({ icon: "error", title: "Save failed", text: err.message });
    } finally {
      setSavingSlots(false);
    }
  };

  return (
    <AdminLayout>
      <div className="mx-auto max-w-2xl w-full px-1">
        <div className="text-center mb-8">
          <h1 className="heading-serif text-4xl font-bold text-[#5B4636] mb-2">Availability</h1>
          <p className="text-gray-400 text-sm">
            30-minute slots · 1 booking each · same view clients use when booking
          </p>
        </div>

        <div className="mb-5 bg-white rounded-2xl border border-[#E8E1DA] shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setSlotsOpen((o) => !o)}
            className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-[#F8F6F3]/80 transition text-left"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-9 h-9 rounded-xl bg-[#A98B75]/10 text-[#A98B75] flex items-center justify-center flex-shrink-0">
                <FaClock size={14} />
              </span>
              <div className="min-w-0">
                <p className="font-medium text-[#5B4636] text-sm">Studio time slots</p>
                <p className="text-xs text-gray-400 truncate">
                  {savedSlots.length} slots · {formatTime12h(savedSlots[0] || "09:00")} –{" "}
                  {formatTime12h(savedSlots[savedSlots.length - 1] || "18:00")}
                </p>
              </div>
            </div>
            <span className="text-[#A98B75] flex-shrink-0">
              {slotsOpen ? <FaChevronUp size={12} /> : <FaChevronDown size={12} />}
            </span>
          </button>

          {!slotsOpen && savedSlots.length > 0 && (
            <div className="px-5 pb-4 border-t border-[#F8F6F3] pt-3 space-y-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">AM</p>
                <div className="flex flex-wrap justify-center gap-1">
                  {savedSlots.filter(isAmSlot).map((s) => (
                    <span
                      key={s}
                      className="text-[10px] px-2 py-0.5 rounded-lg bg-[#F8F6F3] text-[#5B4636] border border-[#E8E1DA]"
                    >
                      {formatTime12hCompact(s)}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">PM</p>
                <div className="flex flex-wrap justify-center gap-1">
                  {savedSlots.filter((s) => !isAmSlot(s)).map((s) => (
                    <span
                      key={s}
                      className="text-[10px] px-2 py-0.5 rounded-lg bg-[#F8F6F3] text-[#5B4636] border border-[#E8E1DA]"
                    >
                      {formatTime12hCompact(s)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {slotsOpen && (
            <div className="px-5 pb-5 border-t border-[#F8F6F3] animate-[pageFadeIn_0.2s_ease-out]">
              <p className="text-xs text-gray-400 mt-4 mb-3 text-center">
                One time per line (24h). Default: every 30 min from {formatTime12h("09:00")} to{" "}
                {formatTime12h("18:00")}.
              </p>
              <textarea
                value={timeSlotsText}
                onChange={(e) => setTimeSlotsText(e.target.value)}
                rows={6}
                className="w-full border border-[#E8E1DA] rounded-xl px-4 py-3 text-sm font-mono resize-none outline-none focus:border-[#A98B75] bg-[#F8F6F3]/50"
                spellCheck={false}
              />
              {previewSlots.length > 0 && (
                <p className="text-[10px] text-center text-gray-400 mt-2">
                  Preview: {previewSlots.length} slots
                </p>
              )}
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={saveTimeSlots}
                  disabled={savingSlots}
                  className="px-5 py-2.5 rounded-xl bg-[#A98B75] text-white text-sm font-medium hover:bg-[#8a7260] disabled:opacity-50 transition"
                >
                  {savingSlots ? "Saving…" : "Save slots"}
                </button>
                <button
                  type="button"
                  onClick={() => setTimeSlotsText(DEFAULT_TIME_SLOTS.join("\n"))}
                  className="px-5 py-2.5 rounded-xl border border-[#E8E1DA] text-[#5B4636] text-sm hover:bg-[#F8F6F3] transition"
                >
                  Reset default
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-[#E8E1DA] p-5 sm:p-6 shadow-sm">
          <AvailabilityHeatmap key={heatmapKey} />
        </div>
      </div>
    </AdminLayout>
  );
}
