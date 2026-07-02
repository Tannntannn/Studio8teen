import { useEffect, useState } from "react";
import { createPayment, updatePayment } from "../../services/payments";
import { updateBooking } from "../../services/bookings";
import { getStudioSettings } from "../../services/settings";
import { uploadToCloudinary, CLOUDINARY_FOLDERS } from "../../lib/cloudinary";
import Swal from "sweetalert2";

const STATUS_LABELS = {
  awaiting: "Proof saved — not submitted yet",
  submitted: "Pending verification",
  verified: "Verified",
  rejected: "Rejected — please re-upload",
};

export default function PaymentSection({ booking, onUpdate }) {
  const [settings, setSettings] = useState(null);
  const [paymentType, setPaymentType] = useState("downpayment");
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pendingProof, setPendingProof] = useState(null);
  const payment = booking.payments?.[0];

  useEffect(() => {
    getStudioSettings().then(setSettings).catch(console.error);
  }, []);

  useEffect(() => {
    if (payment?.proof_image_url && payment.status === "awaiting") {
      setPendingProof({ url: payment.proof_image_url, type: payment.payment_type, amount: payment.amount });
    } else {
      setPendingProof(null);
    }
    if (payment?.payment_type) setPaymentType(payment.payment_type);
  }, [payment]);

  const packagePrice = Number(booking.packages?.price || 0);
  const addonsTotal = Number(booking.addons_total || 0);
  const grandTotal = packagePrice + addonsTotal;
  const downPercent = settings?.downpayment_percent || 50;
  const amount =
    paymentType === "full"
      ? grandTotal
      : Math.round(grandTotal * (downPercent / 100));

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { url, publicId } = await uploadToCloudinary(file, CLOUDINARY_FOLDERS.paymentProof(booking.id));

      const payload = {
        payment_type: paymentType,
        amount,
        proof_image_url: url,
        cloudinary_public_id: publicId,
        status: "awaiting",
      };

      if (payment) {
        await updatePayment(payment.id, payload);
      } else {
        await createPayment({ booking_id: booking.id, ...payload });
      }

      setPendingProof({ url, type: paymentType, amount });
      Swal.fire({
        icon: "info",
        title: "Proof uploaded",
        text: "Review your booking details, then click Confirm Booking to submit for admin verification.",
        timer: 3000,
        showConfirmButton: false,
      });
      onUpdate?.();
    } catch (err) {
      Swal.fire({ icon: "error", title: "Upload failed", text: err.message });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleConfirmBooking = async () => {
    if (!payment?.id && !pendingProof) {
      Swal.fire({ icon: "warning", title: "Upload payment proof first" });
      return;
    }

    setConfirming(true);
    try {
      const paymentId = payment?.id;
      if (!paymentId) throw new Error("Payment record not found. Please re-upload your proof.");

      await updatePayment(paymentId, {
        payment_type: paymentType,
        amount,
        status: "submitted",
      });
      await updateBooking(booking.id, { status: "payment_submitted" });
      Swal.fire({
        icon: "success",
        title: "Booking submitted",
        text: "Your booking is now pending admin verification.",
        timer: 2500,
        showConfirmButton: false,
      });
      onUpdate?.();
    } catch (err) {
      Swal.fire({ icon: "error", title: "Submission failed", text: err.message });
    } finally {
      setConfirming(false);
    }
  };

  if (booking.status === "cancelled") {
    return (
      <div className="space-y-3">
        <p className="text-gray-500">This booking was cancelled.</p>
        {booking.notes && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            <span className="font-medium">Reason:</span> {booking.notes}
          </p>
        )}
      </div>
    );
  }

  if (booking.status === "confirmed" || booking.status === "completed") {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <p className="text-green-700 font-medium">Payment verified — booking confirmed!</p>
        {payment && (
          <p className="text-sm text-green-600 mt-1">
            {payment.payment_type === "downpayment" ? "Downpayment" : "Full payment"}: ₱{Number(payment.amount).toLocaleString()} PHP
          </p>
        )}
      </div>
    );
  }

  const canEdit = !payment || payment.status === "awaiting" || payment.status === "rejected";
  const awaitingConfirm = payment?.status === "awaiting" && pendingProof;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-[#5B4636] mb-3">Payment</h3>
        <p className="text-sm text-gray-500 mb-4">
          {settings?.payment_instructions || "Scan the QR code and upload your payment screenshot."}
        </p>

        {settings?.payment_qr_url && (
          <div className="flex justify-center mb-4">
            <img src={settings.payment_qr_url} alt="Payment QR" className="w-48 h-48 object-contain border border-[#E8E1DA] rounded-xl" />
          </div>
        )}
      </div>

      <div className="bg-[#F8F6F3] rounded-xl p-4 text-sm space-y-1">
        <div className="flex justify-between"><span>Package</span><span>₱{packagePrice.toLocaleString()} PHP</span></div>
        {addonsTotal > 0 && <div className="flex justify-between"><span>Add-ons</span><span>₱{addonsTotal.toLocaleString()} PHP</span></div>}
        <div className="flex justify-between font-semibold text-[#5B4636] border-t border-[#E8E1DA] pt-2">
          <span>Total</span><span>₱{grandTotal.toLocaleString()} PHP</span>
        </div>
      </div>

      {payment && (
        <div className="text-sm">
          Status:{" "}
          <span className={`font-medium ${payment.status === "rejected" ? "text-red-600" : "text-[#A98B75]"}`}>
            {STATUS_LABELS[payment.status] || payment.status}
          </span>
          {payment.status === "rejected" && payment.rejection_note && (
            <p className="mt-2 text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              <span className="font-medium">Admin reason:</span> {payment.rejection_note}
            </p>
          )}
        </div>
      )}

      {canEdit && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Payment type</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setPaymentType("downpayment")}
                className={`flex-1 py-3 rounded-xl border text-sm font-medium transition ${
                  paymentType === "downpayment" ? "border-[#A98B75] bg-[#A98B75]/10 text-[#5B4636]" : "border-gray-200 text-gray-600"
                }`}
              >
                Downpayment ({downPercent}%)
                <span className="block text-xs mt-1">₱{Math.round(grandTotal * downPercent / 100).toLocaleString()} PHP</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentType("full")}
                className={`flex-1 py-3 rounded-xl border text-sm font-medium transition ${
                  paymentType === "full" ? "border-[#A98B75] bg-[#A98B75]/10 text-[#5B4636]" : "border-gray-200 text-gray-600"
                }`}
              >
                Full payment
                <span className="block text-xs mt-1">₱{grandTotal.toLocaleString()} PHP</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload payment screenshot (₱{amount.toLocaleString()} PHP)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleUpload}
              disabled={uploading}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-[#A98B75] file:text-white hover:file:bg-[#8a7260]"
            />
            {uploading && <p className="text-sm text-gray-400 mt-2">Uploading...</p>}
          </div>
        </>
      )}

      {(pendingProof?.url || payment?.proof_image_url) && payment?.status !== "verified" && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Payment proof preview</p>
          <img
            src={pendingProof?.url || payment.proof_image_url}
            alt="Payment proof"
            className="max-w-xs rounded-xl border border-[#E8E1DA]"
          />
        </div>
      )}

      {awaitingConfirm && booking.status === "awaiting_payment" && (
        <button
          type="button"
          onClick={handleConfirmBooking}
          disabled={confirming}
          className="w-full py-3 rounded-xl bg-[#5B4636] text-white font-semibold hover:bg-[#4a3829] disabled:opacity-50"
        >
          {confirming ? "Submitting..." : "Confirm Booking"}
        </button>
      )}

      {awaitingConfirm && (
        <p className="text-xs text-gray-500 text-center">
          You can still change your payment type or re-upload proof before confirming.
        </p>
      )}
    </div>
  );
}
