/**
 * Production OneSignal Web Push (v16).
 * On client login: show Allow popup → native permission → save subscription.
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
        slidedown: {
          prompts: [
            {
              type: "push",
              autoPrompt: false,
              text: {
                actionMessage: "Allow booking updates on this device?",
                acceptButton: "Allow",
                cancelButton: "Not now",
              },
            },
          ],
        },
      },
      welcomeNotification: {
        disable: true,
      },
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

/**
 * Reliable Allow UI for desktop + phone.
 * Custom modal first (user click = gesture), then browser permission dialog.
 */
async function ensurePushPermission(OneSignal, { forcePrompt = false } = {}) {
  try {
    const permission = nativePermission();

    if (permission === "denied") {
      console.warn("OneSignal: notifications blocked for this site.");
      return false;
    }

    if (permission === "granted") {
      await optInPush(OneSignal);
      return true;
    }

    // permission === "default" — one Allow popup per browser session
    const alreadyPrompted =
      typeof sessionStorage !== "undefined" &&
      sessionStorage.getItem(PROMPT_SESSION_KEY) === "1";

    if (alreadyPrompted && !forcePrompt) {
      return false;
    }

    // forcePrompt from Notifications page clears the flag first; login uses forcePrompt once
    if (alreadyPrompted && forcePrompt) {
      // Another login handler already showed the popup this session
      return nativePermission() === "granted";
    }

    if (permissionPromptInFlight) {
      return permissionPromptInFlight;
    }

    permissionPromptInFlight = (async () => {
      try {
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.setItem(PROMPT_SESSION_KEY, "1");
        }
      } catch {
        /* ignore */
      }

      const { isConfirmed } = await Swal.fire({
        title: "Enable notifications?",
        text: "Allow alerts when your booking is confirmed, rescheduled, or cancelled.",
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Allow",
        cancelButtonText: "Not now",
        confirmButtonColor: "#A98B75",
        reverseButtons: true,
        allowOutsideClick: false,
      });

      if (!isConfirmed) return false;

      // Gesture from Swal Allow → browser can show native permission dialog on desktop
      await requestNativePermission(OneSignal);

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

      if (nativePermission() === "granted") {
        await optInPush(OneSignal);
        return true;
      }

      return false;
    })();

    try {
      return await permissionPromptInFlight;
    } finally {
      permissionPromptInFlight = null;
    }
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
 * @param {string} userId
 * @param {{ forcePrompt?: boolean }} [options]
 */
export async function initOneSignal(userId, options = {}) {
  if (!userId || typeof window === "undefined") return;

  const forcePrompt = Boolean(options.forcePrompt);

  if (loginInFlight && lastLoginUserId === String(userId) && !forcePrompt) {
    return loginInFlight;
  }

  // If a soft init is running, wait then continue with force prompt if needed
  if (loginInFlight && forcePrompt) {
    try {
      await loginInFlight;
    } catch {
      /* ignore */
    }
  }

  loginInFlight = (async () => {
    try {
      const OneSignal = await ensureInit();
      if (!OneSignal) return;

      const subscribed = await ensurePushPermission(OneSignal, { forcePrompt });

      await OneSignal.login(String(userId));
      lastLoginUserId = String(userId);

      if (subscribed) await optInPush(OneSignal);

      const push = await waitForSubscription(OneSignal);
      if (push.id) {
        await persistSubscriptionId(userId, push.id);
      }

      console.info("OneSignal ready:", {
        userId: String(userId),
        subscribed,
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

/** Explicit opt-in from Notifications page. */
export async function enablePushNotifications(userId) {
  if (!userId) return false;
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(PROMPT_SESSION_KEY);
    }
  } catch {
    /* ignore */
  }
  await initOneSignal(userId, { forcePrompt: true });
  const OneSignal = await getOneSignal().catch(() => null);
  const granted = nativePermission() === "granted";
  const optedIn = OneSignal?.User?.PushSubscription?.optedIn === true;
  const hasId = Boolean(OneSignal?.User?.PushSubscription?.id);
  return granted && optedIn && hasId;
}

export async function logoutOneSignal() {
  if (typeof window === "undefined" || !initPromise) return;
  try {
    const OneSignal = await getOneSignal();
    lastLoginUserId = null;
    try {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem(PROMPT_SESSION_KEY);
      }
    } catch {
      /* ignore */
    }
    await OneSignal.logout();
  } catch (err) {
    console.warn("OneSignal logout skipped:", err?.message || err);
  }
}
