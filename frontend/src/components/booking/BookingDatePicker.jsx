import { AVAILABILITY_COLORS, getDayStatus, getSlotStatus } from "../../lib/availabilityUtils";
import { areAllTimeSlotsPast, isTimeSlotPast, localDateISO } from "../../lib/dateUtils";

const DAY_STYLES = {
  available: `${AVAILABILITY_COLORS.available} cursor-pointer`,
  partial: `${AVAILABILITY_COLORS.partial} cursor-pointer`,
  full: `${AVAILABILITY_COLORS.full} opacity-90`,
  closed: AVAILABILITY_COLORS.closed,
  past: AVAILABILITY_COLORS.past,
  selected: AVAILABILITY_COLORS.selected,
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function BookingDatePicker({
  month,
  onMonthChange,
  availabilityByDate,
  selectedDate,
  onSelectDate,
  minDate = null,
  maxDate = null,
  allSlotTimes = [],
}) {
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const firstDow = new Date(y, m - 1, 1).getDay();
  const today = localDateISO();
  const earliest = minDate || today;

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const shiftMonth = (delta) => {
    const date = new Date(y, m - 1 + delta, 1);
    const next = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const minMonth = earliest.slice(0, 7);
    if (next < minMonth) return;
    if (maxDate && next > maxDate.slice(0, 7)) return;
    onMonthChange(next);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          className="w-9 h-9 rounded-full border border-[#E8E1DA] text-[#A98B75] hover:bg-[#A98B75]/10 transition"
          aria-label="Previous month"
        >
          ‹
        </button>
        <h3 className="heading-serif text-2xl font-bold text-[#A98B75]">
          {MONTH_NAMES[m - 1]} {y}
        </h3>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          className="w-9 h-9 rounded-full border border-[#E8E1DA] text-[#A98B75] hover:bg-[#A98B75]/10 transition"
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 rounded-t-xl overflow-hidden mb-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div
            key={d}
            className="text-center text-[11px] font-semibold text-white py-2 bg-[#A98B75]"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5 flex-1 content-start">
        {cells.map((day, idx) => {
          if (!day) return <div key={`e-${idx}`} className="aspect-square" />;
          const date = `${month}-${String(day).padStart(2, "0")}`;
          const isPast = date < earliest;
          const isBeyondMax = maxDate ? date > maxDate : false;
          const slots = availabilityByDate[date] || [];
          let status = isPast || isBeyondMax ? "past" : slots.length ? getDayStatus(slots) : "available";

          const times =
            (allSlotTimes || []).length > 0
              ? allSlotTimes
              : slots.map((s) => s.time_slot).filter(Boolean);
          const slotMap = Object.fromEntries(slots.map((s) => [s.time_slot, s]));
          const isToday = date === today;

          // Match the time-slot panel: if nothing can be booked, the day is red (or past)
          if (!isPast && !isBeyondMax && times.length && slots.length) {
            const hasBookable = times.some((time) => {
              if (isToday && isTimeSlotPast(time)) return false;
              const row = slotMap[time];
              const slotStatus = getSlotStatus(row);
              return slotStatus === "available" || slotStatus === "partial";
            });
            if (!hasBookable) {
              if (isToday && areAllTimeSlotsPast(times)) status = "past";
              else status = getDayStatus(slots) === "closed" ? "closed" : "full";
            }
          } else if (!isPast && !isBeyondMax && isToday && times.length && areAllTimeSlotsPast(times)) {
            status = "past";
          }

          const selectable = !isPast && !isBeyondMax && (status === "available" || status === "partial");
          const isSelected = selectedDate === date;

          return (
            <button
              key={date}
              type="button"
              disabled={!selectable}
              onClick={() => selectable && onSelectDate(date)}
              className={`aspect-square rounded-xl border text-sm font-semibold transition flex flex-col items-center justify-center ${DAY_STYLES[status]} ${isSelected ? DAY_STYLES.selected : ""}`}
              title={
                status === "past" && date === today
                  ? "All time slots for today have passed"
                  : status === "full"
                    ? "Fully booked"
                    : status === "closed"
                      ? "Closed"
                      : status === "partial"
                        ? "Some slots booked — limited availability"
                        : date
              }
            >
              <span>{day}</span>
              {status === "full" && <span className="text-[8px] leading-none mt-0.5 font-bold">Full</span>}
              {status === "partial" && !isSelected && (
                <span className="text-[8px] leading-none mt-0.5 font-bold">Ltd</span>
              )}
              {status === "past" && date === today && (
                <span className="text-[8px] leading-none mt-0.5 font-bold">Done</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-4 mt-4 pt-3 border-t border-[#E8E1DA] text-xs text-gray-600">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 border border-emerald-500" /> Available
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 border border-amber-500" /> Limited
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 border border-red-600" /> Fully booked
        </span>
      </div>
    </div>
  );
}
