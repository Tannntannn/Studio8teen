/**
 * OneSignal web push — init once after login and link subscription to user id.
 * Consent is stored so the permission prompt only runs once per browser profile.
 */
const CONSENT_KEY = "studiobook_onesignal_prompted";

export async function initOneSignal(userId) {
  const appId = import.meta.env.VITE_ONESIGNAL_APP_ID;
  if (!appId || !userId || typeof window === "undefined") return;

  try {
    const OneSignal = (await import("react-onesignal")).default;
    await OneSignal.init({
      appId,
      allowLocalhostAsSecureOrigin: true,
    });
    await OneSignal.login(String(userId));

    if (!localStorage.getItem(CONSENT_KEY)) {
      localStorage.setItem(CONSENT_KEY, "1");
      try {
        await OneSignal.Slidedown.promptPush();
      } catch {
        /* user dismissed or already decided */
      }
    }
  } catch (err) {
    console.warn("OneSignal init skipped:", err?.message || err);
  }
}
