/**
 * Production OneSignal Web Push (v16).
 * On login: ask permission once → opt-in → login(external_id) → save subscription.
 */
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
      // We prompt ourselves on login — disable dashboard auto prompts colliding
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

  // OS notification is enough — don't also fire an in-page toast from the same push
  // (in-app toast still comes from the notifications table realtime insert)

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

/**
 * Ask for push permission (desktop + mobile).
 * Uses OneSignal slidedown then native prompt when still default.
 */
async function ensurePushPermission(OneSignal, { forcePrompt = false } = {}) {
  try {
    const permission = nativePermission();

    if (permission === "denied") {
      console.warn("OneSignal: notifications blocked for this site.");
      return false;
    }

    if (permission === "granted") {
      if (typeof OneSignal.User?.PushSubscription?.optIn === "function") {
        await OneSignal.User.PushSubscription.optIn();
      }
      return true;
    }

    // permission === "default" — ask once per browser session unless forced
    const alreadyPrompted =
      typeof sessionStorage !== "undefined" &&
      sessionStorage.getItem(PROMPT_SESSION_KEY) === "1";

    if (!forcePrompt && alreadyPrompted) {
      return false;
    }

    try {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem(PROMPT_SESSION_KEY, "1");
      }
    } catch {
      /* ignore */
    }

    // Soft OneSignal prompt first (works well on mobile + desktop)
    try {
      if (typeof OneSignal.Slidedown?.promptPush === "function") {
        await OneSignal.Slidedown.promptPush();
      }
    } catch {
      /* continue to native */
    }

    // Native browser permission dialog
    if (nativePermission() === "default") {
      if (typeof OneSignal.Notifications?.requestPermission === "function") {
        await OneSignal.Notifications.requestPermission();
      } else if (typeof Notification !== "undefined" && Notification.requestPermission) {
        await Notification.requestPermission();
      }
    }

    if (nativePermission() === "granted") {
      if (typeof OneSignal.User?.PushSubscription?.optIn === "function") {
        await OneSignal.User.PushSubscription.optIn();
      }
      return true;
    }

    return false;
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
 * @param {{ forcePrompt?: boolean }} [options] forcePrompt=true after explicit login click
 */
export async function initOneSignal(userId, options = {}) {
  if (!userId || typeof window === "undefined") return;

  const forcePrompt = Boolean(options.forcePrompt);

  if (loginInFlight && lastLoginUserId === String(userId) && !forcePrompt) {
    return loginInFlight;
  }

  loginInFlight = (async () => {
    try {
      const OneSignal = await ensureInit();
      if (!OneSignal) return;

      const subscribed = await ensurePushPermission(OneSignal, { forcePrompt });

      await OneSignal.login(String(userId));
      lastLoginUserId = String(userId);

      if (subscribed && typeof OneSignal.User?.PushSubscription?.optIn === "function") {
        await OneSignal.User.PushSubscription.optIn();
      }

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

/** Explicit opt-in from Notifications page — always show permission UI if needed. */
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
    await OneSignal.logout();
  } catch (err) {
    console.warn("OneSignal logout skipped:", err?.message || err);
  }
}
