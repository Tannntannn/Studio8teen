import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FaCheck } from "react-icons/fa";
import { getActiveBookingsWithChecklists } from "../../services/bookings";
import { subscribeTableChanges } from "../../lib/realtime";
import ClientChecklistSummary from "../booking/ClientChecklistSummary";
import { getBookingChecklist, getChecklistProgress, getChecklistTasks } from "../../lib/checklist";

export default function ClientPreparationOverview() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    getActiveBookingsWithChecklists()
      .then(setBookings)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const unsubBookings = subscribeTableChanges("bookings", load);
    const unsubChecklists = subscribeTableChanges("event_checklists", load);
    return () => {
      unsubBookings();
      unsubChecklists();
    };
  }, []);

  const withProgress = bookings.filter((b) => {
    const tasks = getChecklistTasks(getBookingChecklist(b));
    return tasks.some((t) => t.checked);
  });

  return (
    <div className="bg-white rounded-2xl border border-[#E8E1DA] p-6">
      <div className="mb-4">
        <h2 className="font-semibold text-[#5B4636] text-lg">Client Preparation Status</h2>
        <p className="text-xs text-gray-500 mt-1">
          Checklist items clients mark on their booking page · updates in real time
        </p>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading client checklists...</p>
      ) : bookings.length === 0 ? (
        <p className="text-gray-400 text-sm">No active bookings with checklists yet.</p>
      ) : (
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {bookings.map((b) => {
            const tasks = getChecklistTasks(getBookingChecklist(b));
            const { checked, total, percent } = getChecklistProgress(tasks);
            return (
              <Link
                key={b.id}
                to={`/admin/bookings/${b.id}`}
                className="block p-3 rounded-xl border border-[#E8E1DA] hover:bg-[#F8F6F3] transition"
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-[#5B4636] truncate">
                      {b.profiles?.full_name || "Client"} — {b.packages?.name}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {b.event_date} · {b.status.replace(/_/g, " ")}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-[#A98B75] whitespace-nowrap">
                    {checked}/{total}
                  </span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-2">
                  <div className="h-full bg-[#A98B75] rounded-full" style={{ width: `${percent}%` }} />
                </div>
                {checked > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {tasks.filter((t) => t.checked).slice(0, 3).map((task, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 flex items-center gap-1">
                        <FaCheck size={8} /> {task.label}
                      </span>
                    ))}
                    {checked > 3 && (
                      <span className="text-[10px] text-gray-400">+{checked - 3} more</span>
                    )}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}

      {!loading && withProgress.length === 0 && bookings.length > 0 && (
        <p className="text-xs text-gray-400 mt-3 italic">
          No clients have checked items yet. Checklists appear when clients open their booking and mark tasks.
        </p>
      )}
    </div>
  );
}
