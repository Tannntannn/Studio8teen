import { AVAILABILITY_COLORS, getSlotStatus } from "../../lib/availabilityUtils";
import { formatTime12h, isAmSlot, isTimeSlotPast, localDateISO } from "../../lib/dateUtils";

const SLOT_STYLES = {
  available: AVAILABILITY_COLORS.available,
  partial: AVAILABILITY_COLORS.partial,
  full: `${AVAILABILITY_COLORS.full} opacity-90`,
  closed: AVAILABILITY_COLORS.closed,
  past: "bg-amber-50 border-amber-200 text-amber-700 cursor-not-allowed opacity-70",
  selected: AVAILABILITY_COLORS.selected,
};

function SlotGrid({ items, selectedSlot, onSelect }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {items.map(({ time, status, selectable, left }) => {
        const isSelected = selectedSlot === time;
        return (
          <button
            key={time}
            type="button"
            disabled={!selectable}
            onClick={() => selectable && onSelect(time)}
            className={`py-3 px-2 rounded-xl border text-sm font-medium transition ${SLOT_STYLES[status] || SLOT_STYLES.closed} ${isSelected ? SLOT_STYLES.selected : ""} ${!selectable ? "cursor-not-allowed" : "cursor-pointer"}`}
          >
            <span className="block">{formatTime12h(time)}</span>
            <span className="block text-[10px] mt-0.5 font-normal">
              {status === "past"
                ? "Already passed"
                : status === "full"
                  ? "Fully booked"
                  : status === "closed"
                    ? "Closed"
                    : status === "partial"
                      ? `${left} left`
                      : "Open"}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function BookingTimeSlotPicker({
  slots,
  allSlotTimes,
  selectedSlot,
  onSelect,
  disabled,
  eventDate = null,
}) {
  const slotMap = Object.fromEntries((slots || []).map((s) => [s.time_slot, s]));
  const today = localDateISO();
  const filterPast = eventDate && eventDate === today;

  const items = (allSlotTimes || []).map((time) => {
    const row = slotMap[time];
    let status = row ? getSlotStatus(row) : "closed";
    if (filterPast && isTimeSlotPast(time)) status = "past";
    const selectable = status === "available" || status === "partial";
    const left = row ? row.capacity - row.booked_count : 0;
    return { time, status, selectable, left, row };
  });

  const amItems = items.filter((i) => isAmSlot(i.time));
  const pmItems = items.filter((i) => !isAmSlot(i.time));

  if (disabled) {
    return (
      <div className="rounded-xl border border-dashed border-[#E8E1DA] bg-[#F8F6F3]/80 px-4 py-8 text-center text-sm text-gray-400">
        Select an available date on the calendar to see open time slots.
      </div>
    );
  }

  if (!items.length) {
    return <p className="text-sm text-gray-400">Loading time slots...</p>;
  }

  return (
    <div>
      <label className="block mb-3 text-sm font-semibold text-[#5B4636]">Available time slots</label>

      {amItems.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Morning (AM)</p>
          <SlotGrid items={amItems} selectedSlot={selectedSlot} onSelect={onSelect} />
        </div>
      )}

      {pmItems.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Afternoon (PM)</p>
          <SlotGrid items={pmItems} selectedSlot={selectedSlot} onSelect={onSelect} />
        </div>
      )}

      <div className="flex flex-wrap gap-3 mt-4 text-[10px] text-gray-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-emerald-400" /> Open</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-amber-400" /> Limited</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-red-500" /> Full</span>
      </div>

      {items.every((i) => !i.selectable) && (
        <p className="text-xs text-red-600 mt-3">
          All time slots are full, closed, or already passed on this date. Please pick another day.
        </p>
      )}
    </div>
  );
}
