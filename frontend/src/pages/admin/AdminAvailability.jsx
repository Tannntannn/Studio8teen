import { useEffect, useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import AvailabilityHeatmap from "../../components/admin/AvailabilityHeatmap";
import { clearTimeSlotsCache, getTimeSlots, updateStudioSettings } from "../../services/settings";
import { DEFAULT_TIME_SLOTS } from "../../lib/constants";
import { formatTime12h } from "../../lib/dateUtils";
import Swal from "sweetalert2";

function normalizeSlot(raw) {
  const s = String(raw).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export default function AdminAvailability() {
  const [timeSlotsText, setTimeSlotsText] = useState(DEFAULT_TIME_SLOTS.join("\n"));
  const [savingSlots, setSavingSlots] = useState(false);
  const [heatmapKey, setHeatmapKey] = useState(0);
  const [slotsOpen, setSlotsOpen] = useState(false);

  useEffect(() => {
    getTimeSlots().then((slots) => setTimeSlotsText(slots.join("\n"))).catch(() => {});
  }, [heatmapKey]);

  const saveTimeSlots = async () => {
    const slots = [
      ...new Set(
        timeSlotsText
          .split(/[\n,]/)
          .map(normalizeSlot)
          .filter(Boolean)
      ),
    ].sort();
    if (!slots.length) {
      Swal.fire({ icon: "warning", title: "Add at least one time slot", text: "Use 24h format like 09:00 or 14:30." });
      return;
    }
    setSavingSlots(true);
    try {
      await updateStudioSettings({ time_slots: slots });
      clearTimeSlotsCache();
      setHeatmapKey((k) => k + 1);
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
      <div className="max-w-4xl">
        <h1 className="heading-serif text-4xl font-bold text-[#5B4636] mb-1">Availability</h1>
        <p className="text-gray-400 text-sm mb-6">
          Same view clients use when booking · 30-min slots · 1 booking each
        </p>

        <div className="bg-white rounded-2xl border border-[#E8E1DA] p-5 sm:p-6 shadow-sm">
          <AvailabilityHeatmap key={heatmapKey} />
        </div>

        <div className="mt-6 bg-white rounded-2xl border border-[#E8E1DA] overflow-hidden shadow-sm">
          <button
            type="button"
            onClick={() => setSlotsOpen((o) => !o)}
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[#F8F6F3] transition"
          >
            <span className="font-medium text-[#5B4636] text-sm">Studio time slots</span>
            <span className="text-xs text-[#A98B75]">{slotsOpen ? "Hide" : "Edit"}</span>
          </button>
          {slotsOpen && (
            <div className="px-5 pb-5 border-t border-[#F8F6F3] animate-[pageFadeIn_0.2s_ease-out]">
              <p className="text-xs text-gray-400 mt-3 mb-3">
                One per line (24h). Default: {formatTime12h("09:00")} – {formatTime12h("18:00")}, every 30 min.
              </p>
              <textarea
                value={timeSlotsText}
                onChange={(e) => setTimeSlotsText(e.target.value)}
                rows={8}
                className="w-full border border-[#E8E1DA] rounded-xl px-4 py-3 text-sm font-mono resize-none outline-none focus:border-[#A98B75]"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={saveTimeSlots}
                  disabled={savingSlots}
                  className="px-4 py-2 rounded-xl bg-[#A98B75] text-white text-sm font-medium hover:bg-[#8a7260] disabled:opacity-50 transition"
                >
                  {savingSlots ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => setTimeSlotsText(DEFAULT_TIME_SLOTS.join("\n"))}
                  className="px-4 py-2 rounded-xl border border-[#E8E1DA] text-[#5B4636] text-sm hover:bg-[#F8F6F3] transition"
                >
                  Reset default
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
