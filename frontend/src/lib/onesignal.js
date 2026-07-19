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

export function pushDismissedKey(userId) {
  return `studiobook_push_dismissed_${userId}`;
}

export function hasAcceptedPushPrompt(userId) {
  try {
    return Boolean(userId && localStorage.getItem(pushAcceptedKey(userId)));
  } catch {
    return false;
  }
}

export function hasDismissedPushPrompt(userId) {
  try {
    return Boolean(userId && sessionStorage.getItem(pushDismissedKey(userId)));
  } catch {
    return false;
  }
}

export function markPushAccepted(userId) {
  try {
    if (userId) localStorage.setItem(pushAcceptedKey(userId), "1");
  } catch {
    /* ignore */
  }
}

export function markPushDismissed(userId) {
  try {
    if (userId) sessionStorage.setItem(pushDismissedKey(userId), "1");
  } catch {
    /* ignore */
  }
}

export function clearPushPromptFlags(userId) {
  try {
    if (userId) {
      sessionStorage.removeItem(pushDismissedKey(userId));
    }
  } catch {
    /* ignore */
  }
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

      await OneSignal.login(String(userId));
      lastLoginUserId = String(userId);

      // Only auto-opt-in if user already accepted our Allow prompt
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
  if (nativePermission() === "denied") return false;
  if (hasAcceptedPushPrompt(userId)) return false;
  if (hasDismissedPushPrompt(userId)) return false;
  return true;
}

/**
 * User clicked Allow on our modal — request browser permission + opt in.
 * Must be called from a click handler (user gesture) for desktop Chrome.
 */
export async function acceptPushNotifications(userId) {
  if (!userId) return false;
  try {
    const OneSignal = await ensureInit();
    if (!OneSignal) return false;

    await OneSignal.login(String(userId));
    lastLoginUserId = String(userId);

    if (nativePermission() === "default") {
      await requestNativePermission(OneSignal);
    }

    if (nativePermission() === "denied") {
      return false;
    }

    await optInPush(OneSignal);
    const push = await waitForSubscription(OneSignal);
    if (push.id) await persistSubscriptionId(userId, push.id);

    markPushAccepted(userId);
    return nativePermission() === "granted";
  } catch (err) {
    console.warn("acceptPushNotifications:", err?.message || err);
    return false;
  }
}

/** Notifications page button. */
export async function enablePushNotifications(userId) {
  if (!userId) return false;
  clearPushPromptFlags(userId);
  return acceptPushNotifications(userId);
}

export async function logoutOneSignal() {
  if (typeof window === "undefined" || !initPromise) return;
  try {
    const OneSignal = await getOneSignal();
    if (lastLoginUserId) clearPushPromptFlags(lastLoginUserId);
    lastLoginUserId = null;
    await OneSignal.logout();
  } catch (err) {
    console.warn("OneSignal logout skipped:", err?.message || err);
  }
}
