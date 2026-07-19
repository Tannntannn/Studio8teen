/**
 * Production OneSignal Web Push (v16).
 * Client pages prompt "Allow to receive notifications" when not subscribed yet.
 */
import Swal from "sweetalert2";
import { supabase } from "./supabase";

const APP_ID =
  import.meta.env.VITE_ONESIGNAL_APP_ID || "98cf69f1-7952-499b-89de-d3325ed49e3e";

const IS_LOCALHOST =
  typeof window !== "undefined" &&
  /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);

const PROMPT_SESSION_KEY = "studiobook_push_prompted";

let initPromise = null;
let OneSignalMod = null;
let listenersBound = false;
let lastLoginUserId = null;
let loginInFlight = null;
let permissionPromptInFlight = null;

async function getOneSignal() {
  if (!OneSignalMod) {
    OneSignalMod = (await import("react-onesignal")).default;
  }
  return OneSignalMod;
}

async function ensureInit() {
  if (typeof window === "undefined" || !APP_ID) return null;

  const OneSignal = await getOneSignal();

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
          if (scriptURL.includes("/onesignal/")) {
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
      ...(IS_LOCALHOST ? { allowLocalhostAsSecureOrigin: true } : {}),
      serviceWorkerPath: "OneSignalSDKWorker.js",
      serviceWorkerParam: { scope: "/" },
      notifyButton: { enable: false },
      promptOptions: {
        slidedown: { prompts: [{ type: "push", autoPrompt: false }] },
      },
      welcomeNotification: { disable: true },
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

function nativePermission() {
  return (
    (typeof Notification !== "undefined" ? Notification.permission : "default") || "default"
  );
}

function isPushSubscribed(OneSignal) {
  const sub = OneSignal?.User?.PushSubscription;
  return Boolean(sub?.optedIn && sub?.id);
}

async function optInPush(OneSignal) {
  if (typeof OneSignal.User?.PushSubscription?.optIn === "function") {
    await OneSignal.User.PushSubscription.optIn();
  }
}

async function requestNativePermission(OneSignal) {
  if (typeof OneSignal.Notifications?.requestPermission === "function") {
    await OneSignal.Notifications.requestPermission();
  } else if (typeof Notification !== "undefined" && Notification.requestPermission) {
    await Notification.requestPermission();
  }
}

function markPrompted() {
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(PROMPT_SESSION_KEY, "1");
    }
  } catch {
    /* ignore */
  }
}

function wasPrompted() {
  try {
    return typeof sessionStorage !== "undefined" && sessionStorage.getItem(PROMPT_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function clearPrompted() {
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(PROMPT_SESSION_KEY);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Show "Allow to receive notifications" when the client is not subscribed yet.
 * Works on desktop and phone (custom modal → browser permission).
 */
async function showAllowNotificationsPrompt(OneSignal) {
  if (permissionPromptInFlight) return permissionPromptInFlight;

  permissionPromptInFlight = (async () => {
    markPrompted();

    const { isConfirmed } = await Swal.fire({
      title: "Allow to receive notifications?",
      text: "Get alerts when your booking is confirmed, rescheduled, or cancelled.",
      icon: "info",
      showCancelButton: true,
      confirmButtonText: "Allow",
      cancelButtonText: "Not now",
      confirmButtonColor: "#A98B75",
      reverseButtons: true,
      allowOutsideClick: false,
      heightAuto: false,
    });

    if (!isConfirmed) return false;

    if (nativePermission() === "default") {
      await requestNativePermission(OneSignal);
    }

    if (nativePermission() === "default") {
      try {
        if (typeof OneSignal.Slidedown?.promptPush === "function") {
          await OneSignal.Slidedown.promptPush();
        }
      } catch {
        /* ignore */
      }
      if (nativePermission() === "default") {
        await requestNativePermission(OneSignal);
      }
    }

    if (nativePermission() === "denied") return false;

    await optInPush(OneSignal);
    await new Promise((r) => setTimeout(r, 600));
    return isPushSubscribed(OneSignal) || nativePermission() === "granted";
  })();

  try {
    return await permissionPromptInFlight;
  } finally {
    permissionPromptInFlight = null;
  }
}

async function waitForSubscription(OneSignal, attempts = 12) {
  for (let i = 0; i < attempts; i++) {
    const sub = OneSignal.User?.PushSubscription;
    if (sub?.id && sub?.optedIn) {
      return {
        id: String(sub.id),
        token: sub.token ? String(sub.token) : null,
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

/** Soft init: register SDK + login, do not show popup. */
export async function initOneSignal(userId) {
  if (!userId || typeof window === "undefined") return;

  if (loginInFlight && lastLoginUserId === String(userId)) {
    return loginInFlight;
  }

  loginInFlight = (async () => {
    try {
      const OneSignal = await ensureInit();
      if (!OneSignal) return;

      await OneSignal.login(String(userId));
      lastLoginUserId = String(userId);

      if (nativePermission() === "granted") {
        await optInPush(OneSignal);
      }

      const push = await waitForSubscription(OneSignal);
      if (push.id) await persistSubscriptionId(userId, push.id);

      console.info("OneSignal ready:", {
        userId: String(userId),
        permission: nativePermission(),
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

/**
 * Call from client pages after login.
 * Shows Allow popup only if not subscribed yet.
 */
export async function promptPushIfNeeded(userId) {
  if (!userId || typeof window === "undefined") return false;
  if (typeof Notification === "undefined") return false;

  try {
    const OneSignal = await ensureInit();
    if (!OneSignal) return false;

    await OneSignal.login(String(userId));
    lastLoginUserId = String(userId);

    if (nativePermission() === "denied") return false;

    // Already subscribed — no popup
    if (isPushSubscribed(OneSignal)) {
      await persistSubscriptionId(userId, OneSignal.User.PushSubscription.id);
      return true;
    }

    // Wait a beat for SDK subscription state to settle after login
    await new Promise((r) => setTimeout(r, 500));
    if (isPushSubscribed(OneSignal)) {
      await persistSubscriptionId(userId, OneSignal.User.PushSubscription.id);
      return true;
    }

    // One Allow popup per browser session
    if (wasPrompted()) return false;

    const ok = await showAllowNotificationsPrompt(OneSignal);
    const push = await waitForSubscription(OneSignal);
    if (push.id) await persistSubscriptionId(userId, push.id);
    return ok;
  } catch (err) {
    console.warn("promptPushIfNeeded:", err?.message || err);
    return false;
  }
}

/** Explicit opt-in from Notifications page. */
export async function enablePushNotifications(userId) {
  if (!userId) return false;
  clearPrompted();
  try {
    const OneSignal = await ensureInit();
    if (!OneSignal) return false;
    await OneSignal.login(String(userId));
    lastLoginUserId = String(userId);
    const ok = await showAllowNotificationsPrompt(OneSignal);
    const push = await waitForSubscription(OneSignal);
    if (push.id) await persistSubscriptionId(userId, push.id);
    return ok && (isPushSubscribed(OneSignal) || nativePermission() === "granted");
  } catch (err) {
    console.warn("enablePushNotifications:", err?.message || err);
    return false;
  }
}

export async function logoutOneSignal() {
  if (typeof window === "undefined" || !initPromise) return;
  try {
    const OneSignal = await getOneSignal();
    lastLoginUserId = null;
    clearPrompted();
    await OneSignal.logout();
  } catch (err) {
    console.warn("OneSignal logout skipped:", err?.message || err);
  }
}
