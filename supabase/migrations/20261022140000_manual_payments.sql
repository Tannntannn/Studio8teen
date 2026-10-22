-- Manual bank transfer stores a reference number beside the payment screenshot.

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS reference_number TEXT;

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS payment_method TEXT;
