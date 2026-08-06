import { useCallback, useEffect, useRef, useState } from "react";
import Swal from "sweetalert2";
import { FaLockOpen, FaLock } from "react-icons/fa";
import {
  ensureMonthAvailability,
  getTimeSlots,
  setDayAvailability,
  subscribeAvailability,
  subscribeBookings,
  syncMonthAvailability,
  updateAvailabilitySlot,
} from "../../services/settings";
import { DEFAULT_SLOT_CAPACITY } from "../../lib/constants";
import { formatTime12h, formatTime12hCompact, isAmSlot, localDateISO } from "../../lib/dateUtils";
import { getSlotStatus, heatmapCellClass } from "../../lib/availabilityUtils";

const LEGEND = [
  { label: "Open", className: "bg-emerald-400" },
  { label: "Limited", className: "bg-amber-400" },
  { label: "Booked", className: "bg-red-500" },
  { label: "Closed", className: "bg-gray-200" },
];

function toastAffected(count) {
  if (!count) return;
  Swal.fire({
    icon: "info",
    title: "Clients notified",
    text: `${count} confirmed booking${count === 1 ? " was" : "s were"} affected.`,
    timer: 2800,
    showConfirmButton: false,
  });
}

function upsertRow(rows, row) {
  const idx = rows.findIndex((r) => r.avail_date === row.avail_date && r.time_slot === row.time_slot);
  if (idx === -1) return [...rows, row];
  const next = [...rows];
  next[idx] = { ...next[idx], ...row };
  return next;
}

