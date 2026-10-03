-- PayMongo payment marks the booking pending. An admin must confirm or reject it.
-- Service role (Edge Functions) may update booking status. Admins get an activity log.

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action_description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS activity_logs_admin_select ON public.activity_logs;
CREATE POLICY activity_logs_admin_select ON public.activity_logs
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS activity_logs_admin_insert ON public.activity_logs;
CREATE POLICY activity_logs_admin_insert ON public.activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() AND admin_id = auth.uid());

-- Let PayMongo Edge Functions move a paid booking to pending.
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

CREATE OR REPLACE FUNCTION public.notify_booking_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  msg TEXT;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- Payment trigger already tells the client and the admins.
  IF NEW.status = 'pending' THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'confirmed' THEN
    msg := 'Your booking is confirmed.';
  ELSE
    msg := 'Your booking status changed to: ' || REPLACE(NEW.status::text, '_', ' ');
    IF NEW.status = 'cancelled' AND COALESCE(NEW.notes, '') <> '' THEN
      msg := msg || '. Reason: ' || NEW.notes;
    END IF;
  END IF;

  INSERT INTO public.notifications (user_id, type, message)
  VALUES (NEW.client_id, 'booking', msg);

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_payment_submitted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_id UUID;
  booking_client UUID;
BEGIN
  IF NEW.status = 'submitted' AND (OLD.status IS NULL OR OLD.status <> 'submitted') THEN
    SELECT client_id INTO booking_client FROM bookings WHERE id = NEW.booking_id;
    INSERT INTO notifications (user_id, type, message)
    VALUES (booking_client, 'payment', 'Payment proof submitted — awaiting verification.');
    FOR admin_id IN SELECT id FROM profiles WHERE role = 'admin' LOOP
      INSERT INTO notifications (user_id, type, message)
      VALUES (admin_id, 'payment', 'New payment proof to verify.');
    END LOOP;
  END IF;

  IF NEW.status = 'verified' AND (OLD.status IS NULL OR OLD.status <> 'verified') THEN
    SELECT client_id INTO booking_client FROM bookings WHERE id = NEW.booking_id;
    INSERT INTO notifications (user_id, type, message)
    VALUES (booking_client, 'payment', 'Payment received. The studio still needs to confirm your booking.');
    FOR admin_id IN SELECT id FROM profiles WHERE role = 'admin' LOOP
      INSERT INTO notifications (user_id, type, message, booking_id)
      VALUES (
        admin_id,
        'payment',
        'A client paid and is waiting for you to confirm or reject the booking.',
        NEW.booking_id
      );
    END LOOP;
  END IF;

  IF NEW.status = 'rejected' AND (OLD.status IS NULL OR OLD.status <> 'rejected') THEN
    SELECT client_id INTO booking_client FROM bookings WHERE id = NEW.booking_id;
    INSERT INTO notifications (user_id, type, message)
    VALUES (
      booking_client,
      'payment',
      'Payment proof rejected. Reason: ' || COALESCE(NULLIF(TRIM(NEW.rejection_note), ''), 'Please re-upload your payment proof.')
    );
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
