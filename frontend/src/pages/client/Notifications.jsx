import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FaTimes } from "react-icons/fa";
import ClientLayout from "../../components/layout/ClientLayout";
import AdminLayout from "../../components/layout/AdminLayout";
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
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const Layout = isAdmin ? AdminLayout : ClientLayout;
  const [tab, setTab] = useState("inbox");
  const [items, setItems] = useState([]);
  const [clearOpen, setClearOpen] = useState(false);

  const load = () => getMyNotifications(100, { history: tab === "history" }).then(setItems).catch(console.error);

  useEffect(() => {
    load();
    if (!user) return;
    const sub = subscribeToNotifications(user.id, () => load());
    return () => { sub.unsubscribe(); };
  }, [user, tab]);

  const unread = items.filter((n) => !n.is_read).length;

  const handleDismiss = async (id, e) => {
    e.stopPropagation();
    await dismissNotification(id);
    load();
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto w-full">
        <div className="mb-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-center sm:text-left">
          <div>
            <h1 className="heading-serif text-4xl font-bold text-[#5B4636]">Notifications</h1>
            <p className="mt-2 text-gray-500">
              {tab === "history" ? "Cleared notifications stay here." : `${unread} unread`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-center sm:justify-end">
            {tab === "inbox" && unread > 0 && (
              <button type="button" onClick={() => markAllNotificationsRead().then(load)} className="text-sm text-[#A98B75] hover:underline">
                Mark all read
              </button>
            )}
            {tab === "inbox" && items.length > 0 && (
              <button type="button" onClick={() => setClearOpen(true)} className="text-sm text-gray-500 hover:text-red-600">
                Clear all
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-2 mb-6 justify-center sm:justify-start">
          {[
            ["inbox", "Inbox"],
            ["history", "History"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition ${
                tab === value
                  ? "bg-[#A98B75] text-white border-[#A98B75]"
                  : "bg-white text-[#5B4636] border-[#E8E1DA] hover:bg-[#F8F6F3]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {items.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E8E1DA] p-12 text-center text-gray-500">
            {tab === "history" ? "No cleared notifications yet." : "No notifications yet."}
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((n) => {
              const body = (
                <>
                  <span className={`inline-block text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full mb-2 ${TYPE_STYLES[n.type] || TYPE_STYLES.info}`}>
                    {n.type || "info"}
                  </span>
                  {n.title && (
                    <p className={`text-sm mb-1 ${n.is_read ? "text-gray-700" : "text-[#5B4636] font-semibold"}`}>
                      {n.title}
                    </p>
                  )}
                  <p className={`text-sm ${n.is_read ? "text-gray-600" : "text-[#5B4636] font-medium"}`}>{n.message}</p>
                  <p className="text-xs text-gray-400 mt-2">{new Date(n.created_at).toLocaleString()}</p>
                </>
              );
              const shellClass = `relative block bg-white rounded-xl border p-4 pr-12 cursor-pointer transition hover:shadow-sm ${
                n.is_read ? "border-[#E8E1DA] opacity-80" : "border-[#A98B75]/40 shadow-sm"
              }`;
              const onOpen = () => {
                if (!n.is_read) markNotificationRead(n.id).then(load);
              };
              return (
                <div key={n.id} className="relative">
                  {n.link ? (
                    <Link to={n.link} onClick={onOpen} className={shellClass}>
                      {body}
                    </Link>
                  ) : (
                    <div onClick={onOpen} className={shellClass}>
                      {body}
                    </div>
                  )}
                  {tab === "inbox" && (
                    <button
                      type="button"
                      onClick={(e) => handleDismiss(n.id, e)}
                      className="absolute top-3 right-3 z-10 w-8 h-8 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center"
                      aria-label="Dismiss notification"
                    >
                      <FaTimes size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmModal
        open={clearOpen}
        title="Clear all notifications?"
        message="This moves them out of your inbox. You can still open them in History."
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
    </Layout>
  );
}
