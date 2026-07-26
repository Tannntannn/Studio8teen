-- Critical: close INSERT privilege gaps left by UPDATE-only protect triggers.
-- Also harden cancellations fields and lengthen QR tokens.

-- 1) Bookings: clients may only INSERT as awaiting_payment/pending with no QR
CREATE OR REPLACE FUNCTION public.protect_booking_client_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ok_status BOOLEAN := false;
BEGIN
  IF public.is_admin() THEN
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

DROP TRIGGER IF EXISTS protect_booking_client_updates ON public.bookings;
DROP TRIGGER IF EXISTS protect_booking_client_writes ON public.bookings;
CREATE TRIGGER protect_booking_client_updates
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_booking_client_updates();

-- 2) Payments: clients may only INSERT as awaiting/submitted (never verified)
CREATE OR REPLACE FUNCTION public.protect_payment_client_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin() THEN
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

DROP TRIGGER IF EXISTS protect_payment_client_updates ON public.payments;
DROP TRIGGER IF EXISTS protect_payment_client_writes ON public.payments;
CREATE TRIGGER protect_payment_client_updates
  BEFORE INSERT OR UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_payment_client_updates();

-- 3) Cancellations: lock fee_amount / refund_status / verified inserts
CREATE OR REPLACE FUNCTION public.protect_cancellation_client_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.fee_status IS NULL OR NEW.fee_status NOT IN ('awaiting', 'submitted') THEN
      NEW.fee_status := 'awaiting';
    END IF;
    IF NEW.refund_status IS NULL OR NEW.refund_status NOT IN ('na', 'pending') THEN
      NEW.refund_status := 'na';
    END IF;
    NEW.fee_admin_notes := NULL;
    RETURN NEW;
  END IF;

  IF NEW.booking_id IS DISTINCT FROM OLD.booking_id THEN
    RAISE EXCEPTION 'cancellation_forbidden: Cannot reassign cancellation.';
  END IF;

  IF NEW.fee_amount IS DISTINCT FROM OLD.fee_amount THEN
    RAISE EXCEPTION 'cancellation_forbidden: Clients cannot change fee amount.';
  END IF;

  IF NEW.refund_status IS DISTINCT FROM OLD.refund_status THEN
    RAISE EXCEPTION 'cancellation_forbidden: Clients cannot change refund status.';
  END IF;

  IF NEW.fee_status IS DISTINCT FROM OLD.fee_status THEN
    IF NOT (
      (OLD.fee_status IN ('awaiting', 'rejected') AND NEW.fee_status IN ('awaiting', 'submitted'))
    ) THEN
      RAISE EXCEPTION 'cancellation_forbidden: Illegal fee status change.';
    END IF;
  END IF;

  IF NEW.fee_status = 'verified' THEN
    RAISE EXCEPTION 'cancellation_forbidden: Clients cannot verify cancellation fees.';
  END IF;

  IF NEW.fee_admin_notes IS DISTINCT FROM OLD.fee_admin_notes THEN
    RAISE EXCEPTION 'cancellation_forbidden: Clients cannot set admin notes.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_cancellation_client_updates ON public.cancellations;
DROP TRIGGER IF EXISTS protect_cancellation_client_writes ON public.cancellations;
CREATE TRIGGER protect_cancellation_client_updates
  BEFORE INSERT OR UPDATE ON public.cancellations
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_cancellation_client_updates();

-- 4) Longer QR tokens (32 hex chars) — existing short tokens still verify
CREATE OR REPLACE FUNCTION public.admin_verify_payment(p_payment_id uuid, p_booking_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_booking public.bookings%ROWTYPE;
  v_token text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_only: Payment verification requires admin.';
  END IF;

  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment_not_found';
  END IF;
  IF v_payment.booking_id IS DISTINCT FROM p_booking_id THEN
    RAISE EXCEPTION 'payment_mismatch: Payment does not belong to this booking.';
  END IF;
  IF v_payment.status IS DISTINCT FROM 'submitted' THEN
    RAISE EXCEPTION 'payment_not_submitted: Payment must be submitted before verification.';
  END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_not_found';
  END IF;
  IF v_booking.status IS DISTINCT FROM 'payment_submitted' THEN
    RAISE EXCEPTION 'booking_not_ready: Booking must be payment_submitted.';
  END IF;

  v_token := replace(gen_random_uuid()::text, '-', '');

  UPDATE public.payments
  SET
    status = 'verified',
    verified_by = auth.uid(),
    verified_at = NOW()
  WHERE id = p_payment_id;

  UPDATE public.bookings
  SET
    status = 'confirmed',
    qr_token = v_token,
    updated_at = NOW()
  WHERE id = p_booking_id;

  RETURN v_token;
END;
$$;

-- Stricter public QR verify min length (old 8-char tokens still work)
CREATE OR REPLACE FUNCTION public.verify_booking_qr(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  t text := trim(COALESCE(p_token, ''));
BEGIN
  IF length(t) < 8 THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'id', b.id,
    'status', b.status,
    'event_date', b.event_date,
    'time_slot', b.time_slot,
    'location', b.location,
    'qr_token', b.qr_token,
    'packages', jsonb_build_object('name', pkg.name, 'price', pkg.price),
    'profiles', jsonb_build_object('full_name', pr.full_name)
  )
  INTO result
  FROM public.bookings b
  LEFT JOIN public.packages pkg ON pkg.id = b.package_id
  LEFT JOIN public.profiles pr ON pr.id = b.client_id
  WHERE b.qr_token = t
    AND b.status IN ('confirmed', 'completed')
  LIMIT 1;

  RETURN result;
END;
$$;
