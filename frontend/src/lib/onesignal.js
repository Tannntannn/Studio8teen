/**
 * OneSignal Web SDK (v16) via react-onesignal.
 * Docs: https://documentation.onesignal.com/docs/en/web-sdk-setup
 *
 * Requires public/OneSignalSDKWorker.js served at /OneSignalSDKWorker.js
 */
const APP_ID =
  import.meta.env.VITE_ONESIGNAL_APP_ID || "98cf69f1-7952-499b-89de-d3325ed49e3e";

let initPromise = null;
let OneSignalMod = null;

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
  return OneSignal;
}

async function ensurePushPermission(OneSignal) {
  try {
    const permission = OneSignal.Notifications?.permissionNative
      || (typeof Notification !== "undefined" ? Notification.permission : "default");
    const optedIn = OneSignal.User?.PushSubscription?.optedIn === true;

    if (permission === "granted" && optedIn) return true;

    if (permission === "denied") {
      console.warn("OneSignal: browser notifications are blocked for this site.");
      return false;
    }

    // Soft prompt (slidedown), then native if needed
    try {
      await OneSignal.Slidedown.promptPush();
    } catch {
      /* continue */
    }

    if (typeof OneSignal.Notifications?.requestPermission === "function") {
      await OneSignal.Notifications.requestPermission();
    }

    if (typeof OneSignal.User?.PushSubscription?.optIn === "function") {
      await OneSignal.User.PushSubscription.optIn();
    }

    return OneSignal.User?.PushSubscription?.optedIn === true
      || OneSignal.Notifications?.permissionNative === "granted"
      || (typeof Notification !== "undefined" && Notification.permission === "granted");
  } catch (err) {
    console.warn("OneSignal permission flow:", err?.message || err);
    return false;
  }
}

/**
 * Call after successful login. Links push subscription to this user (External ID).
 */
export async function initOneSignal(userId) {
  if (!userId || typeof window === "undefined") return;

  try {
    const OneSignal = await ensureInit();
    if (!OneSignal) return;

    await OneSignal.login(String(userId));
    const subscribed = await ensurePushPermission(OneSignal);
    console.info(
      "OneSignal ready:",
      { userId, subscribed, permission: typeof Notification !== "undefined" ? Notification.permission : "n/a" }
    );
  } catch (err) {
    console.warn("OneSignal init skipped:", err?.message || err);
  }
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
