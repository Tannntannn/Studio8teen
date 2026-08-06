import { useEffect, useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import AvailabilityHeatmap from "../../components/admin/AvailabilityHeatmap";
import { getTimeSlots, updateStudioSettings } from "../../services/settings";
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

  useEffect(() => {
    getTimeSlots().then((slots) => setTimeSlotsText(slots.join("\n"))).catch(() => {});
  }, []);

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
      Swal.fire({
        icon: "success",
        title: "Time slots saved",
        text: `${slots.length} slots · shown as AM/PM to clients`,
        timer: 1800,
        showConfirmButton: false,
      });
      window.location.reload();
    } catch (err) {
      Swal.fire({ icon: "error", title: "Save failed", text: err.message });
    } finally {
      setSavingSlots(false);
    }
  };

  const resetDefaults = () => {
    setTimeSlotsText(DEFAULT_TIME_SLOTS.join("\n"));
  };

  return (
    <AdminLayout>
      <div>
        <h1 className="heading-serif text-4xl font-bold text-[#5B4636] mb-2">Availability Heatmap</h1>
        <p className="text-gray-500 mb-6">
          30-minute slots (1 booking each). Clients see times as AM/PM. Past days are view-only.
        </p>

        <div className="bg-white rounded-2xl border border-[#E8E1DA] p-6 mb-6 max-w-xl">
          <h2 className="font-semibold text-[#5B4636] mb-2">Studio time slots</h2>
          <p className="text-xs text-gray-500 mb-3">
            One start time per line (24h, e.g. 09:00, 09:30). Default is every 30 minutes from 9:00 AM to 6:00 PM.
            Clients see labels like {formatTime12h("09:00")} / {formatTime12h("14:30")}.
          </p>
          <textarea
            value={timeSlotsText}
            onChange={(e) => setTimeSlotsText(e.target.value)}
            rows={10}
            className="w-full border border-[#E8E1DA] rounded-xl px-4 py-3 text-sm font-mono resize-none outline-none focus:border-[#A98B75]"
            placeholder={"09:00\n09:30\n10:00"}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={saveTimeSlots}
              disabled={savingSlots}
              className="px-5 py-2.5 rounded-xl bg-[#A98B75] text-white text-sm font-medium hover:bg-[#8a7260] disabled:opacity-50"
            >
              {savingSlots ? "Saving..." : "Save time slots"}
            </button>
            <button
              type="button"
              onClick={resetDefaults}
              className="px-5 py-2.5 rounded-xl border border-[#E8E1DA] text-[#5B4636] text-sm font-medium hover:bg-[#F8F6F3]"
            >
              Reset to 30-min default
            </button>
          </div>
        </div>

        <AvailabilityHeatmap />
      </div>
    </AdminLayout>
  );
}
