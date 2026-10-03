import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Swal from "sweetalert2";
import { FaDownload, FaQrcode } from "react-icons/fa";
import QRCode from "qrcode";
import ClientLayout from "../../components/layout/ClientLayout";
import PaymentSection from "../../components/booking/PaymentSection";
import CancellationFeeSection from "../../components/booking/CancellationFeeSection";
import { useAuth } from "../../context/AuthContext";
import { getBooking, requestCancellation, cancelBookingFree } from "../../services/bookings";
import { getChecklist, updateChecklist } from "../../services/gallery";
import { getChecklistProgress, getChecklistTasks, formatCheckedAt } from "../../lib/checklist";
import { downloadBookingReceipt, downloadBookingQr, bookingHasQr } from "../../lib/bookingReceipt";
import { CANCELLATION_FEE } from "../../lib/constants";
import { formatTime12h } from "../../lib/dateUtils";

const CANCEL_REASONS = [
  "Schedule conflict",
  "Change of plans",
  "Personal emergency",
  "Weather or venue issue",
  "Booked by mistake",
  "Others",
];

export default function BookingDetail() {
  const { id } = useParams();
  const { profile } = useAuth();
  const [booking, setBooking] = useState(null);
  const [checklist, setChecklist] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [downloadingQr, setDownloadingQr] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reasonChoice, setReasonChoice] = useState(CANCEL_REASONS[0]);
  const [otherReason, setOtherReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const load = () => {
    getBooking(id).then(async (b) => {
      setBooking(b);
      const cl = await getChecklist(id);
      setChecklist(cl);
      if (b.qr_token && ["confirmed", "completed"].includes(b.status)) {
        const verifyUrl = `${window.location.origin}/verify/${b.qr_token}`;
        QRCode.toDataURL(verifyUrl, { width: 200 }).then(setQrDataUrl);
      } else {
        setQrDataUrl("");
      }
    }).catch(console.error);
  };

  useEffect(() => { load(); }, [id]);

  const toggleTask = async (index) => {
    if (!checklist) return;
    const tasks = checklist.tasks.map((t, i) => {
      if (i !== index) return t;
      const checked = !t.checked;
      return { ...t, checked, checked_at: checked ? new Date().toISOString() : null };
    });
    const updated = await updateChecklist(id, tasks);
    setChecklist(updated);
  };

  const handleCancel = () => {
    setReasonChoice(CANCEL_REASONS[0]);
    setOtherReason("");
    setCancelOpen(true);
  };

  const submitCancel = async () => {
    const reason = reasonChoice === "Others" ? otherReason.trim() : reasonChoice;
    if (!reason) {
      Swal.fire({ icon: "warning", title: "Type your reason", text: "Others needs a short explanation." });
      return;
    }
    const needsFee = booking.status === "confirmed";
    setCancelling(true);
    try {
      if (!needsFee) {
        await cancelBookingFree(id, reason);
        Swal.fire({ icon: "success", title: "Booking cancelled", timer: 2000, showConfirmButton: false });
      } else {
        await requestCancellation(id, reason);
        Swal.fire({
          icon: "info",
          title: "Cancellation requested",
          text: "Pay the ₱100 cancellation fee, then upload your receipt below.",
          timer: 3000,
          showConfirmButton: false,
        });
      }
      setCancelOpen(false);
      load();
    } catch (err) {
      Swal.fire({ icon: "error", title: "Could not cancel", text: err.message });
    } finally {
      setCancelling(false);
    }
  };

  const handleDownloadQr = async () => {
    setDownloadingQr(true);
    try {
      await downloadBookingQr(booking);
      Swal.fire({
        icon: "success",
        title: "QR downloaded",
        text: "PNG saved to your downloads folder.",
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire({ icon: "error", title: "Download failed", text: err.message });
    } finally {
      setDownloadingQr(false);
    }
  };

  const handleDownloadReceipt = async () => {
    setDownloading(true);
    try {
      await downloadBookingReceipt(booking, profile);
      Swal.fire({
        icon: "success",
        title: "Receipt downloaded",
        text: "Your PDF receipt has been saved.",
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire({ icon: "error", title: "Download failed", text: err.message });
    } finally {
      setDownloading(false);
    }
  };

  if (!booking) {
    return (
      <ClientLayout>
        <div className="max-w-3xl mx-auto text-gray-500">Loading booking...</div>
      </ClientLayout>
    );
  }

  const tasks = getChecklistTasks(checklist);
  const { checked, total, percent } = getChecklistProgress(tasks);
  const cancellation = booking.cancellations?.[0];
  const inCancellationFlow = ["cancellation_pending", "cancellation_submitted"].includes(booking.status);

  return (
    <ClientLayout>
      <div className="max-w-3xl mx-auto w-full">
        <div className="text-center mb-6">
          <Link to="/client-bookings" className="text-[#A98B75] text-sm hover:underline">← Back to bookings</Link>
        </div>

        <div className="mb-8 text-center">
          <h1 className="heading-serif text-3xl font-bold text-[#5B4636]">{booking.packages?.name}</h1>
          <p className="text-gray-500 mt-1">{booking.event_date} at {formatTime12h(booking.time_slot)} — {booking.location}</p>
          <span className="inline-block mt-2 text-xs px-3 py-1 rounded-full bg-[#A98B75]/10 text-[#A98B75] font-medium capitalize">
            {booking.status.replace(/_/g, " ")}
          </span>
          {booking.is_walk_in && (
            <span className="inline-block mt-2 ml-2 text-xs px-3 py-1 rounded-full bg-sky-100 text-sky-800 font-medium">
              Walk-in
            </span>
          )}
          {!inCancellationFlow && booking.status !== "cancelled" && !bookingHasQr(booking) && (
            <button
              type="button"
              onClick={handleDownloadReceipt}
              disabled={downloading}
              className="mt-3 inline-flex items-center gap-2 text-sm text-[#A98B75] hover:underline disabled:opacity-50"
            >
              <FaDownload size={13} /> {downloading ? "Generating PDF..." : "Download PDF receipt"}
            </button>
          )}
        </div>

        <div className="space-y-6">
          {inCancellationFlow && cancellation && (
            <div className="bg-white rounded-2xl border border-amber-200 p-6">
              <CancellationFeeSection booking={booking} cancellation={cancellation} onUpdate={load} />
            </div>
          )}

          {checklist && !inCancellationFlow && (
            <div className="bg-white rounded-2xl border border-[#E8E1DA] p-6">
              <div className="flex justify-between items-start mb-1">
                <h3 className="font-semibold text-[#5B4636]">Event Preparation Checklist</h3>
                <span className="text-xs font-medium text-[#A98B75]">{checked}/{total} done</span>
              </div>
              <p className="text-xs text-gray-500 mb-4">
                Check off items as you prepare — your progress is visible to the studio when verifying payment.
              </p>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-4">
                <div className="h-full bg-[#A98B75] rounded-full transition-all" style={{ width: `${percent}%` }} />
              </div>
              <ul className="space-y-3">
                {tasks.map((task, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={task.checked}
                      onChange={() => toggleTask(i)}
                      className="rounded mt-1 accent-[#A98B75]"
                    />
                    <div>
                      <span className={task.checked ? "line-through text-gray-400" : "text-gray-700"}>{task.label}</span>
                      {task.checked && task.checked_at && (
                        <p className="text-[10px] text-gray-400 mt-0.5">Checked {formatCheckedAt(task.checked_at)}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!inCancellationFlow && booking.status !== "cancelled" && (
            <div className="bg-white rounded-2xl border border-[#E8E1DA] p-6">
              <PaymentSection booking={booking} onUpdate={load} />
            </div>
          )}

          {(booking.status === "confirmed" || booking.status === "completed") && qrDataUrl && (
            <div className="bg-white rounded-2xl border border-[#E8E1DA] p-6 text-center">
              <h3 className="font-semibold text-[#5B4636] mb-2 flex items-center justify-center gap-2">
                <FaQrcode className="text-[#A98B75]" /> Booking Verification QR
              </h3>
              <p className="text-xs text-gray-500 mb-4 max-w-sm mx-auto">
                Show this at the studio on session day. Staff can scan it to confirm this is a real confirmed booking.
              </p>
              <img src={qrDataUrl} alt="Booking QR" className="mx-auto rounded-lg border border-[#E8E1DA] p-2 bg-white max-w-[200px]" />
              <p className="text-[10px] text-gray-400 mt-3 font-mono">{booking.qr_token}</p>
              <div className="flex flex-wrap justify-center gap-3 mt-5">
                <button
                  type="button"
                  onClick={handleDownloadQr}
                  disabled={downloadingQr}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#A98B75] text-[#A98B75] text-sm font-medium hover:bg-[#A98B75]/10 disabled:opacity-50"
                >
                  <FaDownload size={13} /> {downloadingQr ? "Saving..." : "Download QR"}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadReceipt}
                  disabled={downloading}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#5B4636] text-white text-sm font-medium hover:bg-[#4a3829] disabled:opacity-50"
                >
                  <FaDownload size={13} /> {downloading ? "Generating..." : "Download PDF receipt"}
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-3">PDF receipt includes this QR code.</p>
            </div>
          )}

          {!["cancelled", "completed", "cancellation_pending", "cancellation_submitted"].includes(booking.status) && (
            <div className="text-center">
              <button type="button" onClick={handleCancel} className="text-red-500 text-sm hover:underline">
                {booking.status === "confirmed" ? "Request cancellation" : "Cancel booking"}
              </button>
            </div>
          )}

          {booking.status === "cancelled" && (
            <div className="text-center space-y-2">
              <p className="text-sm text-gray-500">This booking has been cancelled. No refund applies.</p>
              {booking.notes && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3 max-w-md mx-auto">
                  <span className="font-medium">Studio reason:</span> {booking.notes}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {cancelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#5B4636]/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl border border-[#E8E1DA] shadow-2xl p-6">
            <h2 className="heading-serif text-2xl font-bold text-[#5B4636]">
              {booking.status === "confirmed" ? "Request cancellation" : "Cancel this booking"}
            </h2>
            <p className="text-sm text-gray-500 mt-2">
              {booking.status === "confirmed"
                ? `A non-refundable cancellation fee of ₱${CANCELLATION_FEE.toLocaleString()} applies. Your booking stays active until you pay and the studio verifies it.`
                : "This booking is not confirmed yet, so no cancellation fee applies."}
            </p>
            <label className="block text-sm font-medium text-[#5B4636] mt-5 mb-2">Reason</label>
            <select
              value={reasonChoice}
              onChange={(e) => setReasonChoice(e.target.value)}
              className="w-full border border-[#E8E1DA] rounded-xl px-4 py-3 outline-none focus:border-[#A98B75] bg-white"
            >
              {CANCEL_REASONS.map((reason) => (
                <option key={reason} value={reason}>{reason}</option>
              ))}
            </select>
            {reasonChoice === "Others" && (
              <textarea
                value={otherReason}
                onChange={(e) => setOtherReason(e.target.value)}
                rows={3}
                placeholder="Type your reason"
                className="mt-3 w-full border border-[#E8E1DA] rounded-xl px-4 py-3 outline-none focus:border-[#A98B75] resize-none text-sm"
              />
            )}
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => !cancelling && setCancelOpen(false)}
                className="flex-1 py-3 rounded-xl border border-[#E8E1DA] text-[#5B4636] font-medium hover:bg-[#F8F6F3]"
              >
                Keep booking
              </button>
              <button
                type="button"
                onClick={submitCancel}
                disabled={cancelling || (reasonChoice === "Others" && !otherReason.trim())}
                className="flex-1 py-3 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {cancelling ? "Saving..." : booking.status === "confirmed" ? "Continue" : "Cancel booking"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ClientLayout>
  );
}
