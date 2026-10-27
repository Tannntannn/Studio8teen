-- Mobilization fee starts at 0. Clients cannot change it.
-- Revenue totals subtract approved refund requests. Bookings stay cancelled, not a refunded status.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS mobilization_fee NUMERIC(10,2) NOT NULL DEFAULT 0;

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_mobilization_fee_nonnegative;
ALTER TABLE bookings
  ADD CONSTRAINT bookings_mobilization_fee_nonnegative
  CHECK (mobilization_fee >= 0);

CREATE OR REPLACE FUNCTION public.protect_booking_client_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ok_status BOOLEAN := false;
  jwt_role TEXT := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
  );
BEGIN
  IF public.is_admin() OR jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.client_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'booking_forbidden: Cannot create booking for another user.';
    END IF;

    NEW.qr_token := NULL;
    NEW.admin_read_at := NULL;
    NEW.mobilization_fee := 0;
    IF NEW.status IS NULL OR NEW.status NOT IN ('pending', 'awaiting_payment') THEN
      NEW.status := 'awaiting_payment';
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.client_id IS DISTINCT FROM OLD.client_id THEN
    RAISE EXCEPTION 'booking_forbidden: Cannot reassign booking owner.';
  END IF;

  IF NEW.qr_token IS DISTINCT FROM OLD.qr_token THEN
    RAISE EXCEPTION 'booking_forbidden: Clients cannot set verification QR tokens.';
  END IF;

  IF NEW.admin_read_at IS DISTINCT FROM OLD.admin_read_at THEN
    RAISE EXCEPTION 'booking_forbidden: Clients cannot update admin read state.';
  END IF;

  IF NEW.mobilization_fee IS DISTINCT FROM OLD.mobilization_fee THEN
    RAISE EXCEPTION 'booking_forbidden: Clients cannot change the mobilization fee.';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status IN ('awaiting_payment', 'payment_submitted', 'pending', 'confirmed', 'cancellation_pending', 'cancellation_submitted')
       AND NEW.status = 'cancelled' THEN
      ok_status := true;
    ELSIF OLD.status IN ('awaiting_payment', 'pending')
       AND NEW.status = 'payment_submitted' THEN
      ok_status := true;
    ELSIF OLD.status = 'confirmed'
       AND NEW.status = 'cancellation_pending' THEN
      ok_status := true;
    ELSIF OLD.status = 'cancellation_pending'
       AND NEW.status = 'cancellation_submitted' THEN
      ok_status := true;
    END IF;

    IF NOT ok_status THEN
      RAISE EXCEPTION 'booking_forbidden: Illegal booking status change.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_revenue_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  verified_total NUMERIC(12,2);
  refunded_total NUMERIC(12,2);
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO verified_total
  FROM payments
  WHERE status = 'verified';

  SELECT COALESCE(SUM(amount), 0) INTO refunded_total
  FROM refund_requests
  WHERE status = 'refunded';

  RETURN json_build_object(
    'total_verified', verified_total,
    'total_refunded', refunded_total,
    'net_revenue', verified_total - refunded_total,
    'pending', COALESCE((SELECT SUM(amount) FROM payments WHERE status = 'submitted'), 0)
  );
END;
$$;
