import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ClientLayout from "../../components/layout/ClientLayout";
import { FaCalendarAlt, FaClock, FaCheckCircle } from "react-icons/fa";
import { getMyBookings } from "../../services/bookings";

const STATUS_COLORS = {
  awaiting_payment: "bg-amber-100 text-amber-700",
  payment_submitted: "bg-blue-100 text-blue-700",
  confirmed: "bg-green-100 text-green-700",
  completed: "bg-gray-100 text-gray-700",
  cancelled: "bg-red-100 text-red-700",
  cancellation_pending: "bg-orange-100 text-orange-700",
  cancellation_submitted: "bg-purple-100 text-purple-700",
};

export default function Bookings() {
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    getMyBookings().then(setBookings).catch(console.error);
  }, []);

  const upcoming = bookings.filter((b) => ["confirmed", "awaiting_payment", "payment_submitted"].includes(b.status)).length;
  const completed = bookings.filter((b) => b.status === "completed").length;
  const pending = bookings.filter((b) => ["awaiting_payment", "payment_submitted"].includes(b.status)).length;

  return (
    <ClientLayout>
      <div className="max-w-4xl mx-auto w-full">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <div>
            <h1 className="heading-serif text-4xl font-bold text-[#5B4636]">Bookings</h1>
            <p className="mt-2 text-gray-500">Manage your photography sessions.</p>
          </div>
          <Link to="/create-booking" className="px-5 py-2.5 rounded-xl bg-[#A98B75] text-white text-sm font-medium hover:bg-[#8a7260]">
            New Booking
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 text-center">
          <div className="bg-white rounded-2xl p-6 border border-[#E8E1DA]">
            <FaCalendarAlt className="text-[#A98B75] mx-auto" />
            <h2 className="mt-4 text-3xl font-bold text-[#5B4636]">{upcoming}</h2>
            <p className="text-gray-500 text-sm">Upcoming</p>
          </div>
          <div className="bg-white rounded-2xl p-6 border border-[#E8E1DA]">
            <FaCheckCircle className="text-[#A98B75] mx-auto" />
            <h2 className="mt-4 text-3xl font-bold text-[#5B4636]">{completed}</h2>
            <p className="text-gray-500 text-sm">Completed</p>
          </div>
          <div className="bg-white rounded-2xl p-6 border border-[#E8E1DA]">
            <FaClock className="text-[#A98B75] mx-auto" />
            <h2 className="mt-4 text-3xl font-bold text-[#5B4636]">{pending}</h2>
            <p className="text-gray-500 text-sm">Pending Payment</p>
          </div>
        </div>

        {bookings.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E8E1DA] p-12 text-center">
            <h2 className="text-2xl font-semibold text-[#5B4636]">No Bookings Yet</h2>
            <p className="mt-3 text-gray-500">Browse packages and schedule your first session.</p>
            <Link to="/create-booking" className="inline-block mt-6 px-6 py-3 rounded-xl bg-[#A98B75] text-white font-medium">
              Create Booking
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((b) => (
              <Link
                key={b.id}
                to={`/client-bookings/${b.id}`}
                className="block bg-white rounded-2xl border border-[#E8E1DA] p-6 hover:shadow-md transition"
              >
                <div className="flex flex-col sm:flex-row justify-between items-center gap-3 text-center sm:text-left">
                  <div>
                    <h3 className="font-semibold text-[#5B4636]">{b.packages?.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {b.event_date} at {b.time_slot} — {b.location || "Studio"}
                    </p>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full font-medium ${STATUS_COLORS[b.status] || "bg-gray-100"}`}>
                    {b.status.replace(/_/g, " ")}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-6 text-center">
          <Link to="/client-calendar" className="text-[#A98B75] font-medium hover:underline text-sm">
            View calendar & availability →
          </Link>
        </div>
      </div>
    </ClientLayout>
  );
}
