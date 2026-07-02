import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { FaCheckCircle, FaTimesCircle } from "react-icons/fa";
import { getBookingByQrToken } from "../../services/bookings";

export default function VerifyBooking() {
  const { token } = useParams();
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getBookingByQrToken(token)
      .then(setBooking)
      .catch(() => setError("Invalid or inactive verification code."))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="min-h-screen bg-[#F8F6F3] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl border border-[#E8E1DA] p-8 max-w-md w-full text-center shadow-lg">
        <h1 className="heading-serif text-2xl font-bold text-[#5B4636] mb-2">Booking Verification</h1>
        <p className="text-sm text-gray-500 mb-6">Studio 8Teen — proof of genuine booking</p>

        {loading && <p className="text-gray-400">Verifying...</p>}

        {error && !loading && (
          <>
            <FaTimesCircle className="text-red-500 mx-auto mb-3" size={40} />
            <p className="text-red-600 font-medium">{error}</p>
            <p className="text-xs text-gray-400 mt-2">QR codes are issued only after payment is confirmed by the studio.</p>
          </>
        )}

        {booking && !loading && (
          <>
            <FaCheckCircle className="text-green-600 mx-auto mb-3" size={40} />
            <p className="text-green-700 font-semibold mb-4">Verified — real confirmed booking</p>
            <p className="font-semibold text-[#5B4636] text-lg">{booking.packages?.name}</p>
            <p className="text-gray-600 mt-2">{booking.profiles?.full_name}</p>
            <p className="text-sm text-gray-400 mt-1">{booking.event_date} at {booking.time_slot}</p>
            <p className="text-sm text-gray-400">{booking.location || "Studio"}</p>
            <span className="inline-block mt-4 px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm capitalize">
              {booking.status.replace(/_/g, " ")}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
