import { useEffect, useState } from "react";
import { getRecentActivityLogs, subscribeActivityLogs, subscribePendingBookings } from "../../services/bookings";

export default function ActivityLogList() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    getRecentActivityLogs()
      .then(setLogs)
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const stopBookings = subscribePendingBookings(load);
    const stopLogs = subscribeActivityLogs(load);
    return () => {
      stopBookings?.();
      stopLogs?.();
    };
  }, []);

  return (
    <div className="bg-white rounded-2xl border border-[#E8E1DA] p-6">
      <h2 className="text-lg font-semibold text-[#5B4636]">Activity log</h2>
      <p className="text-sm text-gray-500 mt-1 mb-4">Payments, receipts, cancellations, and booking decisions.</p>
      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : logs.length === 0 ? (
        <p className="text-sm text-gray-400">No activity yet.</p>
      ) : (
        <ul className="space-y-3">
          {logs.map((log) => (
            <li key={log.id} className="text-sm border-b border-[#E8E1DA] last:border-0 pb-3">
              <p className="text-[#5B4636]">{log.action_description}</p>
              <p className="text-xs text-gray-400 mt-1">
                {(Array.isArray(log.profiles) ? log.profiles[0]?.full_name : log.profiles?.full_name) || "System"} · {new Date(log.created_at).toLocaleString("en-PH")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
