import { useEffect, useState } from "react";
import { FaTimes } from "react-icons/fa";
import ClientLayout from "../../components/layout/ClientLayout";
import ConfirmModal from "../../components/ui/ConfirmModal";
import {
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  dismissNotification,
  dismissAllNotifications,
  subscribeToNotifications,
} from "../../services/notifications";
import { useAuth } from "../../context/AuthContext";

const TYPE_STYLES = {
  info: "bg-blue-50 border-blue-100 text-blue-800",
  success: "bg-green-50 border-green-100 text-green-800",
  warning: "bg-amber-50 border-amber-100 text-amber-800",
  payment: "bg-[#A98B75]/10 border-[#A98B75]/30 text-[#5B4636]",
  booking: "bg-red-50 border-red-100 text-red-800",
};

export default function Notifications() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [clearOpen, setClearOpen] = useState(false);

  const load = () => getMyNotifications().then(setItems).catch(console.error);

  useEffect(() => {
    load();
    if (!user) return;
    const sub = subscribeToNotifications(user.id, () => load());
    return () => { sub.unsubscribe(); };
  }, [user]);

  const unread = items.filter((n) => !n.is_read).length;

  const handleDismiss = async (id, e) => {
    e.stopPropagation();
    await dismissNotification(id);
    load();
  };

  return (
    <ClientLayout>
      <div className="max-w-2xl mx-auto w-full">
        <div className="mb-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-center sm:text-left">
          <div>
            <h1 className="heading-serif text-4xl font-bold text-[#5B4636]">Notifications</h1>
            <p className="mt-2 text-gray-500">{unread} unread</p>
          </div>
          <div className="flex gap-2">
            {unread > 0 && (
              <button type="button" onClick={() => markAllNotificationsRead().then(load)} className="text-sm text-[#A98B75] hover:underline">
                Mark all read
              </button>
            )}
            {items.length > 0 && (
              <button type="button" onClick={() => setClearOpen(true)} className="text-sm text-gray-500 hover:text-red-600">
                Clear all
              </button>
            )}
          </div>
        </div>

        {items.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E8E1DA] p-12 text-center text-gray-500">
            No notifications yet.
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((n) => (
              <div
                key={n.id}
                onClick={() => !n.is_read && markNotificationRead(n.id).then(load)}
                className={`relative bg-white rounded-xl border p-4 pr-12 cursor-pointer transition hover:shadow-sm ${
                  n.is_read ? "border-[#E8E1DA] opacity-80" : "border-[#A98B75]/40 shadow-sm"
                }`}
              >
                <span className={`inline-block text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full mb-2 ${TYPE_STYLES[n.type] || TYPE_STYLES.info}`}>
                  {n.type || "info"}
                </span>
                <p className={`text-sm ${n.is_read ? "text-gray-600" : "text-[#5B4636] font-medium"}`}>{n.message}</p>
                <p className="text-xs text-gray-400 mt-2">{new Date(n.created_at).toLocaleString()}</p>
                <button
                  type="button"
                  onClick={(e) => handleDismiss(n.id, e)}
                  className="absolute top-3 right-3 w-8 h-8 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center"
                  aria-label="Dismiss notification"
                >
                  <FaTimes size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmModal
        open={clearOpen}
        title="Clear all notifications?"
        message="This removes all notifications from your list. You won't be able to recover them."
        confirmLabel="Clear all"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={async () => {
          await dismissAllNotifications();
          setClearOpen(false);
          load();
        }}
        onCancel={() => setClearOpen(false)}
      />
    </ClientLayout>
  );
}
