import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AdminLayout from "../../components/layout/AdminLayout";
import { getProfile } from "../../services/profiles";
import { getClientBookings } from "../../services/bookings";
import { guestDaysRemaining } from "../../services/guestSessions";

const STATUS_COLORS = {
  awaiting_payment: "bg-amber-100 text-amber-700",
  payment_submitted: "bg-blue-100 text-blue-700",
  confirmed: "bg-green-100 text-green-700",
  completed: "bg-gray-100 text-gray-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function AdminClientDetail() {
  const { id } = useParams();
  const [client, setClient] = useState(null);
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    Promise.all([getProfile(id), getClientBookings(id)])
      .then(([profile, clientBookings]) => {
        setClient(profile);
        setBookings(clientBookings);
      })
      .catch(console.error);
  }, [id]);

  if (!client) {
    return (
      <AdminLayout>
        <p className="text-gray-500">Loading client...</p>
      </AdminLayout>
    );
  }

  const isGuest = Boolean(client.is_guest && !client.claimed_at);
  const days = guestDaysRemaining(client.guest_expires_at);

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto">
        <Link to="/admin/clients" className="text-[#A98B75] text-sm hover:underline">← Back to clients</Link>

        <div className="mt-6 bg-white rounded-2xl border border-[#E8E1DA] p-6 mb-6">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="heading-serif text-3xl font-bold text-[#5B4636]">{client.full_name || "Unnamed client"}</h1>
            {isGuest ? (
              <span className="text-xs px-2.5 py-1 rounded-full bg-sky-100 text-sky-800 font-medium">Guest</span>
            ) : (
              <span className="text-xs px-2.5 py-1 rounded-full bg-[#F8F6F3] text-[#5B4636] font-medium border border-[#E8E1DA]">
                Registered
              </span>
            )}
          </div>
          <p className="text-gray-500 mt-1">{client.email}</p>
          {isGuest && (
            <p className="text-sm text-sky-800 bg-sky-50 border border-sky-100 rounded-xl px-4 py-2 mt-3 inline-block">
              {days == null
                ? "Guest session — expiry unknown"
                : days === 0
                  ? "Guest session expires today if not claimed"
                  : `Guest session expires in about ${days} day${days === 1 ? "" : "s"}`}
              {client.guest_expires_at
                ? ` (${new Date(client.guest_expires_at).toLocaleString()})`
                : ""}
            </p>
          )}
          {client.claimed_at && (
            <p className="text-xs text-gray-400 mt-2">
              Claimed account on {new Date(client.claimed_at).toLocaleString()}
            </p>
          )}
          <div className="grid sm:grid-cols-3 gap-4 mt-6 text-sm">
            <div className="bg-[#F8F6F3] rounded-xl p-4">
              <p className="text-gray-400">Phone</p>
              <p className="font-medium text-[#5B4636] mt-1">{client.phone || "—"}</p>
            </div>
            <div className="bg-[#F8F6F3] rounded-xl p-4">
              <p className="text-gray-400">Address</p>
              <p className="font-medium text-[#5B4636] mt-1">{client.address || "—"}</p>
            </div>
            <div className="bg-[#F8F6F3] rounded-xl p-4">
              <p className="text-gray-400">Total bookings</p>
              <p className="font-medium text-[#5B4636] mt-1">{bookings.length}</p>
            </div>
          </div>
        </div>

        <h2 className="font-semibold text-[#5B4636] mb-4">Bookings & payments</h2>
        {bookings.length === 0 ? (
          <p className="text-gray-400">No bookings yet.</p>
        ) : (
          <div className="space-y-4">
            {bookings.map((b) => {
              const payment = b.payments?.[0];
              return (
                <Link
                  key={b.id}
                  to={`/admin/bookings/${b.id}`}
                  className="block bg-white rounded-xl border border-[#E8E1DA] p-5 hover:shadow-md transition"
                >
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[#5B4636]">{b.packages?.name}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        {b.event_date} at {b.time_slot} — {b.location || "Studio"}
                      </p>
                    </div>
                    <span className={`text-xs px-3 py-1 rounded-full font-medium capitalize ${STATUS_COLORS[b.status] || "bg-gray-100"}`}>
                      {b.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  {payment && (
                    <div className="mt-3 pt-3 border-t border-[#F8F6F3] text-sm text-gray-600 flex flex-wrap gap-4">
                      <span>Payment: {payment.payment_type}</span>
                      <span>Amount: ₱{Number(payment.amount).toLocaleString()} PHP</span>
                      <span className="capitalize">Status: {payment.status}</span>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
