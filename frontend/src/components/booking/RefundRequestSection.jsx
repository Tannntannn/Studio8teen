import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { useAuth } from "../../context/AuthContext";
import { createRefundRequest, getRefundForBooking } from "../../services/refunds";

const STATUS_LABEL = {
  pending: "Refund pending",
  refunded: "Refunded",
  rejected: "Rejected",
};

export default function RefundRequestSection({ booking, onUpdate }) {
  const { user } = useAuth();
  const [request, setRequest] = useState(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const verified = (booking.payments || []).filter((p) => p.status === "verified");
  const amount = verified.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  useEffect(() => {
    if (!booking?.id) return;
    getRefundForBooking(booking.id).then(setRequest).catch(console.error);
  }, [booking?.id]);

  if (!verified.length) return null;

  const submit = async () => {
    const text = reason.trim();
    if (text.length < 5) {
      Swal.fire({ icon: "warning", title: "Add a reason", text: "Tell the studio why you are requesting a refund." });
      return;
    }
    setSaving(true);
    try {
      const created = await createRefundRequest({
        bookingId: booking.id,
        clientId: user.id,
        amount,
        reason: text,
      });
      setRequest(created);
      setReason("");
      Swal.fire({
        icon: "success",
        title: "Refund requested",
        text: "The studio will review it. This does not cancel the ₱100 cancellation fee if one applies.",
        timer: 2800,
        showConfirmButton: false,
      });
      onUpdate?.();
    } catch (err) {
      Swal.fire({ icon: "error", title: "Could not request a refund", text: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#E8E1DA] p-6">
      <h3 className="font-semibold text-[#5B4636]">Refund request</h3>
      <p className="text-sm text-gray-500 mt-1">
        Verified payments on this booking total ₱{amount.toLocaleString()}. The studio sends any approved refund manually. The ₱100 cancellation fee is separate.
      </p>
      {request ? (
        <div className="mt-4 rounded-xl bg-[#F8F6F3] px-4 py-3 text-sm">
          <p className="font-medium text-[#5B4636]">{STATUS_LABEL[request.status] || request.status}</p>
          <p className="text-gray-600 mt-1">{request.reason}</p>
          {request.admin_note && <p className="text-gray-500 mt-2">Studio note: {request.admin_note}</p>}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why are you requesting a refund?"
            className="w-full border border-[#E8E1DA] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#A98B75]"
          />
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="px-4 py-2.5 rounded-xl bg-[#5B4636] text-white text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Sending..." : "Request refund"}
          </button>
        </div>
      )}
    </div>
  );
}
