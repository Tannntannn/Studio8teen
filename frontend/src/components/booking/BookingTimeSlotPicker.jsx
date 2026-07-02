import { getSlotStatus } from "../../lib/availabilityUtils";

const SLOT_STYLES = {
  available: "bg-green-50 border-green-300 text-green-800 hover:bg-green-100",
  partial: "bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100",
  full: "bg-red-50 border-red-200 text-red-400 cursor-not-allowed opacity-70",
  closed: "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed opacity-60",
  selected: "ring-2 ring-[#A98B75] bg-[#A98B75]/15 border-[#A98B75]",
};

export default function BookingTimeSlotPicker({ slots, allSlotTimes, selectedSlot, onSelect, disabled }) {
  const slotMap = Object.fromEntries((slots || []).map((s) => [s.time_slot, s]));

  const items = (allSlotTimes || []).map((time) => {
    const row = slotMap[time];
    const status = row ? getSlotStatus(row) : "closed";
    const selectable = status === "available" || status === "partial";
    const left = row ? row.capacity - row.booked_count : 0;
    return { time, status, selectable, left, row };
  });

  if (disabled) {
    return <p className="text-sm text-gray-400">Pick an open date first.</p>;
  }

  if (!items.length) {
    return <p className="text-sm text-gray-400">Loading time slots...</p>;
  }

  return (
    <div>
      <label className="block mb-2 text-sm font-medium text-gray-700">Time slot</label>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {items.map(({ time, status, selectable, left }) => {
          const isSelected = selectedSlot === time;
          return (
            <button
              key={time}
              type="button"
              disabled={!selectable}
              onClick={() => selectable && onSelect(time)}
              className={`py-3 px-2 rounded-xl border text-sm font-medium transition ${SLOT_STYLES[status]} ${isSelected ? SLOT_STYLES.selected : ""} ${!selectable ? "cursor-not-allowed" : "cursor-pointer"}`}
            >
              <span className="block">{time}</span>
              <span className="block text-[10px] mt-0.5 font-normal">
                {status === "full" ? "Full" : status === "closed" ? "Closed" : status === "partial" ? `${left} left` : "Open"}
              </span>
            </button>
          );
        })}
      </div>
      {items.every((i) => !i.selectable) && (
        <p className="text-xs text-red-600 mt-2">All time slots are full or closed on this date. Please pick another day.</p>
      )}
    </div>
  );
}
