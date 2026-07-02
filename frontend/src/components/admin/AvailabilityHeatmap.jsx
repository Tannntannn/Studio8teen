import { useCallback, useEffect, useState } from "react";
import {
  TIME_SLOTS,
  ensureMonthAvailability,
  setDayAvailability,
  subscribeAvailability,
  toggleAvailabilitySlot,
} from "../../services/settings";

const LEGEND = [
  { label: "Available", className: "bg-green-200 border-green-400" },
  { label: "Booked", className: "bg-amber-200 border-amber-400" },
  { label: "Unavailable", className: "bg-red-200 border-red-400" },
  { label: "Disabled", className: "bg-gray-200 border-gray-300" },
];

function cellStyle(cell) {
  if (!cell || cell.is_enabled === false) return "bg-gray-200 border-gray-300 text-gray-400";
  if (cell.booked_count >= cell.capacity) return "bg-red-200 border-red-400 text-red-800";
  if (cell.booked_count > 0) return "bg-amber-200 border-amber-400 text-amber-900";
  return "bg-green-200 border-green-400 text-green-900";
}

function cellLabel(cell) {
  if (!cell || cell.is_enabled === false) return "Off";
  if (cell.booked_count > 0) return `${cell.booked_count}/${cell.capacity}`;
  return "Open";
}

export default function AvailabilityHeatmap({ compact = false }) {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await ensureMonthAvailability(month);
      setData(rows);
    } catch (err) {
      console.error("Availability load failed:", err.message);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => subscribeAvailability(load), [load]);

  const daysInMonth = (() => {
    const [y, m] = month.split("-").map(Number);
    return new Date(y, m, 0).getDate();
  })();

  const getCell = (day, slot) => {
    const date = `${month}-${String(day).padStart(2, "0")}`;
    return data.find((d) => d.avail_date === date && d.time_slot === slot);
  };

  const handleCellClick = async (day, slot) => {
    const date = `${month}-${String(day).padStart(2, "0")}`;
    const cell = getCell(day, slot);
    const key = `${date}|${slot}`;
    if (cell?.booked_count > 0) return;
    setBusy(key);
    try {
      const currentlyEnabled = cell?.is_enabled !== false;
      await toggleAvailabilitySlot(date, slot, !currentlyEnabled);
      await load();
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(null);
    }
  };

  const toggleDay = async (day, enable) => {
    const date = `${month}-${String(day).padStart(2, "0")}`;
    setBusy(`day-${day}`);
    try {
      await setDayAvailability(date, enable);
      await load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={compact ? "" : "bg-white rounded-2xl border border-[#E8E1DA] p-6"}>
      <div className={`flex flex-wrap justify-between items-center gap-3 ${compact ? "mb-4" : "mb-6"}`}>
        <div>
          {!compact && <h2 className="font-semibold text-[#5B4636] text-lg">Availability Heatmap</h2>}
          <p className="text-xs text-gray-500 mt-1">Click a slot to toggle availability. Booked slots cannot be changed.</p>
        </div>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="border border-[#E8E1DA] rounded-xl px-3 py-2 text-sm"
          aria-label="Select month"
        />
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        {LEGEND.map((item) => (
          <span key={item.label} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className={`w-3 h-3 rounded border ${item.className}`} />
            {item.label}
          </span>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading availability...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="text-xs border-collapse w-full min-w-[480px]">
            <thead>
              <tr>
                <th className="p-2 border border-[#E8E1DA] bg-[#F8F6F3] text-left sticky left-0">Day</th>
                {TIME_SLOTS.map((s) => (
                  <th key={s} className="p-2 border border-[#E8E1DA] bg-[#F8F6F3]">{s}</th>
                ))}
                <th className="p-2 border border-[#E8E1DA] bg-[#F8F6F3]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                const date = `${month}-${String(day).padStart(2, "0")}`;
                const weekday = new Date(date).toLocaleDateString("en-US", { weekday: "short" });
                return (
                  <tr key={day}>
                    <td className="p-2 border border-[#E8E1DA] font-medium bg-white sticky left-0">
                      {day} <span className="text-gray-400">{weekday}</span>
                    </td>
                    {TIME_SLOTS.map((slot) => {
                      const cell = getCell(day, slot);
                      const key = `${date}|${slot}`;
                      const hasBooking = cell?.booked_count > 0;
                      return (
                        <td key={slot} className="p-1 border border-[#E8E1DA]">
                          <button
                            type="button"
                            disabled={hasBooking || busy === key}
                            onClick={() => handleCellClick(day, slot)}
                            className={`w-full min-w-[52px] py-2 rounded-lg border text-center transition hover:opacity-80 disabled:cursor-not-allowed ${cellStyle(cell)}`}
                            title={
                              cell
                                ? `${cell.avail_date} ${slot}: ${cell.booked_count}/${cell.capacity}${cell.is_enabled === false ? " (disabled)" : ""}`
                                : "Click to enable"
                            }
                          >
                            {cellLabel(cell)}
                          </button>
                        </td>
                      );
                    })}
                    <td className="p-1 border border-[#E8E1DA] whitespace-nowrap">
                      <button
                        type="button"
                        disabled={busy === `day-${day}`}
                        onClick={() => toggleDay(day, true)}
                        className="text-[10px] px-2 py-1 rounded bg-green-100 text-green-800 mr-1"
                      >
                        Open
                      </button>
                      <button
                        type="button"
                        disabled={busy === `day-${day}`}
                        onClick={() => toggleDay(day, false)}
                        className="text-[10px] px-2 py-1 rounded bg-red-100 text-red-800"
                      >
                        Close
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
