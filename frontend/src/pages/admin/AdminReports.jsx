import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import AdminLayout from "../../components/layout/AdminLayout";
import { getBookingStats, getAllBookings } from "../../services/bookings";
import { getRevenueStats } from "../../services/payments";

const COLORS = ["#A98B75", "#5B4636", "#C4A882", "#8a7260", "#D4C4B0"];

export default function AdminReports() {
  const [stats, setStats] = useState(null);
  const [revenue, setRevenue] = useState(null);
  const [packageData, setPackageData] = useState([]);

  useEffect(() => {
    getBookingStats().then(setStats).catch(console.error);
    getRevenueStats().then(setRevenue).catch(console.error);
    getAllBookings().then((bookings) => {
      const counts = {};
      bookings.forEach((b) => {
        const name = b.packages?.name || "Unknown";
        counts[name] = (counts[name] || 0) + 1;
      });
      setPackageData(Object.entries(counts).map(([name, value]) => ({ name, value })));
    }).catch(console.error);
  }, []);

  const statusData = stats ? [
    { name: "Confirmed", value: stats.confirmed },
    { name: "Pending", value: stats.pending_payment },
    { name: "Completed", value: stats.completed },
    { name: "Cancelled", value: stats.cancelled },
  ] : [];

  return (
    <AdminLayout>
      <div>
        <h1 className="heading-serif text-4xl font-bold text-[#5B4636] mb-8">Insight Reports</h1>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-2xl border p-6">
            <h3 className="font-semibold mb-4">Bookings by Status</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-2xl border p-6">
            <h3 className="font-semibold mb-4">Popular Packages</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={packageData}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#A98B75" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border p-4">
            <p className="text-sm text-gray-500">Total Revenue</p>
            <p className="text-2xl font-bold text-[#5B4636]">₱{Number(revenue?.total_verified || 0).toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-sm text-gray-500">Pending Payments</p>
            <p className="text-2xl font-bold text-[#5B4636]">₱{Number(revenue?.pending || 0).toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-sm text-gray-500">Total Bookings</p>
            <p className="text-2xl font-bold text-[#5B4636]">{stats?.total ?? 0}</p>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
