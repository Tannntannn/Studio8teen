import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AdminLayout from "../../components/layout/AdminLayout";
import { getAllClients } from "../../services/profiles";
import { getAllBookings } from "../../services/bookings";
import { guestDaysRemaining } from "../../services/guestSessions";

export default function AdminClients() {
  const [clients, setClients] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    getAllClients().then(setClients).catch(console.error);
    getAllBookings().then(setBookings).catch(console.error);
  }, []);

  const filtered = useMemo(() => {
    if (filter === "guest") return clients.filter((c) => c.is_guest && !c.claimed_at);
    if (filter === "registered") return clients.filter((c) => !c.is_guest || c.claimed_at);
    return clients;
  }, [clients, filter]);

  return (
    <AdminLayout>
      <div>
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <h1 className="heading-serif text-4xl font-bold text-[#5B4636]">Clients</h1>
          <div className="flex gap-2">
            {[
              ["all", "All"],
              ["guest", "Guests"],
              ["registered", "Registered"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                  filter === value
                    ? "bg-[#A98B75] text-white border-[#A98B75]"
                    : "bg-white text-[#5B4636] border-[#E8E1DA] hover:bg-[#F8F6F3]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          {filtered.map((c) => {
            const clientBookings = bookings.filter((b) => b.client_id === c.id);
            const isGuest = Boolean(c.is_guest && !c.claimed_at);
            const days = guestDaysRemaining(c.guest_expires_at);
            return (
              <Link
                key={c.id}
                to={`/admin/clients/${c.id}`}
                className="block bg-white rounded-xl border border-[#E8E1DA] p-6 hover:shadow-md transition"
              >
                <div className="flex justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-[#5B4636]">{c.full_name || "Unnamed"}</p>
                      {isGuest ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 font-medium">
                          Guest
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F8F6F3] text-[#5B4636] font-medium border border-[#E8E1DA]">
                          Registered
                        </span>
                      )}
                      {c.deactivated_at && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                          Deactivated
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{c.email}</p>
                    {isGuest && (
                      <p className="text-xs text-sky-700 mt-1">
                        {days == null
                          ? "Expires soon"
                          : days === 0
                            ? "Expires today"
                            : `Expires in ~${days} day${days === 1 ? "" : "s"}`}
                      </p>
                    )}
                  </div>
                  <span className="text-sm text-gray-400 flex-shrink-0">{clientBookings.length} booking(s)</span>
                </div>
              </Link>
            );
          })}
          {filtered.length === 0 && <p className="text-gray-400">No clients in this filter.</p>}
        </div>
      </div>
    </AdminLayout>
  );
}
