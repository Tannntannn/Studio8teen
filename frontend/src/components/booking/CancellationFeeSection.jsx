import { useEffect, useState } from "react";
import { getStudioSettings } from "../../services/settings";
import { saveCancellationFeeProof, confirmCancellationFeeProof } from "../../services/bookings";
import { uploadToCloudinary, CLOUDINARY_FOLDERS } from "../../lib/cloudinary";
import { CANCELLATION_FEE } from "../../lib/constants";
import Swal from "sweetalert2";

const FEE_STATUS_LABELS = {
  awaiting: "Proof saved — confirm submission below",
  submitted: "Pending admin verification",
  verified: "Fee verified — cancellation approved",
  rejected: "Proof rejected — please re-upload",
};

export default function CancellationFeeSection({ booking, cancellation, onUpdate }) {
  const [settings, setSettings] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pendingProofUrl, setPendingProofUrl] = useState(null);

  useEffect(() => {
    getStudioSettings().then(setSettings).catch(console.error);
  }, []);

  useEffect(() => {
    if (cancellation?.fee_proof_url && cancellation.fee_status === "awaiting") {
      setPendingProofUrl(cancellation.fee_proof_url);
    } else if (cancellation?.fee_status !== "awaiting") {
      setPendingProofUrl(null);
    }
  }, [cancellation]);

  if (!cancellation) return null;

  const feeAmount = Number(cancellation.fee_amount || CANCELLATION_FEE);
  const canUpload =
    booking.status === "cancellation_pending" ||
    (booking.status === "cancellation_submitted" && cancellation.fee_status === "rejected");

  const awaitingConfirm =
    booking.status === "cancellation_pending" &&
    cancellation.fee_status === "awaiting" &&
    (pendingProofUrl || cancellation.fee_proof_url);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { url, publicId } = await uploadToCloudinary(
        file,
        CLOUDINARY_FOLDERS.cancellationProof(booking.id)
      );
      await saveCancellationFeeProof(booking.id, cancellation.id, url, publicId);
      setPendingProofUrl(url);
      Swal.fire({
        icon: "info",
        title: "Proof uploaded",
        text: "Review your proof, then click Confirm Cancellation Fee to submit for admin verification.",
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

  const handleConfirm = async () => {
    if (!pendingProofUrl && !cancellation.fee_proof_url) {
      Swal.fire({ icon: "warning", title: "Upload your payment proof first" });
      return;
    }

    setConfirming(true);
    try {
      await confirmCancellationFeeProof(booking.id, cancellation.id);
      Swal.fire({
        icon: "success",
        title: "Cancellation fee submitted",
        text: "The studio will verify your payment before approving the cancellation.",
        timer: 2800,
        showConfirmButton: false,
      });
      onUpdate?.();
    } catch (err) {
      Swal.fire({ icon: "error", title: "Submission failed", text: err.message });
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-semibold text-[#5B4636] mb-2">Cancellation Fee</h3>
        <p className="text-sm text-gray-500">
          A non-refundable cancellation fee of <strong className="text-[#5B4636]">₱{feeAmount.toLocaleString()}</strong> is
          required. Upload your payment screenshot, then confirm submission below.
        </p>
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mt-3">
          No refund will be issued for downpayments or prior payments once cancellation is approved.
        </p>
      </div>

      <div className="text-sm">
        Status:{" "}
        <span
          className={`font-medium ${
            cancellation.fee_status === "rejected" ? "text-red-600" : "text-[#A98B75]"
          }`}
        >
          {FEE_STATUS_LABELS[cancellation.fee_status] || cancellation.fee_status}
        </span>
        {cancellation.fee_admin_notes && cancellation.fee_status === "rejected" && (
          <p className="text-red-500 mt-1">Note: {cancellation.fee_admin_notes}</p>
        )}
      </div>

      {settings?.payment_qr_url && (
        <div className="flex justify-center">
          <img
            src={settings.payment_qr_url}
            alt="Payment QR"
            className="w-44 h-44 object-contain border border-[#E8E1DA] rounded-xl"
          />
        </div>
      )}

      {settings?.payment_instructions && (
        <p className="text-sm text-gray-500 text-center">{settings.payment_instructions}</p>
      )}

      {canUpload && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Upload cancellation fee proof (₱{feeAmount.toLocaleString()})
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
      )}

      {(pendingProofUrl || cancellation.fee_proof_url) && cancellation.fee_status !== "verified" && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Payment proof preview</p>
          <img
            src={pendingProofUrl || cancellation.fee_proof_url}
            alt="Cancellation fee proof"
            className="max-w-xs rounded-xl border border-[#E8E1DA]"
          />
        </div>
      )}

      {awaitingConfirm && (
        <>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={confirming}
            className="w-full py-3 rounded-xl bg-[#5B4636] text-white font-semibold hover:bg-[#4a3829] disabled:opacity-50"
          >
            {confirming ? "Submitting..." : "Confirm Cancellation Fee"}
          </button>
          <p className="text-xs text-gray-500 text-center">
            You can re-upload a different proof before confirming.
          </p>
        </>
      )}

      {booking.status === "cancellation_submitted" && cancellation.fee_status === "submitted" && (
        <p className="text-sm text-[#5B4636] bg-[#A98B75]/10 border border-[#A98B75]/20 rounded-xl p-4">
          Your cancellation request is on hold. The studio will review your payment and approve or reject the cancellation.
        </p>
      )}
    </div>
  );
}
