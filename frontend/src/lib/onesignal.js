/**
 * OneSignal Web SDK (v16) via react-onesignal.
 * Docs: https://documentation.onesignal.com/docs/en/web-sdk-setup
 * React: https://documentation.onesignal.com/docs/en/react-js-setup
 *
 * Requires public/OneSignalSDKWorker.js served at /OneSignalSDKWorker.js
 */
const APP_ID =
  import.meta.env.VITE_ONESIGNAL_APP_ID || "98cf69f1-7952-499b-89de-d3325ed49e3e";

const CONSENT_KEY = "studiobook_onesignal_prompted";

let initPromise = null;
let OneSignalMod = null;

async function getOneSignal() {
  if (!OneSignalMod) {
    OneSignalMod = (await import("react-onesignal")).default;
  }
  return OneSignalMod;
}

/** Initialize SDK once; safe under React StrictMode double-mount. */
async function ensureInit() {
  if (typeof window === "undefined" || !APP_ID) return null;

  const OneSignal = await getOneSignal();

  if (!initPromise) {
    initPromise = OneSignal.init({
      appId: APP_ID,
      allowLocalhostAsSecureOrigin: true,
      serviceWorkerPath: "OneSignalSDKWorker.js",
      serviceWorkerParam: { scope: "/" },
    }).catch((err) => {
      // Reset so a later call can retry (e.g. after StrictMode remount race)
      initPromise = null;
      throw err;
    });
  }

  await initPromise;
  return OneSignal;
}

/**
 * Call after successful login. Links the push subscription to this user (External ID)
 * and prompts for permission once per browser profile.
 */
export async function initOneSignal(userId) {
  if (!userId || typeof window === "undefined") return;

  try {
    const OneSignal = await ensureInit();
    if (!OneSignal) return;

    await OneSignal.login(String(userId));

    if (!localStorage.getItem(CONSENT_KEY)) {
      try {
        await OneSignal.Slidedown.promptPush();
        localStorage.setItem(CONSENT_KEY, "1");
      } catch {
        /* dismissed — allow retry later */
      }
    }
  } catch (err) {
    console.warn("OneSignal init skipped:", err?.message || err);
  }
}

/** Clear External ID on logout so the next user is not mixed with this device. */
export async function logoutOneSignal() {
  if (typeof window === "undefined" || !initPromise) return;
  try {
    const OneSignal = await getOneSignal();
    await OneSignal.logout();
  } catch (err) {
    console.warn("OneSignal logout skipped:", err?.message || err);
  }
}
