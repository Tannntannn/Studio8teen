import { useEffect, useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import AvailabilityHeatmap from "../../components/admin/AvailabilityHeatmap";
import { getTimeSlots, updateStudioSettings } from "../../services/settings";
import { DEFAULT_TIME_SLOTS } from "../../lib/constants";
import Swal from "sweetalert2";

export default function AdminAvailability() {
  const [timeSlotsText, setTimeSlotsText] = useState(DEFAULT_TIME_SLOTS.join("\n"));
  const [savingSlots, setSavingSlots] = useState(false);

  useEffect(() => {
    getTimeSlots().then((slots) => setTimeSlotsText(slots.join("\n"))).catch(() => {});
  }, []);

  const saveTimeSlots = async () => {
    const slots = timeSlotsText
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!slots.length) {
      Swal.fire({ icon: "warning", title: "Add at least one time slot" });
      return;
    }
    setSavingSlots(true);
    try {
      await updateStudioSettings({ time_slots: slots });
      Swal.fire({ icon: "success", title: "Time slots saved", timer: 1500, showConfirmButton: false });
      window.location.reload();
    } catch (err) {
      Swal.fire({ icon: "error", title: "Save failed", text: err.message });
    } finally {
      setSavingSlots(false);
    }
  };

  return (
    <AdminLayout>
      <div>
        <h1 className="heading-serif text-4xl font-bold text-[#5B4636] mb-2">Availability Heatmap</h1>
        <p className="text-gray-500 mb-6">Manage studio time slots and see bookings reflected in real time.</p>

        <div className="bg-white rounded-2xl border border-[#E8E1DA] p-6 mb-6 max-w-xl">
          <h2 className="font-semibold text-[#5B4636] mb-2">Studio time slots</h2>
          <p className="text-xs text-gray-500 mb-3">One slot per line (24h format, e.g. 09:00). Used on the heatmap and client booking form.</p>
          <textarea
            value={timeSlotsText}
            onChange={(e) => setTimeSlotsText(e.target.value)}
            rows={6}
            className="w-full border border-[#E8E1DA] rounded-xl px-4 py-3 text-sm font-mono resize-none outline-none focus:border-[#A98B75]"
            placeholder={"09:00\n11:00\n13:00"}
          />
          <button
            type="button"
            onClick={saveTimeSlots}
            disabled={savingSlots}
            className="mt-3 px-5 py-2.5 rounded-xl bg-[#A98B75] text-white text-sm font-medium hover:bg-[#8a7260] disabled:opacity-50"
          >
            {savingSlots ? "Saving..." : "Save time slots"}
          </button>
        </div>

        <AvailabilityHeatmap />
      </div>
    </AdminLayout>
  );
}
