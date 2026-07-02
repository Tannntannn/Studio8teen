import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FaCalendarAlt, FaMapMarkerAlt, FaUser, FaTrash, FaCheckCircle, FaQrcode, FaDownload } from "react-icons/fa";
import QRCode from "qrcode";
import Swal from "sweetalert2";
import { downloadBookingQr } from "../../lib/bookingReceipt";
import AdminLayout from "../../components/layout/AdminLayout";
import ConfirmModal from "../../components/ui/ConfirmModal";
import ClientChecklistSummary from "../../components/booking/ClientChecklistSummary";
import { getBooking, updateBooking, markBookingAsRead, deleteBooking, rejectBooking } from "../../services/bookings";
import { verifyPayment, rejectPayment } from "../../services/payments";
import { useAuth } from "../../context/AuthContext";

const STATUS_STYLES = {
  awaiting_payment: "bg-amber-100 text-amber-800",
  payment_submitted: "bg-blue-100 text-blue-800",
  confirmed: "bg-green-100 text-green-800",
  completed: "bg-gray-100 text-gray-700",
  cancelled: "bg-red-100 text-red-700",
};

function StatusBadge({ status }) {
  const key = status || "unknown";
  return (
    <span className={`inline-block text-xs capitalize px-3 py-1 rounded-full font-medium ${STATUS_STYLES[key] || "bg-[#A98B75]/10 text-[#A98B75]"}`}>
      {key.replace(/_/g, " ")}
    </span>
  );
}

