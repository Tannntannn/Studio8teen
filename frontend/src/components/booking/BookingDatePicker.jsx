import { getDayStatus } from "../../lib/availabilityUtils";

const DAY_STYLES = {
  available: "bg-green-50 border-green-300 text-green-800 hover:bg-green-100 cursor-pointer",
  partial: "bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100 cursor-pointer",
  full: "bg-red-50 border-red-200 text-red-400 cursor-not-allowed opacity-70",
  closed: "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed opacity-60",
  past: "bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed",
  selected: "ring-2 ring-[#A98B75] ring-offset-1",
};

export default function BookingDatePicker({ month, onMonthChange, availabilityByDate, selectedDate, onSelectDate }) {
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const firstDow = new Date(y, m - 1, 1).getDay();
  const today = new Date().toISOString().split("T")[0];

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <label className="text-sm font-medium text-gray-700">Preferred date</label>
        <input
          type="month"
          value={month}
          onChange={(e) => onMonthChange(e.target.value)}
          min={today.slice(0, 7)}
          className="border border-gray-200 rounded-lg px-2 py-1 text-xs"
        />
      </div>

      <div className="flex flex-wrap gap-2 mb-2 text-[10px] text-gray-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-green-200 border border-green-400" /> Open</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-amber-200 border border-amber-400" /> Partial</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-red-100 border border-red-300" /> Full</span>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <div key={d} className="text-center text-[10px] font-medium text-gray-400 py-1">{d}</div>
        ))}
        {cells.map((day, idx) => {
          if (!day) return <div key={`e-${idx}`} />;
          const date = `${month}-${String(day).padStart(2, "0")}`;
          const isPast = date < today;
          const slots = availabilityByDate[date] || [];
          const status = isPast ? "past" : slots.length ? getDayStatus(slots) : "available";
          const selectable = !isPast && (status === "available" || status === "partial");
          const isSelected = selectedDate === date;

          return (
            <button
              key={date}
              type="button"
              disabled={!selectable}
              onClick={() => selectable && onSelectDate(date)}
              className={`aspect-square rounded-lg border text-xs font-medium transition flex flex-col items-center justify-center ${DAY_STYLES[status]} ${isSelected ? DAY_STYLES.selected : ""}`}
              title={status === "full" ? "Fully booked" : status === "closed" ? "Closed" : date}
            >
              <span>{day}</span>
              {status === "full" && <span className="text-[8px] leading-none mt-0.5">Full</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
