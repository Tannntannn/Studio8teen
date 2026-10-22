-- Account name and number shown beside the studio payment QR.

ALTER TABLE studio_settings
  ADD COLUMN IF NOT EXISTS bank_account_name TEXT NOT NULL DEFAULT '';

ALTER TABLE studio_settings
  ADD COLUMN IF NOT EXISTS bank_account_number TEXT NOT NULL DEFAULT '';
