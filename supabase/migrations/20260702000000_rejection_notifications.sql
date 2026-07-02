-- Include admin rejection reasons in client notifications

CREATE OR REPLACE FUNCTION public.notify_booking_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  msg TEXT;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    msg := 'Your booking status changed to: ' || REPLACE(NEW.status, '_', ' ');
    IF NEW.status = 'cancelled' AND COALESCE(NEW.notes, '') <> '' THEN
      msg := msg || '. Reason: ' || NEW.notes;
    END IF;
    INSERT INTO notifications (user_id, type, message)
    VALUES (NEW.client_id, 'booking', msg);
  END IF;
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
    VALUES (booking_client, 'payment', 'Payment verified! Your booking is confirmed.');
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

-- Allow admins to insert notifications for clients (fallback when triggers are not yet applied)
DROP POLICY IF EXISTS notifications_admin_insert ON notifications;
CREATE POLICY notifications_admin_insert ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
