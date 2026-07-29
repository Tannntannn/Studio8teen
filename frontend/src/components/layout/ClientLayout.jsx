import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ClientSidebar from "../client/ClientSidebar";
import { useAuth } from "../../context/AuthContext";
import { subscribeToNotifications } from "../../services/notifications";
import {
  shouldShowPushPrompt,
  acceptPushNotifications,
  markPushDismissed,
  isPushPermissionDenied,
  requestBrowserNotificationPermission,
  markPushAccepted,
} from "../../lib/onesignal";

const ClientLayout = ({ children }) => {
  const { user } = useAuth();
  const [pushToast, setPushToast] = useState(null);
  const [showPushModal, setShowPushModal] = useState(false);
  const [pushDenied, setPushDenied] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

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

  // Show once per page load; "Not now" hides until refresh or next login
  useEffect(() => {
    if (!user?.id) {
      setShowPushModal(false);
      return;
    }

    const timer = window.setTimeout(() => {
      const denied = isPushPermissionDenied();
      const show = shouldShowPushPrompt(user.id);
      setPushDenied(denied);
      setShowPushModal(show);
    }, 600);

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

  const handleAllowPush = async () => {
    if (!user?.id || pushBusy) return;
    setPushBusy(true);

    // Must run first — Chrome needs a direct user gesture for the permission dialog
    const permission = await requestBrowserNotificationPermission();

    try {
      if (permission === "denied") {
        setPushDenied(true);
        showToast({
          title: "Notifications blocked",
          body: "Enable notifications for www.studio8teen.org in your browser settings.",
          url: "/client-notifications",
        });
        return;
      }

      const ok = await Promise.race([
        acceptPushNotifications(user.id),
        new Promise((resolve) => setTimeout(() => resolve(permission === "granted"), 10000)),
      ]);

      if (ok || permission === "granted") {
        markPushAccepted(user.id);
        setShowPushModal(false);
        showToast({
          title: "Notifications enabled",
          body: "You’ll get alerts when your booking is updated.",
          url: "/client-notifications",
        });
      } else {
        setShowPushModal(false);
        showToast({
          title: "Couldn’t enable push",
          body: "Allow notifications when the browser asks, or check site settings.",
        });
      }
    } catch (err) {
      console.warn("handleAllowPush:", err?.message || err);
      if (permission === "granted") {
        markPushAccepted(user.id);
        setShowPushModal(false);
      }
    } finally {
      setPushBusy(false);
    }
  };

  const handleDismissPush = () => {
    if (user?.id) markPushDismissed(user.id);
    setShowPushModal(false);
  };

  return (
    <div className="min-h-screen app-shell flex">
      <ClientSidebar />
      <main className="flex-1 ml-20 p-6 md:p-8 overflow-y-auto min-h-screen relative">
        {showPushModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="push-allow-title"
              className="w-full max-w-md rounded-2xl bg-white border border-[#E8E1DA] shadow-xl p-6"
            >
              <h2
                id="push-allow-title"
                className="text-xl font-semibold text-[#5B4636]"
              >
                {pushDenied
                  ? "Notifications are blocked"
                  : "Allow to receive notifications?"}
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                {pushDenied ? (
                  <>
                    Chrome blocked alerts for this site. To turn them back on:
                    <br />
                    <span className="mt-2 block text-left">
                      1. Click the lock icon left of the URL
                      <br />
                      2. Open Site settings → Notifications
                      <br />
                      3. Set to <strong>Allow</strong>, then reload
                    </span>
                  </>
                ) : (
                  "Get alerts when your booking is confirmed, rescheduled, or cancelled."
                )}
              </p>
              <div className="mt-6 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
                <button
                  type="button"
                  onClick={handleDismissPush}
                  disabled={pushBusy}
                  className="px-4 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-50"
                >
                  {pushDenied ? "OK" : "Not now"}
                </button>
                {!pushDenied && (
                  <button
                    type="button"
                    onClick={handleAllowPush}
                    disabled={pushBusy}
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#A98B75] text-white hover:bg-[#8a7260] disabled:opacity-60"
                  >
                    {pushBusy ? "Enabling…" : "Allow"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

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