export default function AvailabilityHeatmap({ compact = false }) {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [timeSlots, setTimeSlots] = useState([]);
  const [data, setData] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [popping, setPopping] = useState(null);
  const skipSyncUntil = useRef(0);
  const today = localDateISO();

  const refresh = useCallback(
    async ({ silent = false } = {}) => {
      if (silent && Date.now() < skipSyncUntil.current) return;
      try {
        const slots = await getTimeSlots();
        setTimeSlots(slots);
        await syncMonthAvailability(month);
        const rows = await ensureMonthAvailability(month, slots);
        setData(rows);
      } catch (err) {
        console.error("Availability load failed:", err.message);
      } finally {
        if (!silent) setInitialLoading(false);
      }
    },
    [month]
  );

  useEffect(() => {
    setInitialLoading(true);
    refresh({ silent: false });
  }, [refresh]);

  useEffect(() => {
    const silent = () => refresh({ silent: true });
    const unsubA = subscribeAvailability(silent);
    const unsubB = subscribeBookings(silent);
    return () => {
      unsubA();
      unsubB();
    };
  }, [refresh]);

  const daysInMonth = (() => {
    const [y, m] = month.split("-").map(Number);
    return new Date(y, m, 0).getDate();
  })();

  const getCell = (day, slot) => {
    const date = `${month}-${String(day).padStart(2, "0")}`;
    return data.find((d) => d.avail_date === date && d.time_slot === slot);
  };

  const isPastDate = (day) => `${month}-${String(day).padStart(2, "0")}` < today;

  const flashCell = (key) => {
    setPopping(key);
    window.setTimeout(() => setPopping((k) => (k === key ? null : k)), 280);
  };

  const patchCell = (date, slot, patch) => {
    setData((prev) => {
      const existing = prev.find((r) => r.avail_date === date && r.time_slot === slot);
      const base = existing || {
        avail_date: date,
        time_slot: slot,
        capacity: DEFAULT_SLOT_CAPACITY,
        booked_count: 0,
        is_enabled: true,
      };
      return upsertRow(prev, { ...base, ...patch });
    });
  };

  const handleCellClick = async (day, slot) => {
    if (isPastDate(day)) return;
    const date = `${month}-${String(day).padStart(2, "0")}`;
    const cell = getCell(day, slot);
    const key = `${date}|${slot}`;
    const status = getSlotStatus(cell);
    const booked = cell?.booked_count || 0;
    const capacity = cell?.capacity ?? DEFAULT_SLOT_CAPACITY;

    if (status === "full" || status === "partial") return;

    const nextEnabled = status === "closed";
    const snapshot = cell ? { ...cell } : null;

    skipSyncUntil.current = Date.now() + 2500;
    patchCell(date, slot, {
      is_enabled: nextEnabled,
      capacity: Math.max(DEFAULT_SLOT_CAPACITY, booked),
      booked_count: booked,
    });
    flashCell(key);
    setBusy(key);

    try {
      const result = await updateAvailabilitySlot(date, slot, {
        is_enabled: nextEnabled,
        capacity,
      });
      toastAffected(result?.notified || 0);
    } catch (err) {
      if (snapshot) patchCell(date, slot, snapshot);
      else setData((prev) => prev.filter((r) => !(r.avail_date === date && r.time_slot === slot)));
      Swal.fire({ icon: "error", title: "Update failed", text: err.message, timer: 2500, showConfirmButton: false });
    } finally {
      setBusy(null);
    }
  };

  const toggleDay = async (day, enable) => {
    if (isPastDate(day)) return;
    const date = `${month}-${String(day).padStart(2, "0")}`;
    const key = `day-${day}`;
    const snapshot = data.filter((r) => r.avail_date === date);

    skipSyncUntil.current = Date.now() + 2500;
    setData((prev) => {
      const others = prev.filter((r) => r.avail_date !== date);
      const updated = timeSlots.map((slot) => {
        const existing = prev.find((r) => r.avail_date === date && r.time_slot === slot);
        return {
          avail_date: date,
          time_slot: slot,
          capacity: existing?.capacity ?? DEFAULT_SLOT_CAPACITY,
          booked_count: existing?.booked_count ?? 0,
          is_enabled: enable,
        };
      });
      return [...others, ...updated];
    });
    setBusy(key);

    try {
      const result = await setDayAvailability(date, enable, timeSlots);
      if (!enable) toastAffected(result?.notified || 0);
    } catch (err) {
      setData((prev) => {
        const others = prev.filter((r) => r.avail_date !== date);
        return [...others, ...snapshot];
      });
      Swal.fire({ icon: "error", title: "Update failed", text: err.message, timer: 2500, showConfirmButton: false });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={compact ? "" : "bg-white rounded-2xl border border-[#E8E1DA] p-5 sm:p-6"}>
      <div className={`flex flex-wrap justify-between items-start gap-4 ${compact ? "mb-4" : "mb-5"}`}>
        <div>
          {!compact && <h2 className="font-semibold text-[#5B4636] text-lg">Schedule</h2>}
          <p className="text-xs text-gray-400 mt-0.5">
            Tap a dot to open or close. Red = booked. Past days are view-only.
          </p>
        </div>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="border border-[#E8E1DA] rounded-xl px-3 py-2 text-sm bg-[#F8F6F3] focus:outline-none focus:border-[#A98B75]"
          aria-label="Select month"
        />
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2 mb-5">
        {LEGEND.map((item) => (
          <span key={item.label} className="flex items-center gap-1.5 text-[11px] text-gray-500">
            <span className={`w-2.5 h-2.5 rounded-full ${item.className}`} />
            {item.label}
          </span>
        ))}
      </div>

      {initialLoading ? (
        <div className="flex items-center justify-center py-16 text-sm text-gray-400 animate-pulse">
          Loading schedule…
        </div>
      ) : (
        <div className="overflow-x-auto -mx-1 px-1 pb-1">
          <table className="border-separate border-spacing-1 text-[10px] w-full min-w-[640px]">
            <thead>
              <tr>
                <th className="sticky left-0 z-20 bg-white p-1 w-14" rowSpan={2} />
                {timeSlots.some(isAmSlot) && (
                  <th
                    colSpan={timeSlots.filter(isAmSlot).length}
                    className="p-1 text-[10px] font-semibold uppercase tracking-wider text-[#A98B75]/80 text-center"
                  >
                    AM
                  </th>
                )}
                {timeSlots.some((s) => !isAmSlot(s)) && (
                  <th
                    colSpan={timeSlots.filter((s) => !isAmSlot(s)).length}
                    className="p-1 text-[10px] font-semibold uppercase tracking-wider text-[#5B4636]/60 text-center"
                  >
                    PM
                  </th>
                )}
                <th className="w-16 p-1" rowSpan={2} />
              </tr>
              <tr>
                {timeSlots.map((s) => (
                  <th
                    key={s}
                    className="p-0 font-normal text-gray-400 text-[9px] whitespace-nowrap pb-1"
                    title={formatTime12h(s)}
                  >
                    {formatTime12hCompact(s)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                const date = `${month}-${String(day).padStart(2, "0")}`;
                const weekday = new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" });
                const past = isPastDate(day);
                return (
                  <tr key={day}>
                    <td
                      className={`sticky left-0 z-10 py-1 pr-2 pl-0 whitespace-nowrap ${
                        past ? "text-gray-400" : "text-[#5B4636]"
                      }`}
                    >
                      <span className="font-semibold text-xs">{day}</span>
                      <span className="text-[9px] text-gray-400 ml-1">{weekday}</span>
                    </td>
                    {timeSlots.map((slot) => {
                      const cell = getCell(day, slot);
                      const status = getSlotStatus(cell);
                      const key = `${date}|${slot}`;
                      const title = `${formatTime12h(slot)} — ${
                        status === "full"
                          ? "Booked"
                          : status === "partial"
                            ? `${cell?.booked_count}/${cell?.capacity} booked`
                            : status === "closed"
                              ? "Closed"
                              : "Open · tap to close"
                      }`;
                      const canToggle = !past && (status === "available" || status === "closed");
                      const updating = popping === key;

                      return (
                        <td key={slot} className="p-0 text-center">
                          {past || !canToggle ? (
                            <span
                              className={`avail-cell inline-block w-3.5 h-3.5 rounded-full ${heatmapCellClass(status, { past })}`}
                              title={past ? `${title} (past)` : title}
                            />
                          ) : (
                            <button
                              type="button"
                              disabled={busy === key}
                              onClick={() => handleCellClick(day, slot)}
                              className={`avail-cell inline-block w-3.5 h-3.5 rounded-full disabled:opacity-50 ${heatmapCellClass(status, { updating })}`}
                              title={title}
                              aria-label={title}
                            />
                          )}
                        </td>
                      );
                    })}
                    <td className="p-0 pl-1">
                      {past ? (
                        <span className="text-[9px] text-gray-300">—</span>
                      ) : (
                        <div className="flex gap-0.5">
                          <button
                            type="button"
                            disabled={busy === `day-${day}`}
                            onClick={() => toggleDay(day, true)}
                            className="p-1 rounded-md text-emerald-600 hover:bg-emerald-50 transition disabled:opacity-40"
                            title="Open all slots"
                            aria-label={`Open all on ${date}`}
                          >
                            <FaLockOpen size={11} />
                          </button>
                          <button
                            type="button"
                            disabled={busy === `day-${day}`}
                            onClick={() => toggleDay(day, false)}
                            className="p-1 rounded-md text-gray-400 hover:bg-gray-100 transition disabled:opacity-40"
                            title="Close all slots"
                            aria-label={`Close all on ${date}`}
                          >
                            <FaLock size={11} />
                          </button>
                        </div>
                      )}
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
