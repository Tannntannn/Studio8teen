import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FaTrash } from "react-icons/fa";
import {
  getPendingVerifications,
  markAllPendingAsRead,
  subscribePendingBookings,
  deleteBooking,
} from "../../services/bookings";
import { subscribeTableChanges } from "../../lib/realtime";
import ClientChecklistSummary from "../booking/ClientChecklistSummary";
import ConfirmModal from "../ui/ConfirmModal";

const RECENT_HOURS = 24;

function formatDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function isRecent(createdAt) {
  if (!createdAt) return false;
  return Date.now() - new Date(createdAt).getTime() < RECENT_HOURS * 60 * 60 * 1000;
}

export default function PendingVerifications() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState("recent");
  const [filter, setFilter] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = () => {
    setError(null);
    getPendingVerifications()
      .then(setBookings)
      .catch((err) => {
        setError(err.message || "Could not load pending bookings");
        setBookings([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const unsubBookings = subscribePendingBookings(load);
    const unsubChecklists = subscribeTableChanges("event_checklists", load);
    return () => { unsubBookings(); unsubChecklists(); };
  }, []);

  const filtered = useMemo(() => {
    let list = [...bookings];
    if (filter === "unread") list = list.filter((b) => !b.admin_read_at);
    if (filter === "recent") list = list.filter((b) => isRecent(b.created_at));
    if (filter === "old") list = list.filter((b) => !isRecent(b.created_at));
    if (sortBy === "recent") list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    else if (sortBy === "oldest") list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    else if (sortBy === "unread") list.sort((a, b) => Number(!b.admin_read_at) - Number(!a.admin_read_at));
    return list;
  }, [bookings, sortBy, filter]);

  const unreadCount = bookings.filter((b) => !b.admin_read_at).length;

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteBooking(deleteTarget.id);
      setDeleteTarget(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#E8E1DA] p-5">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <div>
          <h2 className="font-semibold text-[#5B4636]">Pending Payment Verification</h2>
          <p className="text-xs text-gray-500">{bookings.length} awaiting · {unreadCount} unread</p>
        </div>
        {unreadCount > 0 && (
          <button type="button" onClick={() => markAllPendingAsRead().then(load)} className="text-xs px-3 py-1.5 rounded-lg border border-[#A98B75] text-[#A98B75]">
            Mark all read
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="text-xs border rounded-lg px-2 py-1.5" aria-label="Sort">
          <option value="recent">Most recent</option>
          <option value="oldest">Oldest</option>
          <option value="unread">Unread first</option>
        </select>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="text-xs border rounded-lg px-2 py-1.5" aria-label="Filter">
          <option value="all">All</option>
          <option value="unread">Unread</option>
          <option value="recent">Recent 24h</option>
          <option value="old">Older</option>
        </select>
      </div>

      {error && <p className="text-amber-700 text-xs mb-3 p-2 rounded-lg bg-amber-50">{error}</p>}

      {loading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-400 text-sm">No payments awaiting verification.</p>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filtered.map((b) => {
            const unread = !b.admin_read_at;
            return (
              <div
                key={b.id}
                className={`flex items-stretch gap-2 p-3 rounded-xl border transition ${
                  unread ? "border-[#A98B75]/40 bg-[#A98B75]/5" : "border-[#E8E1DA]"
                }`}
              >
                <Link to={`/admin/bookings/${b.id}`} className="flex-1 min-w-0 hover:opacity-90">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {isRecent(b.created_at) && (
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-green-100 text-green-700">New</span>
                    )}
                    {unread && <span className="w-1.5 h-1.5 rounded-full bg-[#A98B75]" />}
                    <span className={`text-sm truncate ${unread ? "font-bold text-[#5B4636]" : "text-gray-700"}`}>
                      {b.profiles?.full_name || "Client"}
                    </span>
                    <span className="text-gray-300">|</span>
                    <span className="text-sm text-gray-600 truncate">{b.packages?.name}</span>
                    <span className="text-gray-300">|</span>
                    <span className="text-xs text-gray-500">{b.event_date} {b.time_slot}</span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">Submitted {formatDateTime(b.created_at)}</p>
                  <ClientChecklistSummary booking={b} compact />
                </Link>
                <div className="flex flex-col justify-center gap-1 flex-shrink-0">
                  <Link to={`/admin/bookings/${b.id}`} className="text-[10px] text-[#A98B75] font-medium px-2 py-1 text-center">
                    Review
                  </Link>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(b)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
                    aria-label="Delete booking"
                  >
                    <FaTrash size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Confirmation"
        message={
          deleteTarget
            ? `Delete booking for ${deleteTarget.profiles?.full_name} (${deleteTarget.packages?.name}) on ${deleteTarget.event_date}? This action cannot be undone. ID: ${deleteTarget.id.slice(0, 8)}…`
            : ""
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => !deleting && setDeleteTarget(null)}
      />
    </div>
  );
}
