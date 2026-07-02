import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FaTrash } from "react-icons/fa";
import AdminLayout from "../../components/layout/AdminLayout";
import ConfirmModal from "../../components/ui/ConfirmModal";
import { getAllBookings, deleteBooking } from "../../services/bookings";
import { useAuth } from "../../context/AuthContext";

export default function AdminBookings() {
  const { profile } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    getAllBookings()
      .then(setBookings)
      .catch((err) => setError(err.message || "Failed to load bookings"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteBooking(deleteTarget.id);
      setDeleteTarget(null);
      load();
    } catch (err) {
      setError(err.message || "Failed to delete booking");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AdminLayout>
      <div>
        <h1 className="heading-serif text-4xl font-bold text-[#5B4636] mb-2">Bookings</h1>
        <p className="text-gray-500 mb-8">Manage all client booking requests.</p>

        {profile?.role !== "admin" && (
          <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
            Your account is not set as admin. Run in Supabase SQL:{" "}
            <code className="text-xs">UPDATE profiles SET role = &apos;admin&apos; WHERE email = &apos;your@email.com&apos;;</code>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-gray-400">Loading bookings...</p>
        ) : bookings.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E8E1DA] p-12 text-center">
            <h2 className="text-xl font-semibold text-[#5B4636]">No bookings yet</h2>
            <p className="text-gray-500 mt-2">Bookings will appear here when clients create them.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {bookings.map((b) => (
              <div
                key={b.id}
                className="bg-white rounded-xl border border-[#E8E1DA] p-4 hover:shadow-sm flex items-start justify-between gap-4"
              >
                <Link to={`/admin/bookings/${b.id}`} className="flex-1 min-w-0">
                  <p className="font-medium text-[#5B4636]">
                    {b.profiles?.full_name || "Unknown client"} — {b.packages?.name || "Package"}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {b.event_date} at {b.time_slot} · {b.location || "Studio"}
                  </p>
                  {b.payments?.[0] && (
                    <p className="text-xs text-gray-400 mt-1">
                      Payment: {b.payments[0].status} · ₱{Number(b.payments[0].amount).toLocaleString()}
                    </p>
                  )}
                </Link>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs capitalize px-3 py-1 rounded-full bg-[#A98B75]/10 text-[#A98B75] whitespace-nowrap hidden sm:inline">
                    {(b.status || "unknown").replace(/_/g, " ")}
                  </span>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(b)}
                    className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                    title="Delete booking"
                    aria-label={`Delete booking for ${b.profiles?.full_name}`}
                  >
                    <FaTrash size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete this booking?"
        message={
          deleteTarget
            ? `Permanently delete ${deleteTarget.profiles?.full_name || "client"}'s booking on ${deleteTarget.event_date}? This cannot be undone.`
            : ""
        }
        confirmLabel="Delete booking"
        cancelLabel="Keep booking"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => !deleting && setDeleteTarget(null)}
      />
    </AdminLayout>
  );
}
