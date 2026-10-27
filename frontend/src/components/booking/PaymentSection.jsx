import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { createPayment, updatePayment, startPaymongoCheckout, syncPaymongoCheckout } from "../../services/payments";
import { uploadToCloudinary, CLOUDINARY_FOLDERS } from "../../lib/cloudinary";
import { updateBooking } from "../../services/bookings";
import { getStudioSettings } from "../../services/settings";
import { RESERVATION_FEE } from "../../lib/constants";
import { mobilizationLabel, mobilizationTotal } from "../../lib/mobilization";
import { useAuth } from "../../context/AuthContext";
import Swal from "sweetalert2";

const STATUS_LABELS = {
  awaiting: "Awaiting payment",
  submitted: "Pending verification",
  verified: "Paid",
  rejected: "Payment unsuccessful — please try again",
};

export default function PaymentSection({ booking, onUpdate }) {
  const { isGuest } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [settings, setSettings] = useState(null);
  const [paymentType, setPaymentType] = useState("downpayment");
  const [method, setMethod] = useState("paymongo");
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [proofFile, setProofFile] = useState(null);
  const [proofPreview, setProofPreview] = useState("");
  const payment = booking.payments?.[0];
  const isWalkIn = Boolean(booking.is_walk_in || isGuest || booking.profiles?.is_guest);
  const cashSelected = method === "cash";
  const manualSelected = method === "manual";

  useEffect(() => {
    getStudioSettings().then(setSettings).catch(console.error);
  }, []);

  useEffect(() => {
    if (payment?.payment_type) setPaymentType(payment.payment_type);
    if (payment?.payment_method === "manual" || payment?.notes?.toLowerCase().includes("studio qr")) {
      setMethod("manual");
    } else if (payment?.payment_method === "cash" || payment?.notes?.toLowerCase().includes("cash")) {
      setMethod("cash");
    }
  }, [payment]);

  useEffect(() => {
    const flag = searchParams.get("paymongo");
    if (!flag || !booking?.id) return;
    const purpose = searchParams.get("fee") === "cancellation" ? "cancellation" : "booking";

    const clean = () => {
      const next = new URLSearchParams(searchParams);
      next.delete("paymongo");
      next.delete("fee");
      setSearchParams(next, { replace: true });
    };

    if (flag === "cancelled") {
      Swal.fire({
        icon: "info",
        title: "Payment cancelled",
        text: "You can pay again whenever you are ready.",
        timer: 2800,
        showConfirmButton: false,
      });
      clean();
      return;
    }

    if (flag !== "success") return;

    if (purpose === "cancellation") {
      Swal.fire({
        icon: "info",
        title: "No cancellation fee",
        text: "Cancellation fees are no longer charged. Cancel the booking from this page.",
        timer: 3200,
        showConfirmButton: false,
      });
      clean();
      return;
    }

    let cancelled = false;
    setSyncing(true);
    (async () => {
      try {
        const result = await syncPaymongoCheckout(booking.id, purpose);
        if (cancelled) return;
        if (result?.paid || result?.already_paid) {
          Swal.fire({
            icon: "success",
            title: "Payment received",
            text: "Payment received. Upload the screenshot below so the studio can verify it.",
            timer: 2800,
            showConfirmButton: false,
          });
          onUpdate?.();
        } else {
          Swal.fire({
            icon: "info",
            title: "Confirming payment…",
            text: "This can take a few seconds. You can refresh if the status does not update yet.",
            timer: 3200,
            showConfirmButton: false,
          });
          onUpdate?.();
        }
      } catch (err) {
        if (!cancelled) {
          Swal.fire({ icon: "error", title: "Could not confirm payment", text: err.message });
        }
      } finally {
        if (!cancelled) setSyncing(false);
        clean();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [booking?.id]);

  const packagePrice = Number(booking.packages?.price || 0);
  const addonsTotal = Number(booking.addons_total || 0);
  const mobilizationItems = Array.isArray(booking.mobilization_items) ? booking.mobilization_items : [];
  const mobilizationFee = mobilizationItems.length
    ? mobilizationTotal(mobilizationItems)
    : Number(booking.mobilization_fee || 0);
  const grandTotal = packagePrice + addonsTotal + mobilizationFee;
  const downPercent = settings?.downpayment_percent || 50;
  const sessionAmount =
    paymentType === "full" ? grandTotal : Math.round((grandTotal * downPercent) / 100);
  const amount = sessionAmount + RESERVATION_FEE;

  const saveCashRecord = async () => {
    const payload = {
      payment_type: paymentType,
      amount,
      status: "awaiting",
      notes: "Paid via Cash (walk-in)",
      payment_method: "cash",
      proof_image_url: null,
      cloudinary_public_id: null,
    };
    if (payment) return updatePayment(payment.id, payload);
    return createPayment({ booking_id: booking.id, ...payload });
  };

  const handleSaveCash = async () => {
    setUploading(true);
    try {
      await saveCashRecord();
      Swal.fire({
        icon: "info",
        title: "Cash payment recorded",
        text: "Click Confirm Booking so the studio can verify your walk-in cash payment.",
        timer: 3000,
        showConfirmButton: false,
      });
      onUpdate?.();
    } catch (err) {
      Swal.fire({ icon: "error", title: "Could not save cash payment", text: err.message });
    } finally {
      setUploading(false);
    }
  };

  const handlePaymongo = async () => {
    setUploading(true);
    try {
      const result = await startPaymongoCheckout({
        bookingId: booking.id,
        paymentType,
      });
      if (result?.already_paid) {
        onUpdate?.();
        return;
      }
      if (!result?.checkout_url) throw new Error("No checkout URL returned.");
      window.location.href = result.checkout_url;
    } catch (err) {
      Swal.fire({ icon: "error", title: "Checkout failed", text: err.message });
      setUploading(false);
    }
  };

  const handleManualSubmit = async () => {
    if (!settings?.payment_qr_url && !settings?.bank_account_number) {
      Swal.fire({ icon: "info", title: "Studio payment details are not posted yet" });
      return;
    }
    if (!proofFile && !payment?.proof_image_url) {
      Swal.fire({ icon: "warning", title: "Screenshot required", text: "Upload a screenshot of the payment." });
      return;
    }
    setUploading(true);
    try {
      let proofUrl = payment?.proof_image_url || null;
      let publicId = payment?.cloudinary_public_id || null;
      if (proofFile) {
        const uploaded = await uploadToCloudinary(proofFile, CLOUDINARY_FOLDERS.paymentProof(booking.id));
        proofUrl = uploaded.url;
        publicId = uploaded.publicId;
      }
      const payload = {
        payment_type: paymentType,
        amount,
        status: "submitted",
        notes: "Paid via studio QR",
        payment_method: "manual",
        proof_image_url: proofUrl,
        cloudinary_public_id: publicId,
      };
      if (payment) await updatePayment(payment.id, payload);
      else await createPayment({ booking_id: booking.id, ...payload });
      await updateBooking(booking.id, { status: "payment_submitted" });
      setProofFile(null);
      if (proofPreview) URL.revokeObjectURL(proofPreview);
      setProofPreview("");
      Swal.fire({
        icon: "success",
        title: "Transfer submitted",
        text: "The studio will verify your payment screenshot.",
        timer: 2500,
        showConfirmButton: false,
      });
      onUpdate?.();
    } catch (err) {
      Swal.fire({ icon: "error", title: "Could not submit transfer", text: err.message });
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmCash = async () => {
    setConfirming(true);
    try {
      let paymentId = payment?.id;
      if (!paymentId) {
        const created = await saveCashRecord();
        paymentId = created.id;
      }
      await updatePayment(paymentId, {
        payment_type: paymentType,
        amount,
        status: "submitted",
        notes: "Paid via Cash (walk-in)",
        payment_method: "cash",
      });
      await updateBooking(booking.id, { status: "payment_submitted" });
      Swal.fire({
        icon: "success",
        title: "Booking submitted",
        text: "Your cash payment is pending studio verification.",
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

  const handleReceiptUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !payment?.id) return;
    setUploading(true);
    try {
      const { url, publicId } = await uploadToCloudinary(file, CLOUDINARY_FOLDERS.paymentProof(booking.id));
      await updatePayment(payment.id, {
        proof_image_url: url,
        cloudinary_public_id: publicId,
      });
      Swal.fire({
        icon: "success",
        title: "Screenshot uploaded",
        text: "The studio can now verify this payment.",
        timer: 2200,
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

  const chooseProof = (file) => {
    if (proofPreview) URL.revokeObjectURL(proofPreview);
    setProofFile(file || null);
    setProofPreview(file ? URL.createObjectURL(file) : "");
  };

  const screenshotPicker = (onFile, previewUrl) => (
    <label className="flex flex-col items-center justify-center gap-3 min-h-[220px] rounded-2xl border-2 border-dashed border-[#A98B75] bg-[#A98B75]/10 px-6 py-8 text-center cursor-pointer hover:bg-[#A98B75]/15">
      {previewUrl ? (
        <img src={previewUrl} alt="Selected payment screenshot" className="max-h-56 rounded-xl border border-[#E8E1DA] bg-white object-contain" />
      ) : (
        <>
          <span className="text-lg font-semibold text-[#5B4636]">Upload payment screenshot</span>
          <span className="max-w-sm text-sm text-gray-600">
            Tap here and choose the GCash, Maya, or bank receipt photo. The studio uses it to verify this payment.
          </span>
        </>
      )}
      <span className="inline-flex px-5 py-2.5 rounded-full bg-[#A98B75] text-white text-sm font-semibold">
        {previewUrl ? "Change screenshot" : "Choose screenshot"}
      </span>
      <input
        type="file"
        accept="image/*"
        className="hidden"
        disabled={uploading}
        onChange={(event) => {
          onFile(event.target.files?.[0] || null);
          event.target.value = "";
        }}
      />
    </label>
  );

  const receiptBlock = payment?.status === "verified" && (
    <div className="mt-4">
      {payment.proof_image_url ? (
        <div>
          <p className="text-sm font-semibold text-[#5B4636] mb-2">Payment screenshot</p>
          <img
            src={payment.proof_image_url}
            alt="Payment screenshot"
            className="max-h-80 w-full rounded-xl border border-[#E8E1DA] object-contain bg-white"
          />
        </div>
      ) : (
        screenshotPicker(async (file) => {
          if (!file) return;
          const input = { target: { files: [file], value: "" } };
          await handleReceiptUpload(input);
        }, "")
      )}
    </div>
  );

  if (booking.status === "pending" && payment?.status === "verified") {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-amber-800 font-medium">
          {payment.proof_image_url
            ? "Screenshot sent. Waiting for the studio to confirm your booking."
            : "Payment received. Upload the screenshot so the studio can verify it."}
        </p>
        <p className="text-sm text-amber-700 mt-1">
          {payment.payment_type === "downpayment" ? "Downpayment" : "Full payment"}: ₱
          {Number(payment.amount).toLocaleString()} PHP
        </p>
        {receiptBlock}
      </div>
    );
  }

  if (booking.status === "confirmed" || booking.status === "completed") {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <p className="text-green-700 font-medium">Payment verified — booking confirmed!</p>
        {payment && (
          <p className="text-sm text-green-600 mt-1">
            {payment.payment_type === "downpayment" ? "Downpayment" : "Full payment"}: ₱
            {Number(payment.amount).toLocaleString()} PHP
            {payment.notes && payment.notes.length <= 80 ? ` · ${payment.notes}` : ""}
          </p>
        )}
        {receiptBlock}
      </div>
    );
  }

  const canEdit = !payment || payment.status === "awaiting" || payment.status === "rejected";
  const cashAwaiting =
    cashSelected &&
    payment?.status === "awaiting" &&
    payment?.notes?.toLowerCase().includes("cash");

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-[#5B4636] mb-3">Payment</h3>
        <p className="text-sm text-gray-500 mb-4">
          {cashSelected
            ? "Pay in cash at the studio, then confirm so the team can verify your walk-in."
            : manualSelected
              ? "Send the payment to the studio account or scan the QR, then upload the screenshot for verification."
              : "Pay with GCash, Maya, or card. After checkout, upload a screenshot so the studio can verify the payment."}
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          <button
            type="button"
            onClick={() => setMethod("paymongo")}
            className={`px-3 py-2 rounded-xl border text-sm font-medium transition ${
              method === "paymongo"
                ? "border-[#A98B75] bg-[#A98B75]/10 text-[#5B4636]"
                : "border-[#E8E1DA] text-gray-600 hover:bg-[#F8F6F3]"
            }`}
          >
            GCash / Maya / Card
          </button>
          <button
            type="button"
            onClick={() => setMethod("manual")}
            className={`px-3 py-2 rounded-xl border text-sm font-medium transition ${
              manualSelected
                ? "border-[#A98B75] bg-[#A98B75]/10 text-[#5B4636]"
                : "border-[#E8E1DA] text-gray-600 hover:bg-[#F8F6F3]"
            }`}
          >
            Studio QR / bank
          </button>
          {isWalkIn && (
            <button
              type="button"
              onClick={() => setMethod("cash")}
              className={`px-3 py-2 rounded-xl border text-sm font-medium transition ${
                cashSelected
                  ? "border-[#A98B75] bg-[#A98B75]/10 text-[#5B4636]"
                  : "border-[#E8E1DA] text-gray-600 hover:bg-[#F8F6F3]"
              }`}
            >
              Cash
            </button>
          )}
        </div>

        {cashSelected ? (
          <div className="text-sm text-[#5B4636] bg-[#F8F6F3] border border-[#E8E1DA] rounded-xl px-4 py-3 mb-4">
            Pay in cash at the studio counter. No online checkout required.
          </div>
        ) : manualSelected ? (
          <div className="text-sm text-[#5B4636] bg-[#F8F6F3] border border-[#E8E1DA] rounded-xl px-4 py-3 mb-4">
            Pay the amount due using the account or QR below, then upload a screenshot.
          </div>
        ) : (
          <div className="text-sm text-[#5B4636] bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
            A ₱{RESERVATION_FEE.toLocaleString()} reservation fee is added on top of your downpayment or full payment. After you pay, upload a screenshot for the studio to verify.
          </div>
        )}
      </div>

      <div className="bg-[#F8F6F3] rounded-xl p-4 text-sm space-y-1">
        <div className="flex justify-between">
          <span>Package</span>
          <span>₱{packagePrice.toLocaleString()} PHP</span>
        </div>
        {addonsTotal > 0 && (
          <div className="flex justify-between">
            <span>Add-ons</span>
            <span>₱{addonsTotal.toLocaleString()} PHP</span>
          </div>
        )}
        {mobilizationItems.length > 0 ? mobilizationItems.map((item) => (
          <div key={item.id} className="flex justify-between">
            <span>{mobilizationLabel(item)}</span>
            <span>₱{Number(item.price || 0).toLocaleString()} PHP</span>
          </div>
        )) : mobilizationFee > 0 && (
          <div className="flex justify-between">
            <span>Mobilization fee</span>
            <span>₱{mobilizationFee.toLocaleString()} PHP</span>
          </div>
        )}
        <div className="flex justify-between border-t border-[#E8E1DA] pt-2">
          <span>{paymentType === "full" ? "Full payment" : `Downpayment (${downPercent}%)`}</span>
          <span>₱{sessionAmount.toLocaleString()} PHP</span>
        </div>
        <div className="flex justify-between text-amber-800">
          <span>Reservation fee</span>
          <span>₱{RESERVATION_FEE.toLocaleString()} PHP</span>
        </div>
        <div className="flex justify-between font-semibold text-[#5B4636] border-t border-[#E8E1DA] pt-2">
          <span>Amount due</span>
          <span>₱{amount.toLocaleString()} PHP</span>
        </div>
      </div>

      {payment && (
        <div className="text-sm">
          Status:{" "}
          <span className={`font-medium ${payment.status === "rejected" ? "text-red-600" : "text-[#A98B75]"}`}>
            {STATUS_LABELS[payment.status] || payment.status}
          </span>
          {payment.notes && <p className="mt-1 text-gray-500">{payment.notes}</p>}
          {syncing && <p className="mt-1 text-gray-400">Confirming payment…</p>}
        </div>
      )}

      {payment?.status === "submitted" && payment.proof_image_url && (
        <div>
          <p className="text-sm font-semibold text-[#5B4636] mb-2">Screenshot sent for verification</p>
          <img
            src={payment.proof_image_url}
            alt="Payment screenshot"
            className="max-h-80 w-full rounded-xl border border-[#E8E1DA] object-contain bg-white"
          />
        </div>
      )}

      {receiptBlock}

      {canEdit && (
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
                <span className="block text-xs mt-1">
                  ₱{(Math.round((grandTotal * downPercent) / 100) + RESERVATION_FEE).toLocaleString()} PHP
                </span>
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
                <span className="block text-xs mt-1">₱{(grandTotal + RESERVATION_FEE).toLocaleString()} PHP</span>
              </button>
            </div>
          </div>

          {manualSelected ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-[#E8E1DA] bg-white p-4 text-sm">
                {settings?.bank_account_name && (
                  <p className="text-[#5B4636]"><span className="text-gray-500">Account name:</span> {settings.bank_account_name}</p>
                )}
                {settings?.bank_account_number && (
                  <p className="text-[#5B4636] mt-1"><span className="text-gray-500">Account number:</span> {settings.bank_account_number}</p>
                )}
                {settings?.payment_qr_url ? (
                  <img src={settings.payment_qr_url} alt="Studio payment QR" className="mt-3 mx-auto max-h-56 rounded-lg border border-[#E8E1DA]" />
                ) : (
                  !settings?.bank_account_number && (
                    <p className="text-gray-500">The studio has not posted a QR or account number yet.</p>
                  )
                )}
              </div>
              {screenshotPicker(chooseProof, proofPreview)}
              <button
                type="button"
                onClick={handleManualSubmit}
                disabled={uploading}
                className="w-full py-3 rounded-xl bg-[#5B4636] text-white font-semibold hover:bg-[#4a3829] disabled:opacity-50"
              >
                {uploading ? "Submitting..." : `Submit payment proof (₱${amount.toLocaleString()} PHP)`}
              </button>
            </div>
          ) : cashSelected ? (
            <button
              type="button"
              onClick={handleSaveCash}
              disabled={uploading}
              className="w-full py-3 rounded-xl border border-[#A98B75] text-[#5B4636] font-semibold hover:bg-[#A98B75]/10 disabled:opacity-50"
            >
              {uploading ? "Saving..." : `Record cash payment (₱${amount.toLocaleString()} PHP)`}
            </button>
          ) : (
            <button
              type="button"
              onClick={handlePaymongo}
              disabled={uploading || syncing}
              className="w-full py-3 rounded-xl bg-[#A98B75] text-white font-semibold hover:bg-[#8a7260] disabled:opacity-50"
            >
              {uploading ? "Redirecting to checkout..." : `Pay ₱${amount.toLocaleString()} PHP`}
            </button>
          )}
        </>
      )}

      {cashAwaiting && booking.status === "awaiting_payment" && (
        <button
          type="button"
          onClick={handleConfirmCash}
          disabled={confirming}
          className="w-full py-3 rounded-xl bg-[#5B4636] text-white font-semibold hover:bg-[#4a3829] disabled:opacity-50"
        >
          {confirming ? "Submitting..." : "Confirm Booking"}
        </button>
      )}
    </div>
  );
}
