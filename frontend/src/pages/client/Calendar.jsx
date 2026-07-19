import { useCallback, useEffect, useState } from "react";
import ClientLayout from "../../components/layout/ClientLayout";
import {
  ensureMonthAvailability,
  getAvailability,
  getTimeSlots,
  subscribeAvailability,
  subscribeBookings,
  syncMonthAvailability,
} from "../../services/settings";
import { getMyBookings } from "../../services/bookings";
import { monthEndISO } from "../../lib/dateUtils";

const ACTIVE_STATUSES = new Set([
  "awaiting_payment",
  "payment_submitted",
  "confirmed",
  "completed",
  "cancellation_pending",
  "cancellation_submitted",
  "pending",
]);

export default function CalendarPage() {
  const [availability, setAvailability] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [timeSlots, setTimeSlots] = useState([]);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const load = useCallback(async () => {
    const start = `${month}-01`;
    const end = monthEndISO(month);
    const slots = await getTimeSlots();
    setTimeSlots(slots);
    await syncMonthAvailability(month);
    const rows = await ensureMonthAvailability(month, slots);
    setAvailability(rows);
    const [availData, bookingData] = await Promise.all([
      getAvailability(start, end),
      getMyBookings(),
    ]);
    setAvailability(availData.length ? availData : rows);
    setBookings(bookingData || []);
  }, [month]);

  useEffect(() => {
    load().catch(console.error);
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

  const getHeat = (day) => {
    const date = `${month}-${String(day).padStart(2, "0")}`;
    const slots = availability.filter((a) => a.avail_date === date && a.is_enabled !== false);
    if (!slots.length) return 0;
    const totalCap = slots.reduce((s, a) => s + a.capacity, 0);
    const booked = slots.reduce((s, a) => s + a.booked_count, 0);
    if (totalCap === 0) return 0;
    return booked / totalCap;
  };

  const heatColor = (ratio) => {
    if (ratio === 0) return "bg-sky-100 text-sky-800 border-sky-200";
    if (ratio < 1) return "bg-sky-50 text-sky-900 border-sky-300";
    return "bg-red-100 text-red-800 border-red-200";
  };

  const dayBookings = (day) => {
    const date = `${month}-${String(day).padStart(2, "0")}`;
    return bookings.filter((b) => b.event_date === date && ACTIVE_STATUSES.has(b.status));
  };

  return (
    <ClientLayout>
      <div>
        <div className="mb-8">
          <h1 className="heading-serif text-4xl font-bold text-[#5B4636]">Calendar & Availability</h1>
          <p className="mt-2 text-gray-500">Studio availability heatmap and your bookings.</p>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-4">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="border border-[#E8E1DA] rounded-xl px-4 py-2" />
          <div className="flex gap-2 text-xs">
            <span className="px-2 py-1 rounded bg-sky-100 border border-sky-200">Available</span>
            <span className="px-2 py-1 rounded bg-sky-50 border border-sky-300">Limited</span>
            <span className="px-2 py-1 rounded bg-red-100 border border-red-200">Fully booked</span>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2 mb-8">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="text-center text-xs font-medium text-gray-500 py-2">{d}</div>
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
            const heat = getHeat(day);
            const mine = dayBookings(day);
            return (
              <div
                key={day}
                className={`min-h-[72px] rounded-xl flex flex-col items-center justify-center text-sm border p-1 ${heatColor(heat)}`}
              >
                <span className="font-medium">{day}</span>
                <span className="text-[10px]">{heat === 0 ? "Open" : heat < 1 ? "Partial" : "Full"}</span>
                {mine.length > 0 && (
                  <span className="text-[9px] mt-0.5 font-medium">Your booking</span>
                )}
              </div>
            );
          })}
        </div>

        {timeSlots.length > 0 && (
          <p className="text-xs text-gray-400 mb-6">Studio slots: {timeSlots.join(" · ")}</p>
        )}

        <h2 className="font-semibold text-[#5B4636] mb-4">Your Bookings This Month</h2>
        <div className="space-y-3">
          {bookings.filter((b) => b.event_date?.startsWith(month)).map((b) => (
            <div key={b.id} className="bg-white rounded-xl border border-[#E8E1DA] p-4 flex justify-between gap-3">
              <span>{b.packages?.name} — {b.event_date} at {b.time_slot}</span>
              <span className="text-xs capitalize text-[#A98B75] shrink-0">{b.status.replace(/_/g, " ")}</span>
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
