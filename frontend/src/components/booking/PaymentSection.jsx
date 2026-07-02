import { useEffect, useState } from "react";
import { getStudioSettings } from "../../services/settings";
import { createPayment, updatePayment } from "../../services/payments";
import { updateBooking } from "../../services/bookings";
import { uploadToCloudinary, CLOUDINARY_FOLDERS } from "../../lib/cloudinary";
import Swal from "sweetalert2";

const STATUS_LABELS = {
  awaiting: "Awaiting payment",
  submitted: "Pending verification",
  verified: "Verified",
  rejected: "Rejected — please re-upload",
};

export default function PaymentSection({ booking, onUpdate }) {
  const [settings, setSettings] = useState(null);
  const [paymentType, setPaymentType] = useState("downpayment");
  const [uploading, setUploading] = useState(false);
  const payment = booking.payments?.[0];

  useEffect(() => {
    getStudioSettings().then(setSettings).catch(console.error);
  }, []);

  const packagePrice = Number(booking.packages?.price || 0);
  const downPercent = settings?.downpayment_percent || 50;
  const amount =
    paymentType === "full"
      ? packagePrice
      : Math.round(packagePrice * (downPercent / 100));

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { url, publicId } = await uploadToCloudinary(
        file,
        CLOUDINARY_FOLDERS.paymentProof(booking.id)
      );

      if (payment) {
        await updatePayment(payment.id, {
          payment_type: paymentType,
          amount,
          proof_image_url: url,
          cloudinary_public_id: publicId,
          status: "submitted",
        });
      } else {
        await createPayment({
          booking_id: booking.id,
          payment_type: paymentType,
          amount,
          proof_image_url: url,
          cloudinary_public_id: publicId,
          status: "submitted",
        });
      }

      await updateBooking(booking.id, { status: "payment_submitted" });
      Swal.fire({ icon: "success", title: "Payment proof uploaded", text: "Admin will verify shortly.", timer: 2500, showConfirmButton: false });
      onUpdate?.();
    } catch (err) {
      Swal.fire({ icon: "error", title: "Upload failed", text: err.message });
    } finally {
      setUploading(false);
    }
  };

  if (booking.status === "cancelled") {
    return <p className="text-gray-500">This booking was cancelled.</p>;
  }

  if (booking.status === "confirmed" || booking.status === "completed") {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <p className="text-green-700 font-medium">Payment verified — booking confirmed!</p>
        {payment && (
          <p className="text-sm text-green-600 mt-1">
            {payment.payment_type === "downpayment" ? "Downpayment" : "Full payment"}: ₱{Number(payment.amount).toLocaleString()}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-[#5B4636] mb-3">Payment</h3>
        <p className="text-sm text-gray-500 mb-4">
          {settings?.payment_instructions || "Scan the QR code and upload your payment screenshot."}
        </p>

        {settings?.payment_qr_url && (
          <div className="flex justify-center mb-4">
            <img
              src={settings.payment_qr_url}
              alt="Payment QR"
              className="w-48 h-48 object-contain border border-[#E8E1DA] rounded-xl"
            />
          </div>
        )}

        {!settings?.payment_qr_url && (
          <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-xl">
            Payment QR not configured yet. Contact the studio or check back soon.
          </p>
        )}
      </div>

      {payment && (
        <div className="text-sm">
          Status:{" "}
          <span className={`font-medium ${payment.status === "rejected" ? "text-red-600" : "text-[#A98B75]"}`}>
            {STATUS_LABELS[payment.status] || payment.status}
          </span>
          {payment.rejection_note && (
            <p className="text-red-500 mt-1">Note: {payment.rejection_note}</p>
          )}
        </div>
      )}

      {(!payment || payment.status === "rejected" || payment.status === "awaiting") && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Payment type</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setPaymentType("downpayment")}
                className={`flex-1 py-3 rounded-xl border text-sm font-medium transition ${
                  paymentType === "downpayment"
                    ? "border-[#A98B75] bg-[#A98B75]/10 text-[#5B4636]"
                    : "border-gray-200 text-gray-600"
                }`}
              >
                Downpayment ({downPercent}%)
                <span className="block text-xs mt-1">₱{Math.round(packagePrice * downPercent / 100).toLocaleString()}</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentType("full")}
                className={`flex-1 py-3 rounded-xl border text-sm font-medium transition ${
                  paymentType === "full"
                    ? "border-[#A98B75] bg-[#A98B75]/10 text-[#5B4636]"
                    : "border-gray-200 text-gray-600"
                }`}
              >
                Full payment
                <span className="block text-xs mt-1">₱{packagePrice.toLocaleString()}</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload payment screenshot (₱{amount.toLocaleString()})
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

      {payment?.proof_image_url && payment.status !== "verified" && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Submitted proof</p>
          <img src={payment.proof_image_url} alt="Payment proof" className="max-w-xs rounded-xl border border-[#E8E1DA]" />
        </div>
      )}
    </div>
  );
}
