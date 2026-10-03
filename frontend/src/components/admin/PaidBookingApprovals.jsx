import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Swal from "sweetalert2";
import {
  confirmPaidBooking,
  disapprovePaidBooking,
  getPaidAwaitingConfirmation,
  subscribePendingBookings,
} from "../../services/bookings";
import { supabase } from "../../lib/supabase";
import { formatTime12h } from "../../lib/dateUtils";

export default function PaidBookingApprovals() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  const load = () => {
    getPaidAwaitingConfirmation()
      .then(setBookings)
      .catch((err) => setError(err.message || "Could not load paid bookings"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    return subscribePendingBookings(load);
  }, []);

  const approve = async (booking) => {
    setBusyId(booking.id);
    setError("");
    try {
      await confirmPaidBooking(booking.id);
      try {
        await supabase.functions.invoke("finalize-guest-booking", {
          body: { booking_id: booking.id },
        });
      } catch {
        /* guest archive is optional */
      }
      Swal.fire({
        icon: "success",
        title: "Booking confirmed",
        text: "The client has been notified.",
        timer: 1800,
        showConfirmButton: false,
      });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const disapprove = async (booking) => {
    const { value: note, isConfirmed } = await Swal.fire({
      title: "Disapprove this booking?",
      text: "The slot is released and the client is notified. PayMongo does not refund automatically.",
      input: "text",
      inputPlaceholder: "Reason",
      showCancelButton: true,
      confirmButtonText: "Disapprove",
      confirmButtonColor: "#dc2626",
    });
    if (!isConfirmed) return;
    setBusyId(booking.id);
    setError("");
    try {
      await disapprovePaidBooking(booking.id, note || "Booking was not approved by the studio");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#E8E1DA] p-6">
      <h2 className="text-lg font-semibold text-[#5B4636]">Paid bookings to confirm</h2>
      <p className="text-sm text-gray-500 mt-1 mb-4">
        These clients already paid. Confirm the session or disapprove it.
      </p>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : bookings.length === 0 ? (
        <p className="text-sm text-gray-400">No paid bookings are waiting.</p>
      ) : (
        <ul className="space-y-3">
          {bookings.map((b) => (
            <li key={b.id} className="border border-[#E8E1DA] rounded-xl p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link to={`/admin/bookings/${b.id}`} className="font-semibold text-[#5B4636] hover:underline">
                    {b.profiles?.full_name || "Client"} — {b.packages?.name || "Package"}
                  </Link>
                  <p className="text-sm text-gray-500 mt-1">
                    {b.event_date} · {formatTime12h(b.time_slot)} · #{String(b.id).slice(0, 8)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busyId === b.id}
                    onClick={() => approve(b)}
                    className="px-3 py-2 rounded-xl bg-[#A98B75] text-white text-sm font-medium hover:bg-[#8a7260] disabled:opacity-60"
                  >
                    Confirm booking
                  </button>
                  <button
                    type="button"
                    disabled={busyId === b.id}
                    onClick={() => disapprove(b)}
                    className="px-3 py-2 rounded-xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 disabled:opacity-60"
                  >
                    Disapprove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
