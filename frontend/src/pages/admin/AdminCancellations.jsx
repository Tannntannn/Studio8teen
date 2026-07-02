import { useEffect, useState } from "react";
import { FaTrash, FaCheck, FaTimes } from "react-icons/fa";
import AdminLayout from "../../components/layout/AdminLayout";
import ConfirmModal from "../../components/ui/ConfirmModal";
import { getCancellations, verifyCancellationFee } from "../../services/profiles";
import { deleteBooking } from "../../services/bookings";
import { CANCELLATION_FEE } from "../../lib/constants";

const FEE_STATUS_LABELS = {
  awaiting: "Awaiting client payment",
  submitted: "Awaiting verification",
  verified: "Fee verified",
  rejected: "Proof rejected",
  na: "N/A",
};

export default function AdminCancellations() {
  const [items, setItems] = useState([]);
  const [verifyTarget, setVerifyTarget] = useState(null);
  const [notes, setNotes] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const load = () => getCancellations().then(setItems).catch(console.error);

  useEffect(() => {
    load();
  }, []);

  const openVerify = (item) => {
    setVerifyTarget(item);
    setNotes(item.fee_admin_notes || "");
  };

  const handleVerify = async (approved) => {
    if (!verifyTarget) return;
    setVerifying(true);
    try {
      await verifyCancellationFee(verifyTarget.id, approved, notes);
      setVerifyTarget(null);
      load();
    } finally {
      setVerifying(false);
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
          <p className="text-gray-500">Review ₱{CANCELLATION_FEE} cancellation fees — no refunds apply.</p>
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
                    <span className="text-xs px-3 py-1 rounded-full bg-amber-100 text-amber-800">
                      Fee: ₱{Number(c.fee_amount || CANCELLATION_FEE).toLocaleString()} · {FEE_STATUS_LABELS[c.fee_status] || c.fee_status}
                    </span>
                    {c.fee_status === "submitted" && (
                      <button
                        type="button"
                        onClick={() => openVerify(c)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-[#A98B75] text-white hover:bg-[#8a7260]"
                      >
                        Verify fee
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

      {verifyTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#5B4636]/40 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-2xl border border-[#E8E1DA] shadow-2xl overflow-hidden">
            <div className="p-6 text-center">
              <h2 className="heading-serif text-xl font-bold text-[#5B4636]">Cancellation Fee Verification</h2>
              <p className="text-sm text-gray-500 mt-2">
                {verifyTarget.bookings?.profiles?.full_name} · Fee: ₱{Number(verifyTarget.fee_amount || CANCELLATION_FEE).toLocaleString()}
              </p>
              <p className="text-xs text-gray-400 mt-1">Reason: {verifyTarget.reason}</p>
              <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mt-3 inline-block">No refund — fee only</p>

              {verifyTarget.fee_proof_url ? (
                <img src={verifyTarget.fee_proof_url} alt="Payment proof" className="mt-4 max-h-56 rounded-xl border mx-auto" />
              ) : (
                <p className="text-sm text-gray-400 mt-4 p-4 bg-[#F8F6F3] rounded-xl">Client has not uploaded payment proof yet.</p>
              )}

              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Admin notes (optional — shown to client if rejected)"
                rows={2}
                className="w-full mt-4 border border-[#E8E1DA] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#A98B75] text-left"
              />
            </div>
            <div className="flex gap-3 px-6 py-4 bg-[#F8F6F3] border-t border-[#E8E1DA]">
              <button type="button" onClick={() => setVerifyTarget(null)} disabled={verifying} className="flex-1 py-2.5 rounded-xl border bg-white text-sm">
                Cancel
              </button>
              <button type="button" onClick={() => handleVerify(false)} disabled={verifying} className="flex-1 py-2.5 rounded-xl border border-red-200 text-red-600 text-sm flex items-center justify-center gap-1">
                <FaTimes size={12} /> Reject
              </button>
              <button type="button" onClick={() => handleVerify(true)} disabled={verifying || !verifyTarget.fee_proof_url} className="flex-1 py-2.5 rounded-xl bg-green-600 text-white text-sm flex items-center justify-center gap-1 disabled:opacity-50">
                <FaCheck size={12} /> Approve
              </button>
            </div>
          </div>
        </div>
      )}

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
