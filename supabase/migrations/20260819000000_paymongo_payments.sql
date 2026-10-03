-- PayMongo checkout ids on payments + allow service-role (webhooks) to confirm.

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS paymongo_checkout_id TEXT,
  ADD COLUMN IF NOT EXISTS paymongo_payment_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS payments_paymongo_checkout_id_uidx
  ON public.payments (paymongo_checkout_id)
  WHERE paymongo_checkout_id IS NOT NULL;

COMMENT ON COLUMN public.payments.paymongo_checkout_id IS
  'PayMongo Checkout Session id (cs_...).';
COMMENT ON COLUMN public.payments.paymongo_payment_id IS
  'PayMongo Payment id after a successful checkout.';

-- Service role (Edge Functions) must be able to verify payments / confirm bookings.
CREATE OR REPLACE FUNCTION public.protect_payment_client_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(auth.role(), '') = 'service_role' OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.verified_by := NULL;
    NEW.verified_at := NULL;
    IF NEW.status IS NULL OR NEW.status NOT IN ('awaiting', 'submitted') THEN
      NEW.status := 'awaiting';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.booking_id IS DISTINCT FROM OLD.booking_id THEN
    RAISE EXCEPTION 'payment_forbidden: Cannot reassign payment booking.';
  END IF;

  IF NEW.verified_by IS DISTINCT FROM OLD.verified_by
     OR NEW.verified_at IS DISTINCT FROM OLD.verified_at THEN
    RAISE EXCEPTION 'payment_forbidden: Clients cannot verify payments.';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (
      (OLD.status IN ('awaiting', 'rejected') AND NEW.status IN ('awaiting', 'submitted'))
      OR (OLD.status = 'submitted' AND NEW.status = 'awaiting')
    ) THEN
      RAISE EXCEPTION 'payment_forbidden: Illegal payment status change.';
    END IF;
  END IF;

  IF NEW.status = 'verified' OR NEW.status = 'rejected' THEN
    RAISE EXCEPTION 'payment_forbidden: Clients cannot verify or reject payments.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_booking_client_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ok_status BOOLEAN := false;
BEGIN
  IF COALESCE(auth.role(), '') = 'service_role' OR public.is_admin() THEN
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
    IF OLD.status IN ('awaiting_payment', 'payment_submitted', 'pending')
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
