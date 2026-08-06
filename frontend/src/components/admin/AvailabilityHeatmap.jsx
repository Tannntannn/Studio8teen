import { useCallback, useEffect, useRef, useState } from "react";
import Swal from "sweetalert2";
import { FaChevronLeft, FaChevronRight, FaLock, FaLockOpen } from "react-icons/fa";
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
import { getSlotStatus, scheduleChipClass } from "../../lib/availabilityUtils";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const LEGEND = [
  { label: "Available", dot: "bg-emerald-400 border-emerald-500" },
  { label: "Limited", dot: "bg-amber-400 border-amber-500" },
  { label: "Booked", dot: "bg-red-500 border-red-600" },
  { label: "Closed", dot: "bg-gray-200 border-gray-300" },
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

function SlotChip({ label, status, past, updating, disabled, onClick, title }) {
  const canClick = !past && !disabled && onClick;
  const cls = `avail-cell px-2 py-1.5 text-[11px] font-medium min-w-[52px] text-center transition ${scheduleChipClass(status, { past, updating })} ${canClick ? "cursor-pointer" : ""}`;

  if (!canClick) {
    return (
      <span className={cls} title={title}>
        {label}
      </span>
    );
  }

  return (
    <button type="button" className={cls} title={title} onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
}

function DayRow({ day, month, timeSlots, getCell, past, busy, popping, onToggleSlot, onToggleDay }) {
  const date = `${month}-${String(day).padStart(2, "0")}`;
  const weekday = new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" });
  const amSlots = timeSlots.filter(isAmSlot);
  const pmSlots = timeSlots.filter((s) => !isAmSlot(s));

  const renderSlot = (slot) => {
    const cell = getCell(day, slot);
    const status = getSlotStatus(cell);
    const key = `${date}|${slot}`;
    const canToggle = !past && (status === "available" || status === "closed");
    const title =
      status === "full"
        ? `${formatTime12h(slot)} — Booked`
        : status === "partial"
          ? `${formatTime12h(slot)} — ${cell?.booked_count}/${cell?.capacity} booked`
          : status === "closed"
            ? `${formatTime12h(slot)} — Closed · tap to open`
            : `${formatTime12h(slot)} — Open · tap to close`;

    return (
      <SlotChip
        key={slot}
        label={formatTime12hCompact(slot)}
        status={status}
        past={past}
        updating={popping === key}
        disabled={busy === key}
        onClick={canToggle ? () => onToggleSlot(day, slot) : undefined}
        title={past ? `${title} (past)` : title}
      />
    );
  };

  return (
    <div
      className={`rounded-2xl border p-4 transition-colors ${
        past ? "border-[#E8E1DA]/60 bg-[#F8F6F3]/50" : "border-[#E8E1DA] bg-white hover:border-[#A98B75]/30"
      }`}
    >
      <div className="flex flex-wrap items-start gap-3 sm:gap-4">
        <div className={`flex-shrink-0 w-14 text-center ${past ? "text-gray-400" : "text-[#5B4636]"}`}>
          <p className="text-xl font-bold leading-none">{day}</p>
          <p className="text-[10px] uppercase tracking-wide mt-1 text-gray-400">{weekday}</p>
          {past && <p className="text-[9px] text-gray-300 mt-0.5">Past</p>}
        </div>

        <div className="flex-1 min-w-0 space-y-3">
          {amSlots.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">Morning (AM)</p>
              <div className="flex flex-wrap gap-1.5">{amSlots.map(renderSlot)}</div>
            </div>
          )}
          {pmSlots.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">Afternoon (PM)</p>
              <div className="flex flex-wrap gap-1.5">{pmSlots.map(renderSlot)}</div>
            </div>
          )}
        </div>

        {!past && (
          <div className="flex gap-1 flex-shrink-0">
            <button
              type="button"
              disabled={busy === `day-${day}`}
              onClick={() => onToggleDay(day, true)}
              className="p-2 rounded-xl border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition disabled:opacity-40"
              title="Open all slots this day"
              aria-label={`Open all on ${date}`}
            >
              <FaLockOpen size={12} />
            </button>
            <button
              type="button"
              disabled={busy === `day-${day}`}
              onClick={() => onToggleDay(day, false)}
              className="p-2 rounded-xl border border-[#E8E1DA] text-gray-500 hover:bg-gray-50 transition disabled:opacity-40"
              title="Close all slots this day"
              aria-label={`Close all on ${date}`}
            >
              <FaLock size={12} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
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

  const [y, m] = month.split("-").map(Number);

  const shiftMonth = (delta) => {
    const date = new Date(y, m - 1 + delta, 1);
    const next = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const minMonth = today.slice(0, 7);
    if (next < minMonth && delta < 0) return;
    setMonth(next);
  };

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

  const daysInMonth = new Date(y, m, 0).getDate();

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
    <div className={compact ? "" : "space-y-5"}>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          className="w-9 h-9 rounded-full border border-[#E8E1DA] text-[#A98B75] hover:bg-[#A98B75]/10 transition flex items-center justify-center"
          aria-label="Previous month"
        >
          <FaChevronLeft size={12} />
        </button>
        <h2 className="heading-serif text-2xl font-bold text-[#A98B75]">
          {MONTH_NAMES[m - 1]} {y}
        </h2>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          className="w-9 h-9 rounded-full border border-[#E8E1DA] text-[#A98B75] hover:bg-[#A98B75]/10 transition flex items-center justify-center"
          aria-label="Next month"
        >
          <FaChevronRight size={12} />
        </button>
      </div>

      <p className="text-xs text-gray-500 text-center -mt-2">
        Tap a time to open or close · Past days are view-only
      </p>

      <div className="flex flex-wrap justify-center gap-4 text-xs text-gray-600">
        {LEGEND.map((item) => (
          <span key={item.label} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full border ${item.dot}`} />
            {item.label}
          </span>
        ))}
      </div>

      {initialLoading ? (
        <div className="flex items-center justify-center py-20 text-sm text-gray-400 animate-pulse">
          Loading schedule…
        </div>
      ) : (
        <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1 scrollbar-thin">
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => (
            <DayRow
              key={day}
              day={day}
              month={month}
              timeSlots={timeSlots}
              getCell={getCell}
              past={isPastDate(day)}
              busy={busy}
              popping={popping}
              onToggleSlot={handleCellClick}
              onToggleDay={toggleDay}
            />
          ))}
        </div>
      )}
    </div>
  );
}