export default function AdminBookingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [downloadingQr, setDownloadingQr] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    getBooking(id)
      .then(async (data) => {
        setBooking(data);
        if (data.status === "payment_submitted" && !data.admin_read_at) {
          await markBookingAsRead(id);
          setBooking((prev) => prev && { ...prev, admin_read_at: new Date().toISOString() });
        }
      })
      .catch((err) => setError(err.message || "Failed to load booking"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [id]);

  useEffect(() => {
    if (booking?.qr_token && ["confirmed", "completed"].includes(booking.status)) {
      const verifyUrl = `${window.location.origin}/verify/${booking.qr_token}`;
      QRCode.toDataURL(verifyUrl, { width: 160 }).then(setQrDataUrl);
    } else {
      setQrDataUrl("");
    }
  }, [booking?.qr_token, booking?.status]);

  const payment = booking?.payments?.[0];

  const handleVerify = async () => {
    if (!payment) return;
    try {
      await verifyPayment(payment.id, id, user.id);
      Swal.fire({
        icon: "success",
        title: "Booking confirmed",
        text: "Payment verified. A verification QR code has been generated for the client.",
        timer: 2800,
        showConfirmButton: false,
      });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRejectBooking = async () => {
    const { value: note, isConfirmed } = await Swal.fire({
      title: "Reject this booking?",
      text: "This cancels the booking and releases the time slot.",
      input: "text",
      inputPlaceholder: "Reason for rejection",
      showCancelButton: true,
      confirmButtonText: "Reject booking",
      confirmButtonColor: "#dc2626",
    });
    if (!isConfirmed) return;
    try {
      await rejectBooking(id, note || "Booking rejected by admin");
      Swal.fire({ icon: "success", title: "Booking rejected", timer: 2000, showConfirmButton: false });
      navigate("/admin/bookings", { replace: true });
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRejectProof = async () => {
    if (!payment) return;
    try {
      await rejectPayment(payment.id, "Payment proof rejected by admin");
      await updateBooking(id, { status: "awaiting_payment" });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleMarkCompleted = async () => {
    try {
      await updateBooking(id, { status: "completed" });
      setCompleteOpen(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteBooking(id);
      navigate("/admin/bookings", { replace: true });
    } catch (err) {
      setError(err.message || "Failed to delete booking");
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <p className="text-gray-500">Loading booking...</p>
      </AdminLayout>
    );
  }

  if (error && !booking) {
    return (
      <AdminLayout>
        <Link to="/admin/bookings" className="text-[#A98B75] text-sm hover:underline">← Back to bookings</Link>
        <div className="mt-6 p-6 rounded-xl bg-red-50 border border-red-200 text-red-700">{error}</div>
      </AdminLayout>
    );
  }

  if (!booking) return null;

  const canDelete = ["completed", "cancelled", "awaiting_payment", "payment_submitted", "confirmed"].includes(booking.status);

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <Link to="/admin/bookings" className="text-[#A98B75] text-sm hover:underline">← Back to bookings</Link>
          <div className="flex flex-wrap gap-2">
            {booking.status === "confirmed" && (
              <button
                type="button"
                onClick={() => setCompleteOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#A98B75] text-white text-sm font-medium hover:bg-[#8a7260] transition"
              >
                <FaCheckCircle size={14} /> Mark completed
              </button>
            )}
            {["awaiting_payment", "payment_submitted"].includes(booking.status) && (
              <button
                type="button"
                onClick={handleRejectBooking}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition"
              >
                Reject booking
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition"
              >
                <FaTrash size={13} /> Delete booking
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
        )}

        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <h1 className="heading-serif text-3xl md:text-4xl font-bold text-[#5B4636]">
              {booking.packages?.name || "Booking"}
            </h1>
            <StatusBadge status={booking.status} />
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-500 mt-2">
            <span className="inline-flex items-center gap-1.5">
              <FaCalendarAlt className="text-[#A98B75]" size={13} />
              {booking.event_date} at {booking.time_slot}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <FaMapMarkerAlt className="text-[#A98B75]" size={13} />
              {booking.location || "Studio"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <FaUser className="text-[#A98B75]" size={13} />
              {booking.profiles?.full_name || "—"} · {booking.profiles?.email || "no email"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-[#E8E1DA] p-6">
              <h3 className="font-semibold text-[#5B4636] mb-4">Booking details</h3>
              <dl className="space-y-4 text-sm">
                <div className="flex justify-between gap-4 pb-3 border-b border-[#F8F6F3]">
                  <dt className="text-gray-400">Package price</dt>
                  <dd className="font-semibold text-[#5B4636]">₱{Number(booking.packages?.price || 0).toLocaleString()}</dd>
                </div>
                <div className="flex justify-between gap-4 pb-3 border-b border-[#F8F6F3]">
                  <dt className="text-gray-400">Submitted</dt>
                  <dd>{booking.created_at ? new Date(booking.created_at).toLocaleString() : "—"}</dd>
                </div>
                <div className="flex justify-between gap-4 pb-3 border-b border-[#F8F6F3]">
                  <dt className="text-gray-400">QR verification</dt>
                  <dd className="font-mono text-xs">{booking.qr_token || "Generated after payment confirmed"}</dd>
                </div>
                <div className="flex justify-between gap-4 pb-3 border-b border-[#F8F6F3]">
                  <dt className="text-gray-400">Contact</dt>
                  <dd>{booking.contact_number || "—"}</dd>
                </div>
                <div className="flex justify-between gap-4 pb-3 border-b border-[#F8F6F3]">
                  <dt className="text-gray-400">Address</dt>
                  <dd className="text-right max-w-[60%]">{booking.client_address || "—"}</dd>
                </div>
                <div>
                  <dt className="text-gray-400 mb-1">Client notes</dt>
                  <dd className="text-gray-700 bg-[#F8F6F3] rounded-xl p-3">{booking.notes || "No notes provided."}</dd>
                </div>
              </dl>
            </div>

            <div className="bg-white rounded-2xl border border-[#E8E1DA] p-6">
              <ClientChecklistSummary booking={booking} />
            </div>

            {qrDataUrl && (
              <div className="bg-white rounded-2xl border border-[#E8E1DA] p-6 text-center">
                <h3 className="font-semibold text-[#5B4636] mb-3 flex items-center justify-center gap-2">
                  <FaQrcode className="text-[#A98B75]" /> Client verification QR
                </h3>
                <img src={qrDataUrl} alt="Booking QR" className="mx-auto rounded-lg border border-[#E8E1DA] p-2 max-w-[160px]" />
                <div className="flex flex-wrap justify-center gap-3 mt-4">
                  <button
                    type="button"
                    disabled={downloadingQr}
                    onClick={async () => {
                      setDownloadingQr(true);
                      try {
                        await downloadBookingQr(booking);
                      } catch (err) {
                        Swal.fire({ icon: "error", title: "Download failed", text: err.message });
                      } finally {
                        setDownloadingQr(false);
                      }
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[#A98B75] text-[#A98B75] text-sm hover:bg-[#A98B75]/10 disabled:opacity-50"
                  >
                    <FaDownload size={12} /> {downloadingQr ? "Saving..." : "Download QR"}
                  </button>
                  <Link
                    to="/admin/qr-scanner"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#A98B75] text-white text-sm hover:bg-[#8a7260]"
                  >
                    Open QR scanner
                  </Link>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-3">
            <div className="bg-white rounded-2xl border border-[#E8E1DA] p-6 h-full flex flex-col">
              <h3 className="font-semibold text-[#5B4636] mb-4">Payment verification</h3>

              {!payment ? (
                <p className="text-gray-500 text-sm">No payment record yet. Client has not submitted payment proof.</p>
              ) : (
                <div className="flex flex-col flex-1">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                    <div className="bg-[#F8F6F3] rounded-xl p-4">
                      <p className="text-xs text-gray-400 mb-1">Type</p>
                      <p className="font-medium text-[#5B4636] capitalize">{payment.payment_type}</p>
                    </div>
                    <div className="bg-[#F8F6F3] rounded-xl p-4">
                      <p className="text-xs text-gray-400 mb-1">Amount</p>
                      <p className="font-medium text-[#5B4636]">₱{Number(payment.amount).toLocaleString()}</p>
                    </div>
                    <div className="bg-[#F8F6F3] rounded-xl p-4 col-span-2 sm:col-span-1">
                      <p className="text-xs text-gray-400 mb-1">Status</p>
                      <p className="font-medium text-[#A98B75] capitalize">{payment.status}</p>
                    </div>
                  </div>

                  {payment.proof_image_url ? (
                    <div className="flex-1 flex items-center justify-center bg-[#F8F6F3] rounded-xl border border-[#E8E1DA] p-4 mb-6 min-h-[280px]">
                      <img
                        src={payment.proof_image_url}
                        alt="Payment proof"
                        className="max-h-[420px] max-w-full object-contain rounded-lg shadow-sm"
                      />
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center bg-[#F8F6F3] rounded-xl border border-dashed border-[#E8E1DA] p-8 mb-6 min-h-[200px]">
                      <p className="text-gray-400 text-sm">No payment screenshot uploaded yet.</p>
                    </div>
                  )}

                  {payment.rejection_note && (
                    <p className="text-red-600 text-sm mb-4 p-3 bg-red-50 rounded-xl border border-red-100">
                      Rejection note: {payment.rejection_note}
                    </p>
                  )}

                  {payment.status === "submitted" && (
                    <div className="flex flex-wrap gap-3 mt-auto pt-2">
                      <button
                        type="button"
                        onClick={handleVerify}
                        className="flex-1 min-w-[160px] px-5 py-3 rounded-xl bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition"
                      >
                        Verify & confirm booking
                      </button>
                      <button
                        type="button"
                        onClick={handleRejectProof}
                        className="flex-1 min-w-[120px] px-5 py-3 rounded-xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition"
                      >
                        Reject proof
                      </button>
                    </div>
                  )}

                  {payment.status === "verified" && (
                    <p className="text-green-600 text-sm font-medium p-3 bg-green-50 rounded-xl border border-green-100">
                      Payment verified — booking confirmed. Client QR code is now active.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={deleteOpen}
        title="Delete this booking?"
        message={`This permanently removes the booking for ${booking.profiles?.full_name || "this client"} on ${booking.event_date}. Payment records and checklist data will also be deleted. This cannot be undone.`}
        confirmLabel="Delete booking"
        cancelLabel="Keep booking"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => !deleting && setDeleteOpen(false)}
      />

      <ConfirmModal
        open={completeOpen}
        title="Mark session as completed?"
        message="The client will see this booking as completed. You can delete it later from the bookings list if needed."
        confirmLabel="Mark completed"
        cancelLabel="Not yet"
        variant="primary"
        onConfirm={handleMarkCompleted}
        onCancel={() => setCompleteOpen(false)}
      />
    </AdminLayout>
  );
}
