import { useCallback, useEffect, useState } from "react";
import {
  ensureMonthAvailability,
  getTimeSlots,
  setDayAvailability,
  subscribeAvailability,
  subscribeBookings,
  syncMonthAvailability,
  updateAvailabilitySlot,
} from "../../services/settings";

const LEGEND = [
  { label: "Available", className: "bg-green-200 border-green-400" },
  { label: "Partial", className: "bg-amber-200 border-amber-400" },
  { label: "Full", className: "bg-red-200 border-red-400" },
  { label: "Closed", className: "bg-gray-200 border-gray-300" },
];

function cellStyle(cell) {
  if (!cell || cell.is_enabled === false) return "bg-gray-200 border-gray-300 text-gray-500";
  if (cell.booked_count >= cell.capacity) return "bg-red-200 border-red-400 text-red-800";
  if (cell.booked_count > 0) return "bg-amber-200 border-amber-400 text-amber-900";
  return "bg-green-200 border-green-400 text-green-900";
}

function cellLabel(cell) {
  if (!cell || cell.is_enabled === false) return "Closed";
  if (cell.booked_count >= cell.capacity) return `Full ${cell.booked_count}/${cell.capacity}`;
  if (cell.booked_count > 0) return `${cell.booked_count}/${cell.capacity}`;
  return `Open ${cell.capacity}`;
}

function cellStatus(cell) {
  if (!cell || cell.is_enabled === false) return "closed";
  if (cell.booked_count >= cell.capacity) return "full";
  if (cell.booked_count > 0) return "partial";
  return "available";
}

export default function AvailabilityHeatmap({ compact = false }) {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [timeSlots, setTimeSlots] = useState([]);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const slots = await getTimeSlots();
      setTimeSlots(slots);
      await syncMonthAvailability(month);
      const rows = await ensureMonthAvailability(month, slots);
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

  useEffect(() => {
    const unsubA = subscribeAvailability(load);
    const unsubB = subscribeBookings(load);
    return () => {
      unsubA();
      unsubB();
    };
  }, [load]);

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
    setBusy(key);
    try {
      const booked = cell?.booked_count || 0;
      const capacity = cell?.capacity ?? 2;
      const status = cellStatus(cell);

      if (status === "closed") {
        await updateAvailabilitySlot(date, slot, { is_enabled: true, capacity: Math.max(2, booked + 1) });
      } else if (status === "available") {
        await updateAvailabilitySlot(date, slot, { is_enabled: false, capacity });
      } else if (status === "partial") {
        await updateAvailabilitySlot(date, slot, { is_enabled: true, capacity: booked });
      } else if (status === "full") {
        const next = window.prompt(
          `Slot ${date} ${slot}: ${booked}/${capacity} booked.\nEnter new capacity (min ${booked}) or leave blank to close:`,
          String(capacity + 1)
        );
        if (next === null) return;
        if (next.trim() === "") {
          await updateAvailabilitySlot(date, slot, { is_enabled: false, capacity });
        } else {
          const cap = Math.max(booked, parseInt(next, 10) || capacity + 1);
          await updateAvailabilitySlot(date, slot, { is_enabled: true, capacity: cap });
        }
      }
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
      await setDayAvailability(date, enable, timeSlots);
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
          <p className="text-xs text-gray-500 mt-1">
            Click a slot to cycle: Open → Closed, or Partial → Full. Bookings update counts automatically.
          </p>
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
                {timeSlots.map((s) => (
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
                    {timeSlots.map((slot) => {
                      const cell = getCell(day, slot);
                      const key = `${date}|${slot}`;
                      return (
                        <td key={slot} className="p-1 border border-[#E8E1DA]">
                          <button
                            type="button"
                            disabled={busy === key}
                            onClick={() => handleCellClick(day, slot)}
                            className={`w-full min-w-[56px] py-2 rounded-lg border text-center text-[10px] leading-tight transition hover:opacity-80 disabled:opacity-60 ${cellStyle(cell)}`}
                            title={
                              cell
                                ? `${cell.avail_date} ${slot}: ${cell.booked_count}/${cell.capacity} — ${cellStatus(cell)}`
                                : "Click to open"
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
