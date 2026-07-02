import { useEffect, useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import { getAllClients } from "../../services/profiles";
import { getAllBookings } from "../../services/bookings";

export default function AdminClients() {
  const [clients, setClients] = useState([]);
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    getAllClients().then(setClients).catch(console.error);
    getAllBookings().then(setBookings).catch(console.error);
  }, []);

  return (
    <AdminLayout>
      <div>
        <h1 className="heading-serif text-4xl font-bold text-[#5B4636] mb-8">Clients</h1>
        <div className="space-y-4">
          {clients.map((c) => {
            const clientBookings = bookings.filter((b) => b.client_id === c.id);
            return (
              <div key={c.id} className="bg-white rounded-xl border border-[#E8E1DA] p-6">
                <div className="flex justify-between">
                  <div>
                    <p className="font-semibold text-[#5B4636]">{c.full_name || "Unnamed"}</p>
                    <p className="text-sm text-gray-500">{c.email}</p>
                  </div>
                  <span className="text-sm text-gray-400">{clientBookings.length} booking(s)</span>
                </div>
              </div>
            );
          })}
          {clients.length === 0 && <p className="text-gray-400">No clients registered yet.</p>}
        </div>
      </div>
    </AdminLayout>
  );
}
