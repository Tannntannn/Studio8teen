import { getDayStatus } from "../../lib/availabilityUtils";

/** DentaBase-inspired palette fitted to Studio 8Teen branding */
const DAY_STYLES = {
  available: "bg-sky-50 border-sky-300 text-sky-800 hover:bg-sky-100 cursor-pointer",
  partial: "bg-sky-100 border-sky-400 text-sky-900 hover:bg-sky-150 cursor-pointer",
  full: "bg-red-50 border-red-300 text-red-500 cursor-not-allowed opacity-80",
  closed: "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed opacity-60",
  past: "bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed",
  selected: "ring-2 ring-[#A98B75] ring-offset-1 bg-[#A98B75]/15 border-[#A98B75] text-[#5B4636]",
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
}) {
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const firstDow = new Date(y, m - 1, 1).getDay();
  const today = new Date().toISOString().split("T")[0];
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
                status === "full"
                  ? "Fully booked"
                  : status === "closed"
                    ? "Closed"
                    : status === "partial"
                      ? "Limited slots"
                      : date
              }
            >
              <span>{day}</span>
              {status === "full" && <span className="text-[8px] leading-none mt-0.5 font-medium">Full</span>}
              {status === "partial" && !isSelected && (
                <span className="text-[8px] leading-none mt-0.5 font-medium">Ltd</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-4 mt-4 pt-3 border-t border-[#E8E1DA] text-xs text-gray-600">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-400" /> Available date
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400" /> Fully booked
        </span>
      </div>
    </div>
  );
}
