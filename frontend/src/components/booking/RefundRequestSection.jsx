import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { useAuth } from "../../context/AuthContext";
import { createRefundRequest, getRefundForBooking } from "../../services/refunds";

const STATUS_LABEL = {
  pending: "Refund pending",
  refunded: "Refunded",
  rejected: "Rejected",
};

const PAYOUT_METHODS = [
  { value: "gcash", label: "GCash" },
  { value: "maya", label: "Maya" },
  { value: "bank", label: "Bank" },
];

const METHOD_LABEL = {
  gcash: "GCash",
  maya: "Maya",
  bank: "Bank",
};

export default function RefundRequestSection({ booking, onUpdate }) {
  const { user } = useAuth();
  const [request, setRequest] = useState(null);
  const [reason, setReason] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("gcash");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [saving, setSaving] = useState(false);

  const verified = (booking.payments || []).filter((p) => p.status === "verified");
  const amount = verified.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const numberLabel = payoutMethod === "bank" ? "Account number" : "Mobile number";

  useEffect(() => {
    if (!booking?.id) return;
    getRefundForBooking(booking.id).then(setRequest).catch(console.error);
  }, [booking?.id]);

  if (!verified.length) return null;

  const submit = async () => {
    const text = reason.trim();
    const name = accountName.trim();
    const number = accountNumber.trim();
    if (!PAYOUT_METHODS.some((method) => method.value === payoutMethod)) {
      Swal.fire({ icon: "warning", title: "Choose where to receive the refund" });
      return;
    }
    if (name.length < 2 || number.length < 5) {
      Swal.fire({
        icon: "warning",
        title: "Add the payout account",
        text: "Enter the account name and the GCash, Maya, or bank number.",
      });
      return;
    }
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
        payoutMethod,
        accountName: name,
        accountNumber: number,
      });
      setRequest(created);
      setReason("");
      Swal.fire({
        icon: "success",
        title: "Refund requested",
        text: "The studio will send the money to the account you entered. An approved refund cancels the booking.",
        timer: 3200,
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
        Verified payments on this booking total ₱{amount.toLocaleString()}. The studio sends this to the account you enter. PayMongo does not send the refund.
      </p>
      <ol className="mt-4 space-y-1.5 text-sm text-[#5B4636] list-decimal pl-5">
        <li>Choose GCash, Maya, or bank, and enter the account name and number.</li>
        <li>The studio reviews the request.</li>
        <li>The studio sends the money to that account.</li>
        <li>Once it is marked refunded, this booking is cancelled and you are notified.</li>
      </ol>
      {request ? (
        <div className="mt-4 rounded-xl bg-[#F8F6F3] px-4 py-3 text-sm">
          <p className="font-medium text-[#5B4636]">{STATUS_LABEL[request.status] || request.status}</p>
          <p className="text-gray-600 mt-1">{request.reason}</p>
          {request.payout_method && (
            <p className="text-gray-600 mt-2">
              {METHOD_LABEL[request.payout_method] || request.payout_method}
              {request.payout_account_name ? ` · ${request.payout_account_name}` : ""}
              {request.payout_account_number ? ` · ${request.payout_account_number}` : ""}
            </p>
          )}
          {request.admin_note && <p className="text-gray-500 mt-2">Studio note: {request.admin_note}</p>}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {PAYOUT_METHODS.map((method) => (
              <button
                key={method.value}
                type="button"
                onClick={() => setPayoutMethod(method.value)}
                className={`rounded-xl border px-3 py-2 text-sm font-medium ${
                  payoutMethod === method.value
                    ? "border-[#A98B75] bg-[#A98B75]/10 text-[#5B4636]"
                    : "border-[#E8E1DA] text-gray-600 hover:bg-[#F8F6F3]"
                }`}
              >
                {method.label}
              </button>
            ))}
          </div>
          <input
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            placeholder="Account name"
            className="w-full border border-[#E8E1DA] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#A98B75]"
          />
          <input
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            placeholder={numberLabel}
            inputMode={payoutMethod === "bank" ? "text" : "tel"}
            className="w-full border border-[#E8E1DA] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#A98B75]"
          />
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
