import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import AdminLayout from "../../components/layout/AdminLayout";
import { getBookingStats, getAllBookings } from "../../services/bookings";
import { getRevenueStats } from "../../services/payments";

const COLORS = ["#A98B75", "#5B4636", "#38bdf8", "#C4A882", "#8a7260", "#ef4444"];

function inRange(isoDate, from, to) {
  if (!isoDate) return false;
  if (from && isoDate < from) return false;
  if (to && isoDate > to) return false;
  return true;
}

export default function AdminReports() {
  const [stats, setStats] = useState(null);
  const [revenue, setRevenue] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    getBookingStats().then(setStats).catch(console.error);
    getRevenueStats().then(setRevenue).catch(console.error);
    getAllBookings().then(setBookings).catch(console.error);
  }, []);

  const filtered = useMemo(
    () => bookings.filter((b) => inRange(b.event_date || b.created_at?.slice(0, 10), from || null, to || null)),
    [bookings, from, to]
  );

  const packageData = useMemo(() => {
    const counts = {};
    filtered.forEach((b) => {
      const name = b.packages?.name || "Unknown";
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [filtered]);

  const statusData = useMemo(() => {
    const counts = {};
    filtered.forEach((b) => {
      const key = (b.status || "unknown").replace(/_/g, " ");
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const walkInSplit = useMemo(() => {
    const walkIn = filtered.filter((b) => b.is_walk_in).length;
    const scheduled = filtered.length - walkIn;
    return [
      { name: "Scheduled", value: scheduled },
      { name: "Walk-in", value: walkIn },
    ];
  }, [filtered]);

  const revenueBookings = useMemo(
    () =>
      filtered.filter((b) =>
        ["confirmed", "completed", "cancellation_pending", "cancellation_submitted"].includes(b.status)
      ),
    [filtered]
  );

  const revenueTrend = useMemo(() => {
    const map = {};
    revenueBookings.forEach((b) => {
      const month = (b.event_date || b.created_at || "").slice(0, 7);
      if (!month) return;
      const pkgPrice = Number(b.packages?.price || 0);
      const addons = Number(b.addons_total || 0);
      map[month] = (map[month] || 0) + pkgPrice + addons;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, total]) => ({ month, total }));
  }, [revenueBookings]);

  const cancelled = filtered.filter((b) => b.status === "cancelled").length;
  const cancelRate = filtered.length ? Math.round((cancelled / filtered.length) * 100) : 0;
  const aov =
    revenueBookings.length > 0
      ? Math.round(
          revenueBookings.reduce((sum, b) => sum + Number(b.packages?.price || 0) + Number(b.addons_total || 0), 0) /
            revenueBookings.length
        )
      : 0;

  const exportCsv = () => {
    const rows = [
      ["Date", "Client", "Package", "Status", "Type", "Price"],
      ...filtered.map((b) => [
        b.event_date,
        b.profiles?.full_name || "",
        b.packages?.name || "",
        b.status || "",
        b.is_walk_in ? "Walk-in" : "Scheduled",
        Number(b.packages?.price || 0) + Number(b.addons_total || 0),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `studiobook-insights-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout>
      <div>
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="heading-serif text-4xl font-bold text-[#5B4636]">Insight Reports</h1>
            <p className="text-gray-500 mt-1 text-sm">Booking, revenue, and channel performance.</p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="block text-[10px] uppercase text-gray-400 mb-1">From</label>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border border-[#E8E1DA] rounded-lg px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-[10px] uppercase text-gray-400 mb-1">To</label>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border border-[#E8E1DA] rounded-lg px-2 py-1.5 text-sm" />
            </div>
            <button type="button" onClick={exportCsv} className="px-3 py-2 rounded-lg bg-[#5B4636] text-white text-sm">
              Export CSV
            </button>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-[#E8E1DA] p-4">
            <p className="text-sm text-gray-500">Verified revenue</p>
            <p className="text-2xl font-bold text-[#5B4636]">₱{Number(revenue?.total_verified || 0).toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-xl border border-[#E8E1DA] p-4">
            <p className="text-sm text-gray-500">Bookings (filter)</p>
            <p className="text-2xl font-bold text-[#5B4636]">{filtered.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-[#E8E1DA] p-4">
            <p className="text-sm text-gray-500">Avg booking value</p>
            <p className="text-2xl font-bold text-[#5B4636]">₱{aov.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-xl border border-[#E8E1DA] p-4">
            <p className="text-sm text-gray-500">Cancellation rate</p>
            <p className="text-2xl font-bold text-[#5B4636]">{cancelRate}%</p>
          </div>
          <div className="bg-white rounded-xl border border-[#E8E1DA] p-4">
            <p className="text-sm text-gray-500">Walk-ins</p>
            <p className="text-2xl font-bold text-[#5B4636]">{walkInSplit[1]?.value || 0}</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-2xl border border-[#E8E1DA] p-6">
            <h3 className="font-semibold mb-4 text-[#5B4636]">Revenue trend (by event month)</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={revenueTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E1DA" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="total" stroke="#A98B75" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-2xl border border-[#E8E1DA] p-6">
            <h3 className="font-semibold mb-4 text-[#5B4636]">Popular packages</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={packageData}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#A98B75" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-2xl border border-[#E8E1DA] p-6">
            <h3 className="font-semibold mb-4 text-[#5B4636]">Bookings by status</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={statusData.length ? statusData : [{ name: "None", value: 1 }]} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {(statusData.length ? statusData : [{ name: "None" }]).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-2xl border border-[#E8E1DA] p-6">
            <h3 className="font-semibold mb-4 text-[#5B4636]">Scheduled vs walk-in</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={walkInSplit} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {walkInSplit.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <p className="text-xs text-gray-400 mt-2 text-center">
              All-time RPC totals: {stats?.total ?? 0} bookings · pending ₱{Number(revenue?.pending || 0).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E8E1DA] p-6">
          <h3 className="font-semibold mb-4 text-[#5B4636]">Recent bookings</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-[#E8E1DA]">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Client</th>
                  <th className="py-2 pr-3">Package</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 12).map((b) => (
                  <tr key={b.id} className="border-b border-[#F8F6F3]">
                    <td className="py-2.5 pr-3 whitespace-nowrap">{b.event_date}</td>
                    <td className="py-2.5 pr-3">{b.profiles?.full_name || "—"}</td>
                    <td className="py-2.5 pr-3">{b.packages?.name || "—"}</td>
                    <td className="py-2.5 pr-3">{b.is_walk_in ? "Walk-in" : "Scheduled"}</td>
                    <td className="py-2.5 capitalize">{(b.status || "").replace(/_/g, " ")}</td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-gray-400">No bookings in this range.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
