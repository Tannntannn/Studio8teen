import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Swal from "sweetalert2";
import ClientLayout from "../../components/layout/ClientLayout";
import PaymentSection from "../../components/booking/PaymentSection";
import CancellationFeeSection from "../../components/booking/CancellationFeeSection";
import { useAuth } from "../../context/AuthContext";
import { getBooking, requestCancellation, cancelBookingFree } from "../../services/bookings";
import { getChecklist, updateChecklist } from "../../services/gallery";
import { getChecklistProgress, getChecklistTasks, formatCheckedAt } from "../../lib/checklist";
import { downloadBookingReceipt, downloadBookingQr, bookingHasQr } from "../../lib/bookingReceipt";
import { CANCELLATION_FEE } from "../../lib/constants";
import { FaDownload, FaQrcode } from "react-icons/fa";
import QRCode from "qrcode";

export default function BookingDetail() {
  const { id } = useParams();
  const { profile } = useAuth();
  const [booking, setBooking] = useState(null);
  const [checklist, setChecklist] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [downloadingQr, setDownloadingQr] = useState(false);

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

  const handleCancel = async () => {
    const needsFee = booking.status === "confirmed";

    if (!needsFee) {
      const { value: reason, isConfirmed } = await Swal.fire({
        title: "Cancel this booking?",
        text: "Your booking has not been approved yet, so no cancellation fee applies.",
        input: "text",
        inputPlaceholder: "Reason (optional)",
        showCancelButton: true,
        confirmButtonText: "Cancel booking",
        confirmButtonColor: "#dc2626",
      });
      if (!isConfirmed) return;
      await cancelBookingFree(id, reason || "Cancelled before admin approval");
      Swal.fire({ icon: "success", title: "Booking cancelled", timer: 2000, showConfirmButton: false });
      load();
      return;
    }

    const { value: reason, isConfirmed } = await Swal.fire({
      title: "Request cancellation?",
      html: `<p class="text-sm text-gray-600 mb-2">A non-refundable cancellation fee of <strong>₱${CANCELLATION_FEE.toLocaleString()}</strong> applies.</p><p class="text-sm text-gray-500">Your booking stays active until you pay the fee and the studio verifies it.</p>`,
      input: "text",
      inputPlaceholder: "Reason for cancellation",
      showCancelButton: true,
      confirmButtonText: "Continue",
    });
    if (isConfirmed) {
      await requestCancellation(id, reason || "Client requested cancellation");
      Swal.fire({
        icon: "info",
        title: "Cancellation requested",
        text: "Upload your ₱100 cancellation fee payment proof below.",
        timer: 3000,
        showConfirmButton: false,
      });
      load();
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
          <p className="text-gray-500 mt-1">{booking.event_date} at {booking.time_slot} — {booking.location}</p>
          <span className="inline-block mt-2 text-xs px-3 py-1 rounded-full bg-[#A98B75]/10 text-[#A98B75] font-medium capitalize">
            {booking.status.replace(/_/g, " ")}
          </span>
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

          {booking.status === "confirmed" && (
            <div className="flex gap-3 justify-center">
              <Link to={`/client-bookings/${id}/mood-board`} className="px-4 py-2 rounded-xl border border-[#A98B75] text-[#A98B75] text-sm font-medium hover:bg-[#A98B75]/10">
                Session Mood Board
              </Link>
              <Link to="/client-mood-board" className="px-4 py-2 rounded-xl border border-[#E8E1DA] text-[#5B4636] text-sm font-medium hover:bg-[#F8F6F3]">
                Theme Generator
              </Link>
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
            <p className="text-sm text-gray-500 text-center">This booking has been cancelled. No refund applies.</p>
          )}
        </div>
      </div>
    </ClientLayout>
  );
}
