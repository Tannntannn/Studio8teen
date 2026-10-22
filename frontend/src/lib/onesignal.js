/**
 * Production OneSignal Web Push (v16).
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

export function pushAcceptedKey(userId) {
  return `studiobook_push_accepted_${userId}`;
}

/** In-memory only: survives SPA page changes, clears on refresh or logout */
const dismissedPushPrompts = new Set();

export function hasAcceptedPushPrompt(userId) {
  try {
    return Boolean(userId && localStorage.getItem(pushAcceptedKey(userId)));
  } catch {
    return false;
  }
}

export function hasDismissedPushPrompt(userId) {
  return Boolean(userId && dismissedPushPrompts.has(String(userId)));
}

export function markPushAccepted(userId) {
  try {
    if (userId) localStorage.setItem(pushAcceptedKey(userId), "1");
  } catch {
    /* ignore */
  }
}

export function markPushDismissed(userId) {
  if (userId) dismissedPushPrompts.add(String(userId));
}

export function clearAllPushDismissed() {
  dismissedPushPrompts.clear();
}

function withTimeout(promise, ms, label = "operation") {
  let timer;
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

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

  await withTimeout(initPromise, 8000, "OneSignal.init");
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

async function optInPush(OneSignal) {
  if (typeof OneSignal.User?.PushSubscription?.optIn !== "function") return;
  try {
    await withTimeout(OneSignal.User.PushSubscription.optIn(), 5000, "PushSubscription.optIn");
  } catch (err) {
    console.warn("OneSignal optIn:", err?.message || err);
  }
}

/** Call from a click handler BEFORE any other awaits to keep the user gesture. */
export async function requestBrowserNotificationPermission() {
  if (typeof Notification === "undefined") return "denied";
  if (Notification.permission !== "default") return Notification.permission;
  try {
    const result = await Notification.requestPermission();
    return result || Notification.permission;
  } catch {
    return Notification.permission;
  }
}

async function waitForSubscription(OneSignal, attempts = 6) {
  for (let i = 0; i < attempts; i++) {
    const sub = OneSignal.User?.PushSubscription;
    if (sub?.id && sub?.optedIn) {
      return {
        id: String(sub.id),
        token: sub.token ? String(sub.token) : null,
        optedIn: true,
      };
    }
    await new Promise((r) => setTimeout(r, 350));
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
    await withTimeout(
      supabase
        .from("profiles")
        .update({ onesignal_subscription_id: String(subscriptionId) })
        .eq("id", userId),
      4000,
      "persistSubscriptionId"
    );
  } catch (err) {
    console.warn("Could not save OneSignal subscription id:", err?.message || err);
  }
  return subscriptionId;
}

/** Soft init only — never shows UI. */
export async function initOneSignal(userId) {
  if (!userId || typeof window === "undefined") return;

  if (loginInFlight && lastLoginUserId === String(userId)) {
    return loginInFlight;
  }

  loginInFlight = (async () => {
    try {
      const OneSignal = await ensureInit();
      if (!OneSignal) return;

      try {
        await withTimeout(OneSignal.login(String(userId)), 5000, "OneSignal.login");
      } catch (err) {
        console.warn("OneSignal.login:", err?.message || err);
      }
      lastLoginUserId = String(userId);

      if (hasAcceptedPushPrompt(userId) && nativePermission() === "granted") {
        await optInPush(OneSignal);
        const push = await waitForSubscription(OneSignal);
        if (push.id) await persistSubscriptionId(userId, push.id);
      }

      console.info("OneSignal ready:", {
        userId: String(userId),
        permission: nativePermission(),
        optedIn: OneSignal.User?.PushSubscription?.optedIn,
        subscriptionId: OneSignal.User?.PushSubscription?.id || null,
        acceptedPrompt: hasAcceptedPushPrompt(userId),
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

/** Whether client UI should show the Allow notifications modal. */
export function shouldShowPushPrompt(userId) {
  if (!userId || typeof window === "undefined") return false;
  if (typeof Notification === "undefined") return false;
  if (hasAcceptedPushPrompt(userId)) return false;
  if (hasDismissedPushPrompt(userId)) return false;
  return true;
}

export function isPushPermissionDenied() {
  return typeof Notification !== "undefined" && Notification.permission === "denied";
}

/**
 * User clicked Allow — permission should already be requested in the click handler.
 * Completes OneSignal login/opt-in with timeouts so the UI never hangs.
 */
export async function acceptPushNotifications(userId) {
  if (!userId) return false;
  try {
    // If permission still default (caller forgot to request), try once more
    if (nativePermission() === "default") {
      await requestBrowserNotificationPermission();
    }

    if (nativePermission() === "denied") {
      return false;
    }

    const OneSignal = await ensureInit();
    if (!OneSignal) {
      // Permission may still be granted — treat as partial success
      if (nativePermission() === "granted") {
        markPushAccepted(userId);
        return true;
      }
      return false;
    }

    try {
      await withTimeout(OneSignal.login(String(userId)), 5000, "OneSignal.login");
    } catch (err) {
      console.warn("OneSignal.login during accept:", err?.message || err);
    }
    lastLoginUserId = String(userId);

    if (nativePermission() === "granted") {
      await optInPush(OneSignal);
    }

    const push = await waitForSubscription(OneSignal);
    if (push.id) await persistSubscriptionId(userId, push.id);

    // Close the loop once browser permission is granted, even if OneSignal id lags
    if (nativePermission() === "granted") {
      markPushAccepted(userId);
      return true;
    }

    return false;
  } catch (err) {
    console.warn("acceptPushNotifications:", err?.message || err);
    // Don't leave the user stuck — if they already allowed in the browser, count it
    if (nativePermission() === "granted") {
      markPushAccepted(userId);
      return true;
    }
    return false;
  }
}

export async function logoutOneSignal() {
  // Always reset "Not now" so the prompt can show again after next login
  clearAllPushDismissed();
  if (typeof window === "undefined" || !initPromise) return;
  try {
    const OneSignal = await getOneSignal();
    lastLoginUserId = null;
    await withTimeout(OneSignal.logout(), 3000, "OneSignal.logout").catch(() => {});
  } catch (err) {
    console.warn("OneSignal logout skipped:", err?.message || err);
  }
}
