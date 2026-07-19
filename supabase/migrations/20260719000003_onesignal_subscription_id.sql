-- Store OneSignal web push subscription id for reliable targeting

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onesignal_subscription_id TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_onesignal_subscription_id
  ON profiles (onesignal_subscription_id)
  WHERE onesignal_subscription_id IS NOT NULL;
