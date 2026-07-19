import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ClientSidebar from "../client/ClientSidebar";
import { useAuth } from "../../context/AuthContext";
import { subscribeToNotifications } from "../../services/notifications";
import { promptPushIfNeeded } from "../../lib/onesignal";

const ClientLayout = ({ children }) => {
  const { user } = useAuth();
  const [pushToast, setPushToast] = useState(null);

  const showToast = ({ title, body, url }) => {
    setPushToast({
      title: title || "Booking update",
      body: body || "You have a new notification.",
      url: url || "/client-notifications",
    });
    window.setTimeout(() => setPushToast(null), 10000);
  };

  useEffect(() => {
    window.__studiobookPushToast = showToast;
    return () => {
      delete window.__studiobookPushToast;
    };
  }, []);

  // After client lands on any client page: ask to Allow notifications if not subscribed
  useEffect(() => {
    if (!user?.id) return;
    const timer = window.setTimeout(() => {
      void promptPushIfNeeded(user.id);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const sub = subscribeToNotifications(user.id, (payload) => {
      const row = payload?.new || {};
      showToast({
        title: row.title || "New notification",
        body: row.message || "You have a new update.",
        url: row.link || "/client-notifications",
      });
    }, "toast");
    return () => {
      sub.unsubscribe();
    };
  }, [user?.id]);

  return (
    <div className="min-h-screen app-shell flex">
      <ClientSidebar />
      <main className="flex-1 ml-20 p-6 md:p-8 overflow-y-auto min-h-screen relative">
        {pushToast && (
          <div className="fixed top-4 right-4 z-[100] max-w-sm w-[calc(100%-2rem)] bg-white border border-[#A98B75] shadow-lg rounded-2xl p-4 animate-[fadeIn_0.2s_ease]">
            <p className="text-sm font-semibold text-[#5B4636]">{pushToast.title}</p>
            <p className="text-xs text-gray-600 mt-1 line-clamp-4">{pushToast.body}</p>
            <div className="mt-3 flex gap-3">
              <Link
                to={
                  pushToast.url.startsWith("http")
                    ? "/client-notifications"
                    : pushToast.url
                }
                className="text-xs font-medium text-[#A98B75] hover:underline"
                onClick={() => setPushToast(null)}
              >
                View
              </Link>
              <button
                type="button"
                className="text-xs text-gray-400"
                onClick={() => setPushToast(null)}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
        <div className="page-transition">{children}</div>
      </main>
    </div>
  );
};

export default ClientLayout;
