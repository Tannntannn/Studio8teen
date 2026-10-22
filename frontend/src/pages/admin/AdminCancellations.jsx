import { useEffect, useState } from "react";
import { FaTrash } from "react-icons/fa";
import AdminLayout from "../../components/layout/AdminLayout";
import ConfirmModal from "../../components/ui/ConfirmModal";
import { getCancellations } from "../../services/profiles";
import { cancelBookingFree, deleteBooking } from "../../services/bookings";

const OPEN_CANCEL_STATUSES = ["cancellation_pending", "cancellation_submitted", "confirmed", "pending"];

export default function AdminCancellations() {
  const [items, setItems] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [finishingId, setFinishingId] = useState(null);

  const load = () => getCancellations().then(setItems).catch(console.error);

  useEffect(() => {
    load();
  }, []);

  const finishCancellation = async (item) => {
    const bookingId = item.booking_id || item.bookings?.id;
    if (!bookingId) return;
    setFinishingId(item.id);
    try {
      await cancelBookingFree(bookingId, item.reason || "Cancelled");
      load();
    } finally {
      setFinishingId(null);
    }
  };

  const handleDeleteBooking = async () => {
    const bookingId = deleteTarget?.booking_id || deleteTarget?.bookings?.id;
    if (!bookingId) return;
    setDeleting(true);
    try {
      await deleteBooking(bookingId);
      setDeleteTarget(null);
      load();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto w-full">
        <div className="text-center mb-8">
          <h1 className="heading-serif text-4xl font-bold text-[#5B4636] mb-2">Cancellation Tracking</h1>
          <p className="text-gray-500">Cancellations take effect immediately. There is no cancellation fee.</p>
        </div>

        {items.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E8E1DA] p-12 text-center text-gray-400">
            No cancellations recorded.
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((c) => (
              <div key={c.id} className="bg-white rounded-2xl border border-[#E8E1DA] p-5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:justify-between gap-4 items-center text-center sm:text-left">
                  <div className="flex-1">
                    <p className="font-semibold text-[#5B4636]">
                      {c.bookings?.profiles?.full_name} — {c.bookings?.packages?.name}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">{c.bookings?.event_date}</p>
                    <p className="text-sm mt-2 text-gray-700">Reason: {c.reason}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(c.cancelled_at).toLocaleString()} · Booking: {c.bookings?.status?.replace(/_/g, " ")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center justify-center">
                    {OPEN_CANCEL_STATUSES.includes(c.bookings?.status) && (
                      <button
                        type="button"
                        disabled={finishingId === c.id}
                        onClick={() => finishCancellation(c)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-[#A98B75] text-white hover:bg-[#8a7260] disabled:opacity-50"
                      >
                        {finishingId === c.id ? "Cancelling..." : "Cancel booking"}
                      </button>
                    )}
                    {c.bookings?.status === "cancelled" && (
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(c)}
                        className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
                        title="Delete booking"
                      >
                        <FaTrash size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete cancelled booking?"
        message={
          deleteTarget
            ? `Permanently delete ${deleteTarget.bookings?.profiles?.full_name}'s cancelled booking? All related records will be removed.`
            : ""
        }
        confirmLabel="Delete booking"
        variant="danger"
        loading={deleting}
        onConfirm={handleDeleteBooking}
        onCancel={() => !deleting && setDeleteTarget(null)}
      />
    </AdminLayout>
  );
}
