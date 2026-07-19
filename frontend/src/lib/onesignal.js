/**
 * OneSignal Web SDK (v16) via react-onesignal.
 * Order: init → permission/subscription → login(external_id) → save subscription id.
 */
import { supabase } from "./supabase";

const APP_ID =
  import.meta.env.VITE_ONESIGNAL_APP_ID || "98cf69f1-7952-499b-89de-d3325ed49e3e";

let initPromise = null;
let OneSignalMod = null;
let listenersBound = false;

async function getOneSignal() {
  if (!OneSignalMod) {
    OneSignalMod = (await import("react-onesignal")).default;
  }
  return OneSignalMod;
}

async function ensureInit() {
  if (typeof window === "undefined" || !APP_ID) return null;

  const OneSignal = await getOneSignal();

  if (!initPromise) {
    initPromise = OneSignal.init({
      appId: APP_ID,
      allowLocalhostAsSecureOrigin: true,
      serviceWorkerPath: "OneSignalSDKWorker.js",
      serviceWorkerParam: { scope: "/" },
      notifyButton: { enable: false },
    }).catch((err) => {
      initPromise = null;
      throw err;
    });
  }

  await initPromise;
  bindForegroundListener(OneSignal);
  return OneSignal;
}

function bindForegroundListener(OneSignal) {
  if (listenersBound) return;
  listenersBound = true;
  try {
    // Keep OS toast; also show an in-page banner so testing is obvious
    OneSignal.Notifications.addEventListener("foregroundWillDisplay", (event) => {
      const n = event?.notification;
      const title = n?.title || "Booking update";
      const body = n?.body || "You have a new notification.";
      // Don't preventDefault — let the system notification show too
      try {
        if (window.__studiobookPushToast) {
          window.__studiobookPushToast({ title, body, url: n?.launchURL || n?.url });
        } else {
          // Lightweight fallback if toast helper not registered
          console.info("OneSignal push (foreground):", title, body);
        }
      } catch {
        /* ignore */
      }
    });
  } catch (err) {
    console.warn("OneSignal foreground listener:", err?.message || err);
  }
}

async function ensurePushPermission(OneSignal) {
  try {
    const permission =
      OneSignal.Notifications?.permissionNative ||
      (typeof Notification !== "undefined" ? Notification.permission : "default");

    if (permission === "denied") {
      console.warn("OneSignal: notifications blocked in browser settings for this site.");
      return false;
    }

    if (permission !== "granted") {
      try {
        await OneSignal.Slidedown.promptPush();
      } catch {
        /* continue */
      }
      if (typeof OneSignal.Notifications?.requestPermission === "function") {
        await OneSignal.Notifications.requestPermission();
      } else if (typeof Notification !== "undefined" && Notification.requestPermission) {
        await Notification.requestPermission();
      }
    }

    if (typeof OneSignal.User?.PushSubscription?.optIn === "function") {
      await OneSignal.User.PushSubscription.optIn();
    }

    await new Promise((r) => setTimeout(r, 1000));

    return (
      OneSignal.User?.PushSubscription?.optedIn === true ||
      OneSignal.Notifications?.permissionNative === "granted" ||
      (typeof Notification !== "undefined" && Notification.permission === "granted")
    );
  } catch (err) {
    console.warn("OneSignal permission flow:", err?.message || err);
    return false;
  }
}

async function waitForPushToken(OneSignal, attempts = 8) {
  for (let i = 0; i < attempts; i++) {
    const sub = OneSignal.User?.PushSubscription;
    const id = sub?.id || null;
    const token = sub?.token || null;
    const optedIn = sub?.optedIn === true;
    if (id && token && optedIn) {
      return { id: String(id), token: String(token), optedIn: true };
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  const sub = OneSignal.User?.PushSubscription;
  return {
    id: sub?.id ? String(sub.id) : null,
    token: sub?.token ? String(sub.token) : null,
    optedIn: sub?.optedIn === true,
  };
}

async function persistSubscriptionId(userId, subscriptionId) {
  if (!userId || !subscriptionId) return subscriptionId;
  try {
    await supabase
      .from("profiles")
      .update({ onesignal_subscription_id: String(subscriptionId) })
      .eq("id", userId);
  } catch (err) {
    console.warn("Could not save OneSignal subscription id:", err?.message || err);
  }
  return subscriptionId;
}

export async function initOneSignal(userId) {
  if (!userId || typeof window === "undefined") return;

  try {
    const OneSignal = await ensureInit();
    if (!OneSignal) return;

    const subscribed = await ensurePushPermission(OneSignal);
    // Subscribe first, then attach external_id (avoids empty-token aliases)
    if (typeof OneSignal.User?.PushSubscription?.optIn === "function") {
      await OneSignal.User.PushSubscription.optIn();
    }

    const push = await waitForPushToken(OneSignal);
    await OneSignal.login(String(userId));

    if (typeof OneSignal.User?.PushSubscription?.optIn === "function") {
      await OneSignal.User.PushSubscription.optIn();
    }

    const afterLogin = await waitForPushToken(OneSignal, 4);
    const subscriptionId = afterLogin.id || push.id;
    if (subscriptionId && (afterLogin.token || push.token)) {
      await persistSubscriptionId(userId, subscriptionId);
    }

    console.info("OneSignal ready:", {
      userId: String(userId),
      subscribed,
      permission: typeof Notification !== "undefined" ? Notification.permission : "n/a",
      optedIn: afterLogin.optedIn || push.optedIn,
      subscriptionId,
      hasToken: Boolean(afterLogin.token || push.token),
      externalId: OneSignal.User?.externalId || null,
    });
  } catch (err) {
    console.warn("OneSignal init skipped:", err?.message || err);
  }
}

export async function enablePushNotifications(userId) {
  if (!userId) return false;
  await initOneSignal(userId);
  const OneSignal = await getOneSignal().catch(() => null);
  const hasToken = Boolean(OneSignal?.User?.PushSubscription?.token);
  const granted =
    typeof Notification !== "undefined" && Notification.permission === "granted";
  return granted && hasToken;
}

export async function logoutOneSignal() {
  if (typeof window === "undefined" || !initPromise) return;
  try {
    const OneSignal = await getOneSignal();
    await OneSignal.logout();
  } catch (err) {
    console.warn("OneSignal logout skipped:", err?.message || err);
  }
}
