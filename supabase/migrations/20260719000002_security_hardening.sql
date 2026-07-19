-- Harden auth, RLS, capacity, QR verify, and auto-cancel edge cases
-- Fixes critical privilege escalation and data exposure issues

-- 1) Signup: always create clients (never trust metadata role)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.email, ''),
    'client'
  );
  RETURN NEW;
END;
$$;

-- 2) Profiles: own row or admin only; block role self-escalation
DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());

CREATE OR REPLACE FUNCTION public.protect_profile_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.role IS DISTINCT FROM NEW.role AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'role_change_forbidden: Only admins can change roles.';
  END IF;
  IF TG_OP = 'UPDATE' AND NOT public.is_admin() THEN
    NEW.id := OLD.id;
    NEW.role := OLD.role;
    NEW.email := COALESCE(NEW.email, OLD.email);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_updates ON public.profiles;
CREATE TRIGGER protect_profile_updates
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_updates();

-- 3) Bookings: prevent clients from confirming / minting QR / illegal status jumps
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
CREATE TRIGGER protect_booking_client_updates
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_booking_client_updates();

-- 4) Payments: clients cannot self-verify
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
CREATE TRIGGER protect_payment_client_updates
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_payment_client_updates();

-- 5) Cancellations: clients cannot self-approve fee
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

  IF NEW.booking_id IS DISTINCT FROM OLD.booking_id THEN
    RAISE EXCEPTION 'cancellation_forbidden: Cannot reassign cancellation.';
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
CREATE TRIGGER protect_cancellation_client_updates
  BEFORE UPDATE ON public.cancellations
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_cancellation_client_updates();

-- 6) Remove open QR SELECT dump; exact-token RPC only
DROP POLICY IF EXISTS bookings_qr_verify ON public.bookings;

CREATE OR REPLACE FUNCTION public.verify_booking_qr(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 4 THEN
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
  WHERE b.qr_token = trim(p_token)
    AND b.status IN ('confirmed', 'completed')
  LIMIT 1;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_booking_qr(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_booking_qr(text) TO anon, authenticated;

-- 7) Atomic admin payment verification
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

  v_token := substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

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

REVOKE ALL ON FUNCTION public.admin_verify_payment(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_verify_payment(uuid, uuid) TO authenticated;

-- 8) Capacity race: advisory lock + live count
CREATE OR REPLACE FUNCTION public.enforce_booking_slot_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slot public.studio_availability%ROWTYPE;
  v_count INT;
  v_cap INT;
  v_enabled BOOLEAN;
  v_active BOOLEAN;
BEGIN
  v_active := NEW.status = ANY(public.active_booking_statuses());

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = ANY(public.active_booking_statuses()) AND NOT v_active THEN
      RETURN NEW;
    END IF;
    IF OLD.id = NEW.id
       AND OLD.event_date = NEW.event_date
       AND OLD.time_slot = NEW.time_slot
       AND OLD.status = ANY(public.active_booking_statuses())
       AND v_active THEN
      RETURN NEW;
    END IF;
  END IF;

  IF NOT v_active THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(NEW.event_date::text || '|' || NEW.time_slot));

  PERFORM public.sync_availability_slot(NEW.event_date, NEW.time_slot);

  SELECT * INTO v_slot
  FROM public.studio_availability
  WHERE avail_date = NEW.event_date AND time_slot = NEW.time_slot
  FOR UPDATE;

  IF NOT FOUND THEN
    v_cap := 2;
    v_enabled := true;
  ELSE
    v_cap := v_slot.capacity;
    v_enabled := v_slot.is_enabled;
  END IF;

  v_count := public.count_active_bookings_for_slot(NEW.event_date, NEW.time_slot);

  IF TG_OP = 'UPDATE'
     AND OLD.id = NEW.id
     AND OLD.event_date = NEW.event_date
     AND OLD.time_slot = NEW.time_slot
     AND OLD.status = ANY(public.active_booking_statuses()) THEN
    v_count := GREATEST(0, v_count - 1);
  END IF;

  IF NOT v_enabled THEN
    RAISE EXCEPTION 'slot_unavailable: This date and time are not available for booking.';
  END IF;

  IF v_count >= v_cap THEN
    RAISE EXCEPTION 'slot_full: This time slot is fully booked. Please choose another date or time.';
  END IF;

  RETURN NEW;
END;
$$;

-- 9) Stats RPCs: admin only
CREATE OR REPLACE FUNCTION public.get_booking_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_only';
  END IF;
  RETURN (
    SELECT json_build_object(
      'total', (SELECT COUNT(*) FROM bookings),
      'confirmed', (SELECT COUNT(*) FROM bookings WHERE status = 'confirmed'),
      'pending_payment', (SELECT COUNT(*) FROM bookings WHERE status IN ('awaiting_payment', 'payment_submitted')),
      'cancelled', (SELECT COUNT(*) FROM bookings WHERE status = 'cancelled'),
      'completed', (SELECT COUNT(*) FROM bookings WHERE status = 'completed'),
      'awaiting_payment', (SELECT COUNT(*) FROM bookings WHERE status = 'awaiting_payment'),
      'payment_submitted', (SELECT COUNT(*) FROM bookings WHERE status = 'payment_submitted')
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_revenue_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_only';
  END IF;
  RETURN (
    SELECT json_build_object(
      'total_verified', COALESCE((SELECT SUM(amount) FROM payments WHERE status = 'verified'), 0),
      'pending', COALESCE((SELECT SUM(amount) FROM payments WHERE status = 'submitted'), 0)
    )
  );
END;
$$;

-- 10) Auto-cancel past unapproved + restore stale cancellation holds (7 days)
CREATE OR REPLACE FUNCTION public.cancel_expired_unapproved_bookings()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cancelled_count INT;
  restored_count INT;
  v_reason TEXT := 'Automatically cancelled: your booking was not approved before the scheduled shoot date.';
BEGIN
  UPDATE bookings
  SET
    status = 'cancelled',
    notes = CASE
      WHEN COALESCE(TRIM(notes), '') = '' THEN v_reason
      WHEN notes ILIKE '%' || v_reason || '%' THEN notes
      ELSE notes || E'\n' || v_reason
    END,
    updated_at = NOW()
  WHERE event_date < CURRENT_DATE
    AND status IN ('awaiting_payment', 'payment_submitted', 'pending');

  GET DIAGNOSTICS cancelled_count = ROW_COUNT;

  -- Fee never paid: restore confirmed so slot isn't held forever
  UPDATE bookings
  SET status = 'confirmed', updated_at = NOW()
  WHERE status = 'cancellation_pending'
    AND updated_at < NOW() - INTERVAL '7 days';

  GET DIAGNOSTICS restored_count = ROW_COUNT;

  RETURN cancelled_count + restored_count;
END;
$$;
