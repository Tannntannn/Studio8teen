import { getSlotStatus } from "../../lib/availabilityUtils";
import { isTimeSlotPast, localDateISO } from "../../lib/dateUtils";

const SLOT_STYLES = {
  available: "bg-sky-50 border-sky-300 text-sky-800 hover:bg-sky-100",
  partial: "bg-sky-100 border-sky-400 text-sky-900 hover:bg-sky-200",
  full: "bg-red-50 border-red-300 text-red-400 cursor-not-allowed opacity-70",
  closed: "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed opacity-60",
  past: "bg-amber-50 border-amber-200 text-amber-700 cursor-not-allowed opacity-70",
  selected: "ring-2 ring-[#A98B75] bg-[#A98B75]/15 border-[#A98B75] text-[#5B4636]",
};

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
      <div className="grid grid-cols-2 gap-2">
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
              <span className="block">{time}</span>
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
      {items.every((i) => !i.selectable) && (
        <p className="text-xs text-red-600 mt-3">
          All time slots are full, closed, or already passed on this date. Please pick another day.
        </p>
      )}
    </div>
  );
}
