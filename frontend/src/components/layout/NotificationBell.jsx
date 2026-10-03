import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaBell } from "react-icons/fa";
import { useAuth } from "../../context/AuthContext";
import {
  dismissAllNotifications,
  getMyNotifications,
  getUnreadCount,
  markNotificationRead,
  subscribeToNotifications,
} from "../../services/notifications";

function destinationFor(notification, role) {
  if (notification.link) return notification.link;
  if (notification.booking_id) {
    return role === "admin"
      ? `/admin/bookings/${notification.booking_id}`
      : `/client-bookings/${notification.booking_id}`;
  }
  const text = String(notification.message || "").toLowerCase();
  if (role === "admin") {
    if (text.includes("cancellation")) return "/admin/cancellations";
    if (text.includes("verify") || text.includes("confirm") || text.includes("paid")) return "/admin/bookings";
  }
  return role === "admin" ? "/admin/dashboard" : "/client-notifications";
}

export default function NotificationBell() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);

  const load = () => {
    if (!user?.id) return;
    getMyNotifications(100).then((rows) => setItems(rows || [])).catch(() => {});
    getUnreadCount().then(setUnread).catch(() => {});
  };

  useEffect(() => {
    load();
    if (!user?.id) return undefined;
    const channel = subscribeToNotifications(user.id, load, "bell");
    return () => {
      channel.unsubscribe();
    };
  }, [user?.id]);

  if (!user) return null;

  const listPath = profile?.role === "admin" ? "/admin/notifications" : "/client-notifications";

  const clearAll = () => {
    dismissAllNotifications().then(load).catch(() => {});
  };

  const openItem = (notification) => {
    markNotificationRead(notification.id).then(load).catch(() => {});
    setOpen(false);
    navigate(destinationFor(notification, profile?.role));
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative w-10 h-10 rounded-full border border-[#E8E1DA] bg-white text-[#5B4636] flex items-center justify-center"
        aria-label="Notifications"
      >
        <FaBell size={16} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[min(20rem,calc(100vw-2rem))] bg-white border border-[#E8E1DA] rounded-2xl shadow-lg z-[60] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E8E1DA] flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[#5B4636]">
              Notifications{unread > 0 ? ` · ${unread} unread` : ""}
            </p>
            {items.length > 0 && (
              <button type="button" onClick={clearAll} className="text-xs text-gray-500 hover:text-red-600">
                Clear
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-400">No notifications yet.</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={`w-full text-left px-4 py-3 text-sm border-b border-[#F3EEE8] hover:bg-[#F8F6F3] ${n.is_read ? "text-gray-500" : "text-[#5B4636]"}`}
                    onClick={() => openItem(n)}
                  >
                    {n.title && (
                      <span className="block text-[11px] font-semibold uppercase tracking-wide text-[#A98B75]">
                        {n.title}
                      </span>
                    )}
                    <span className="block mt-0.5">{n.message}</span>
                    <span className="block text-[11px] text-gray-400 mt-1">View booking</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate(listPath);
            }}
            className="w-full px-4 py-3 text-sm font-medium text-[#A98B75] hover:bg-[#F8F6F3] border-t border-[#E8E1DA]"
          >
            View all and history
          </button>
        </div>
      )}
    </div>
  );
}
