-- Clients can cancel a confirmed booking immediately. There is no cancellation fee.
-- Bookings already waiting on the old fee flow can move straight to cancelled.

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

UPDATE faq_entries
SET
  answer = 'Yes. You can cancel from your booking page. There is no cancellation fee. Rescheduling is handled by the studio. If you already paid, you can request a refund. An approved refund cancels the booking, and the studio returns the money manually.',
  keywords = ARRAY['cancel', 'cancellation', 'reschedule', 'refund']
WHERE question ILIKE '%cancel%';
