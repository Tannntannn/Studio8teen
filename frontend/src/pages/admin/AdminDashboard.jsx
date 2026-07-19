import { useEffect, useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import AvailabilityHeatmap from "../../components/admin/AvailabilityHeatmap";
import ClientPreparationOverview from "../../components/admin/ClientPreparationOverview";
import PendingVerifications from "../../components/admin/PendingVerifications";
import { getBookingStats } from "../../services/bookings";
import { getRevenueStats } from "../../services/payments";

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [revenue, setRevenue] = useState(null);

  useEffect(() => {
    getBookingStats().then(setStats).catch(console.error);
    getRevenueStats().then(setRevenue).catch(console.error);
  }, []);

  const cards = [
    { label: "Total Bookings", value: stats?.total ?? "—" },
    { label: "Confirmed", value: stats?.confirmed ?? "—" },
    { label: "Pending Payment", value: stats?.pending_payment ?? "—" },
    { label: "Revenue (verified)", value: revenue ? `₱${Number(revenue.total_verified ?? revenue.verified_total ?? 0).toLocaleString()}` : "—" },
  ];

  return (
    <AdminLayout>
      <div>
        <h1 className="heading-serif text-4xl font-bold text-[#5B4636] mb-2">Admin Dashboard</h1>
        <p className="text-gray-500 mb-8">Manage availability, verify payments, and prepare for sessions.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
          {cards.map((c) => (
            <div key={c.label} className="bg-white rounded-2xl p-6 border border-[#E8E1DA]">
              <p className="text-sm text-gray-500">{c.label}</p>
              <p className="text-3xl font-bold text-[#5B4636] mt-2">{c.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
          <ClientPreparationOverview />
          <PendingVerifications />
        </div>

        <AvailabilityHeatmap />
      </div>
    </AdminLayout>
  );
}
