import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AdminLayout from "../../components/layout/AdminLayout";
import ConfirmModal from "../../components/ui/ConfirmModal";
import { getProfile, manageClientAccount } from "../../services/profiles";
import { getClientBookings } from "../../services/bookings";
import { guestDaysRemaining } from "../../services/guestSessions";
import Swal from "sweetalert2";

const STATUS_COLORS = {
  awaiting_payment: "bg-amber-100 text-amber-700",
  payment_submitted: "bg-blue-100 text-blue-700",
  confirmed: "bg-green-100 text-green-700",
  completed: "bg-gray-100 text-gray-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function AdminClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [pendingAction, setPendingAction] = useState(null);
  const [acting, setActing] = useState(false);

  const load = () => {
    Promise.all([getProfile(id), getClientBookings(id)])
      .then(([profile, clientBookings]) => {
        setClient(profile);
        setBookings(clientBookings);
      })
      .catch(console.error);
  };

  useEffect(() => {
    load();
  }, [id]);

  if (!client) {
    return (
      <AdminLayout>
        <p className="text-gray-500">Loading client...</p>
      </AdminLayout>
    );
  }

  const isGuest = Boolean(client.is_guest && !client.claimed_at);
  const days = guestDaysRemaining(client.guest_expires_at);
  const deactivated = Boolean(client.deactivated_at);

  const runAction = async () => {
    if (!pendingAction) return;
    setActing(true);
    try {
      const result = await manageClientAccount(client.id, pendingAction);
      const mailNote = result?.emailed ? " They were emailed." : " Guest accounts are not emailed.";
      if (pendingAction === "delete") {
        Swal.fire({
          icon: "success",
          title: "Account deleted",
          text: `Their login is removed. Bookings stay on record.${mailNote}`,
          timer: 2200,
          showConfirmButton: false,
        });
        navigate("/admin/clients", { replace: true });
        return;
      }
      Swal.fire({
        icon: "success",
        title: pendingAction === "deactivate" ? "Account deactivated" : "Account reactivated",
        text: mailNote.trim(),
        timer: 2000,
        showConfirmButton: false,
      });
      setPendingAction(null);
      load();
    } catch (err) {
      Swal.fire({ icon: "error", title: "Could not update account", text: err.message });
    } finally {
      setActing(false);
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto">
        <Link to="/admin/clients" className="text-[#A98B75] text-sm hover:underline">← Back to clients</Link>

        <div className="mt-6 bg-white rounded-2xl border border-[#E8E1DA] p-6 mb-6">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="heading-serif text-3xl font-bold text-[#5B4636]">{client.full_name || "Unnamed client"}</h1>
            {isGuest ? (
              <span className="text-xs px-2.5 py-1 rounded-full bg-sky-100 text-sky-800 font-medium">Guest</span>
            ) : (
              <span className="text-xs px-2.5 py-1 rounded-full bg-[#F8F6F3] text-[#5B4636] font-medium border border-[#E8E1DA]">
                Registered
              </span>
            )}
            {deactivated && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-red-100 text-red-700 font-medium">Deactivated</span>
            )}
          </div>
          <p className="text-gray-500 mt-1">{client.email}</p>
          <div className="flex flex-wrap gap-2 mt-4">
            {deactivated ? (
              <button
                type="button"
                onClick={() => setPendingAction("reactivate")}
                className="px-4 py-2 rounded-xl bg-[#A98B75] text-white text-sm font-medium hover:bg-[#8a7260]"
              >
                Reactivate account
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setPendingAction("deactivate")}
                className="px-4 py-2 rounded-xl border border-amber-300 text-amber-800 text-sm font-medium hover:bg-amber-50"
              >
                Deactivate account
              </button>
            )}
            <button
              type="button"
              onClick={() => setPendingAction("delete")}
              className="px-4 py-2 rounded-xl border border-red-200 text-red-700 text-sm font-medium hover:bg-red-50"
            >
              Delete account
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {isGuest
              ? "Guests are not emailed. Registered clients receive an email for deactivate, reactivate, and delete."
              : "This registered client will get an email when you deactivate, reactivate, or delete the account."}
          </p>
          {isGuest && (
            <p className="text-sm text-sky-800 bg-sky-50 border border-sky-100 rounded-xl px-4 py-2 mt-3 inline-block">
              {days == null
                ? "Guest session — expiry unknown"
                : days === 0
                  ? "Guest login expires today if not claimed"
                  : `Guest login expires in about ${days} day${days === 1 ? "" : "s"}`}
              {client.guest_expires_at
                ? ` (${new Date(client.guest_expires_at).toLocaleString()}). Booking/payment records stay after archive.`
                : ". Booking/payment records stay after archive."}
            </p>
          )}
          {client.claimed_at && (
            <p className="text-xs text-gray-400 mt-2">
              Claimed account on {new Date(client.claimed_at).toLocaleString()}
            </p>
          )}
          <div className="grid sm:grid-cols-3 gap-4 mt-6 text-sm">
            <div className="bg-[#F8F6F3] rounded-xl p-4">
              <p className="text-gray-400">Phone</p>
              <p className="font-medium text-[#5B4636] mt-1">{client.phone || "—"}</p>
            </div>
            <div className="bg-[#F8F6F3] rounded-xl p-4">
              <p className="text-gray-400">Address</p>
              <p className="font-medium text-[#5B4636] mt-1">{client.address || "—"}</p>
            </div>
            <div className="bg-[#F8F6F3] rounded-xl p-4">
              <p className="text-gray-400">Total bookings</p>
              <p className="font-medium text-[#5B4636] mt-1">{bookings.length}</p>
            </div>
          </div>
        </div>

        <h2 className="font-semibold text-[#5B4636] mb-4">Bookings & payments</h2>
        {bookings.length === 0 ? (
          <p className="text-gray-400">No bookings yet.</p>
        ) : (
          <div className="space-y-4">
            {bookings.map((b) => {
              const payment = b.payments?.[0];
              return (
                <Link
                  key={b.id}
                  to={`/admin/bookings/${b.id}`}
                  className="block bg-white rounded-xl border border-[#E8E1DA] p-5 hover:shadow-md transition"
                >
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[#5B4636]">{b.packages?.name}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        {b.event_date} at {b.time_slot} — {b.location || "Studio"}
                      </p>
                    </div>
                    <span className={`text-xs px-3 py-1 rounded-full font-medium capitalize ${STATUS_COLORS[b.status] || "bg-gray-100"}`}>
                      {b.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  {payment && (
                    <div className="mt-3 pt-3 border-t border-[#F8F6F3] text-sm text-gray-600 flex flex-wrap gap-4">
                      <span>Payment: {payment.payment_type}</span>
                      <span>Amount: ₱{Number(payment.amount).toLocaleString()} PHP</span>
                      <span className="capitalize">Status: {payment.status}</span>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmModal
        open={pendingAction === "deactivate"}
        title="Deactivate this account?"
        message={`${client.full_name || "This client"} will not be able to sign in. Their bookings stay. ${
          isGuest ? "Guest accounts are not emailed." : "They will get an email."
        }`}
        confirmLabel="Deactivate"
        loading={acting}
        onConfirm={runAction}
        onCancel={() => !acting && setPendingAction(null)}
      />
      <ConfirmModal
        open={pendingAction === "reactivate"}
        title="Reactivate this account?"
        message={`${client.full_name || "This client"} will be able to sign in again. ${
          isGuest ? "Guest accounts are not emailed." : "They will get an email."
        }`}
        confirmLabel="Reactivate"
        variant="primary"
        loading={acting}
        onConfirm={runAction}
        onCancel={() => !acting && setPendingAction(null)}
      />
      <ConfirmModal
        open={pendingAction === "delete"}
        title="Delete this account?"
        message={`This removes ${client.full_name || "this client"}'s login. Bookings stay on the studio records, labeled with their name. ${
          isGuest ? "Guest accounts are not emailed." : "They will get an email."
        } This cannot be undone.`}
        confirmLabel="Delete account"
        loading={acting}
        onConfirm={runAction}
        onCancel={() => !acting && setPendingAction(null)}
      />
    </AdminLayout>
  );
}
