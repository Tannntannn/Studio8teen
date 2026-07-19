/**
 * OneSignal Web SDK (v16) via react-onesignal.
 * Order matters: init → get permission/subscription → login(external_id).
 * Logging in before a subscription exists leaves the External ID unlinked to push.
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
        /* continue to native */
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

    // Give the SDK a moment to register the subscription with OneSignal servers
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

/**
 * Call after successful login.
 * Must subscribe first, then login so External ID attaches to the web push subscription.
 */
export async function initOneSignal(userId) {
  if (!userId || typeof window === "undefined") return;

  try {
    const OneSignal = await ensureInit();
    if (!OneSignal) return;

    const subscribed = await ensurePushPermission(OneSignal);

    // Link External ID AFTER subscription exists
    await OneSignal.login(String(userId));

    // Re-affirm opt-in after identity link (some browsers drop it across login)
    if (typeof OneSignal.User?.PushSubscription?.optIn === "function") {
      await OneSignal.User.PushSubscription.optIn();
    }

    const subscriptionId = OneSignal.User?.PushSubscription?.id || null;
    console.info("OneSignal ready:", {
      userId: String(userId),
      subscribed,
      permission: typeof Notification !== "undefined" ? Notification.permission : "n/a",
      optedIn: OneSignal.User?.PushSubscription?.optedIn,
      subscriptionId,
    });
  } catch (err) {
    console.warn("OneSignal init skipped:", err?.message || err);
  }
}

/** Manual re-subscribe (e.g. from Notifications page). */
export async function enablePushNotifications(userId) {
  if (!userId) return false;
  await initOneSignal(userId);
  if (typeof Notification !== "undefined") {
    return Notification.permission === "granted";
  }
  return false;
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
