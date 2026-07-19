/**
 * Production OneSignal Web Push (v16).
 * Init once → opt-in → wait for subscription id → login(external_id) → persist.
 */
import { supabase } from "./supabase";

const APP_ID =
  import.meta.env.VITE_ONESIGNAL_APP_ID || "98cf69f1-7952-499b-89de-d3325ed49e3e";

const IS_LOCALHOST =
  typeof window !== "undefined" &&
  /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);

let initPromise = null;
let OneSignalMod = null;
let listenersBound = false;
let lastLoginUserId = null;
let loginInFlight = null;

async function getOneSignal() {
  if (!OneSignalMod) {
    OneSignalMod = (await import("react-onesignal")).default;
  }
  return OneSignalMod;
}

async function ensureInit() {
  if (typeof window === "undefined" || !APP_ID) return null;

  const OneSignal = await getOneSignal();

  // Drop legacy root SW registrations that can block the production /onesignal/ worker
  if ("serviceWorker" in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        regs.map(async (reg) => {
          const scriptURL =
            reg.active?.scriptURL ||
            reg.installing?.scriptURL ||
            reg.waiting?.scriptURL ||
            "";
          if (
            scriptURL.includes("OneSignalSDKWorker") &&
            !scriptURL.includes("/onesignal/")
          ) {
            await reg.unregister();
          }
        })
      );
    } catch {
      /* ignore */
    }
  }

  if (!initPromise) {
    initPromise = OneSignal.init({
      appId: APP_ID,
      // Localhost only — never needed in production
      ...(IS_LOCALHOST ? { allowLocalhostAsSecureOrigin: true } : {}),
      // Recommended dedicated path (avoids SPA / root SW conflicts)
      serviceWorkerPath: "onesignal/OneSignalSDKWorker.js",
      serviceWorkerParam: { scope: "/onesignal/" },
      notifyButton: { enable: false },
    }).catch((err) => {
      initPromise = null;
      throw err;
    });
  }

  await initPromise;
  bindListeners(OneSignal);
  return OneSignal;
}

function bindListeners(OneSignal) {
  if (listenersBound) return;
  listenersBound = true;

  try {
    OneSignal.Notifications.addEventListener("foregroundWillDisplay", (event) => {
      const n = event?.notification;
      const title = n?.title || "Booking update";
      const body = n?.body || "You have a new notification.";
      try {
        if (window.__studiobookPushToast) {
          window.__studiobookPushToast({ title, body, url: n?.launchURL || n?.url });
        }
      } catch {
        /* ignore */
      }
    });
  } catch (err) {
    console.warn("OneSignal foreground listener:", err?.message || err);
  }

  try {
    OneSignal.User.PushSubscription.addEventListener("change", async (event) => {
      const current = event?.current || {};
      const id = current.id ? String(current.id) : null;
      const userId = lastLoginUserId || OneSignal.User?.externalId || null;
      if (userId && id && current.optedIn) {
        await persistSubscriptionId(userId, id);
      }
    });
  } catch (err) {
    console.warn("OneSignal subscription listener:", err?.message || err);
  }
}

async function ensurePushPermission(OneSignal) {
  try {
    const permission =
      OneSignal.Notifications?.permissionNative ||
      (typeof Notification !== "undefined" ? Notification.permission : "default");

    if (permission === "denied") {
      console.warn("OneSignal: notifications blocked for this site.");
      return false;
    }

    if (permission !== "granted") {
      if (typeof OneSignal.Notifications?.requestPermission === "function") {
        await OneSignal.Notifications.requestPermission();
      } else if (typeof Notification !== "undefined" && Notification.requestPermission) {
        await Notification.requestPermission();
      }
    }

    if (typeof OneSignal.User?.PushSubscription?.optIn === "function") {
      await OneSignal.User.PushSubscription.optIn();
    }

    await new Promise((r) => setTimeout(r, 800));

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

async function waitForSubscription(OneSignal, attempts = 12) {
  for (let i = 0; i < attempts; i++) {
    const sub = OneSignal.User?.PushSubscription;
    const id = sub?.id || null;
    const token = sub?.token || null;
    const optedIn = sub?.optedIn === true;
    // Token can lag behind id; id + optedIn is enough to send via REST
    if (id && optedIn) {
      return {
        id: String(id),
        token: token ? String(token) : null,
        optedIn: true,
      };
    }
    await new Promise((r) => setTimeout(r, 400));
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

/**
 * Initialize / refresh OneSignal for a logged-in user.
 * Safe to call often — only one login flow runs at a time per user.
 */
export async function initOneSignal(userId) {
  if (!userId || typeof window === "undefined") return;

  if (loginInFlight && lastLoginUserId === String(userId)) {
    return loginInFlight;
  }

  loginInFlight = (async () => {
    try {
      const OneSignal = await ensureInit();
      if (!OneSignal) return;

      const subscribed = await ensurePushPermission(OneSignal);

      if (typeof OneSignal.User?.PushSubscription?.optIn === "function") {
        await OneSignal.User.PushSubscription.optIn();
      }

      // Attach External ID (Supabase user id) so REST can target this user
      await OneSignal.login(String(userId));
      lastLoginUserId = String(userId);

      if (typeof OneSignal.User?.PushSubscription?.optIn === "function") {
        await OneSignal.User.PushSubscription.optIn();
      }

      const push = await waitForSubscription(OneSignal);
      if (push.id) {
        await persistSubscriptionId(userId, push.id);
      }

      console.info("OneSignal ready:", {
        userId: String(userId),
        subscribed,
        permission: typeof Notification !== "undefined" ? Notification.permission : "n/a",
        optedIn: push.optedIn,
        subscriptionId: push.id,
        hasToken: Boolean(push.token),
        externalId: OneSignal.User?.externalId || null,
        origin: window.location.origin,
      });
    } catch (err) {
      console.warn("OneSignal init skipped:", err?.message || err);
    } finally {
      loginInFlight = null;
    }
  })();

  return loginInFlight;
}

/** Explicit opt-in from Notifications page. */
export async function enablePushNotifications(userId) {
  if (!userId) return false;
  await initOneSignal(userId);
  const OneSignal = await getOneSignal().catch(() => null);
  const granted =
    typeof Notification !== "undefined" && Notification.permission === "granted";
  const optedIn = OneSignal?.User?.PushSubscription?.optedIn === true;
  const hasId = Boolean(OneSignal?.User?.PushSubscription?.id);
  return granted && optedIn && hasId;
}

export async function logoutOneSignal() {
  if (typeof window === "undefined" || !initPromise) return;
  try {
    const OneSignal = await getOneSignal();
    lastLoginUserId = null;
    await OneSignal.logout();
  } catch (err) {
    console.warn("OneSignal logout skipped:", err?.message || err);
  }
}
