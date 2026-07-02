import { useEffect, useState } from "react";
import ClientLayout from "../../components/layout/ClientLayout";
import { getAvailability } from "../../services/settings";
import { getMyBookings } from "../../services/bookings";

export default function CalendarPage() {
  const [availability, setAvailability] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  useEffect(() => {
    const [y, m] = month.split("-").map(Number);
    const start = `${month}-01`;
    const end = new Date(y, m, 0).toISOString().split("T")[0];
    getAvailability(start, end).then(setAvailability).catch(console.error);
    getMyBookings().then(setBookings).catch(console.error);
  }, [month]);

  const daysInMonth = (() => {
    const [y, m] = month.split("-").map(Number);
    return new Date(y, m, 0).getDate();
  })();

  const getHeat = (day) => {
    const date = `${month}-${String(day).padStart(2, "0")}`;
    const slots = availability.filter((a) => a.avail_date === date);
    if (!slots.length) return 0;
    const totalCap = slots.reduce((s, a) => s + a.capacity, 0);
    const booked = slots.reduce((s, a) => s + a.booked_count, 0);
    return booked / totalCap;
  };

  const heatColor = (ratio) => {
    if (ratio === 0) return "bg-green-100 text-green-800";
    if (ratio < 0.5) return "bg-yellow-100 text-yellow-800";
    if (ratio < 1) return "bg-orange-100 text-orange-800";
    return "bg-red-100 text-red-800";
  };

  return (
    <ClientLayout>
      <div>
        <div className="mb-8">
          <h1 className="heading-serif text-4xl font-bold text-[#5B4636]">Calendar & Availability</h1>
          <p className="mt-2 text-gray-500">Studio availability heatmap and your bookings.</p>
        </div>

        <div className="mb-6 flex items-center gap-4">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="border rounded-xl px-4 py-2" />
          <div className="flex gap-2 text-xs">
            <span className="px-2 py-1 rounded bg-green-100">Available</span>
            <span className="px-2 py-1 rounded bg-yellow-100">Partial</span>
            <span className="px-2 py-1 rounded bg-red-100">Full</span>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2 mb-8">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="text-center text-xs font-medium text-gray-500 py-2">{d}</div>
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
            const heat = getHeat(day);
            return (
              <div key={day} className={`aspect-square rounded-xl flex flex-col items-center justify-center text-sm ${heatColor(heat)}`}>
                <span className="font-medium">{day}</span>
                <span className="text-[10px]">{Math.round(heat * 100)}% booked</span>
              </div>
            );
          })}
        </div>

        <h2 className="font-semibold text-[#5B4636] mb-4">Your Bookings This Month</h2>
        <div className="space-y-3">
          {bookings.filter((b) => b.event_date?.startsWith(month)).map((b) => (
            <div key={b.id} className="bg-white rounded-xl border border-[#E8E1DA] p-4 flex justify-between">
              <span>{b.packages?.name} — {b.event_date} {b.time_slot}</span>
              <span className="text-xs capitalize text-[#A98B75]">{b.status.replace(/_/g, " ")}</span>
            </div>
          ))}
          {bookings.filter((b) => b.event_date?.startsWith(month)).length === 0 && (
            <p className="text-gray-400 text-sm">No bookings this month.</p>
          )}
        </div>
      </div>
    </ClientLayout>
  );
}
