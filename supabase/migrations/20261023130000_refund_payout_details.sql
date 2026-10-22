-- Clients name the GCash, Maya, or bank account that should receive a refund.
-- The studio still sends the money outside the app.

ALTER TABLE refund_requests
  ADD COLUMN IF NOT EXISTS payout_method TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS payout_account_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS payout_account_number TEXT NOT NULL DEFAULT '';

ALTER TABLE refund_requests DROP CONSTRAINT IF EXISTS refund_requests_payout_method_check;
ALTER TABLE refund_requests
  ADD CONSTRAINT refund_requests_payout_method_check
  CHECK (payout_method IN ('', 'gcash', 'maya', 'bank'));

CREATE OR REPLACE FUNCTION public.guard_refund_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT EXISTS (
      SELECT 1 FROM payments p
      WHERE p.booking_id = NEW.booking_id AND p.status = 'verified'
    ) THEN
      RAISE EXCEPTION 'refund_not_allowed: A verified payment is required before a refund can be requested.';
    END IF;
    IF EXISTS (
      SELECT 1 FROM refund_requests r
      WHERE r.booking_id = NEW.booking_id AND r.status IN ('pending', 'refunded')
    ) THEN
      RAISE EXCEPTION 'refund_exists: This booking already has an open or completed refund.';
    END IF;
    NEW.payout_method := lower(trim(COALESCE(NEW.payout_method, '')));
    NEW.payout_account_name := trim(COALESCE(NEW.payout_account_name, ''));
    NEW.payout_account_number := trim(COALESCE(NEW.payout_account_number, ''));
    IF NEW.payout_method NOT IN ('gcash', 'maya', 'bank')
       OR length(NEW.payout_account_name) < 2
       OR length(NEW.payout_account_number) < 5 THEN
      RAISE EXCEPTION 'refund_payout_required: Choose GCash, Maya, or bank, and enter the account name and number.';
    END IF;
    NEW.status := 'pending';
    NEW.reviewed_at := NULL;
    NEW.reviewed_by := NULL;
  ELSIF TG_OP = 'UPDATE' AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'refund_forbidden: Only the studio can review refunds.';
  END IF;
  RETURN NEW;
END;
$$;
