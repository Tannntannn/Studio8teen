-- Admin alerts for items that need a decision include a direct link.

CREATE OR REPLACE FUNCTION public.notify_payment_submitted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_id UUID;
  booking_client UUID;
  client_name TEXT;
  package_name TEXT;
  booking_link TEXT;
  client_link TEXT;
  who TEXT;
BEGIN
  booking_link := '/admin/bookings/' || NEW.booking_id::text;
  client_link := '/client-bookings/' || NEW.booking_id::text;

  SELECT b.client_id, COALESCE(NULLIF(TRIM(pr.full_name), ''), 'A client'), COALESCE(pkg.name, 'a package')
  INTO booking_client, client_name, package_name
  FROM bookings b
  LEFT JOIN profiles pr ON pr.id = b.client_id
  LEFT JOIN packages pkg ON pkg.id = b.package_id
  WHERE b.id = NEW.booking_id;

  who := client_name || ' · ' || package_name;

  IF NEW.status = 'submitted' AND (OLD.status IS NULL OR OLD.status <> 'submitted') THEN
    INSERT INTO notifications (user_id, type, title, message, booking_id, link)
    VALUES (
      booking_client,
      'payment',
      'Payment proof',
      'Your payment proof was submitted and is waiting for the studio.',
      NEW.booking_id,
      client_link
    );
    FOR admin_id IN SELECT id FROM profiles WHERE role = 'admin' LOOP
      INSERT INTO notifications (user_id, type, title, message, booking_id, link)
      VALUES (
        admin_id,
        'payment',
        'Payment proof',
        who || ' submitted a ' || REPLACE(NEW.payment_type::text, '_', ' ') || ' proof to verify.',
        NEW.booking_id,
        booking_link
      );
    END LOOP;
  END IF;

  IF NEW.status = 'verified' AND (OLD.status IS NULL OR OLD.status <> 'verified') THEN
    INSERT INTO notifications (user_id, type, title, message, booking_id, link)
    VALUES (
      booking_client,
      'payment',
      'Payment received',
      'Payment received for ' || package_name || '. The studio still needs to confirm your booking.',
      NEW.booking_id,
      client_link
    );
    FOR admin_id IN SELECT id FROM profiles WHERE role = 'admin' LOOP
      INSERT INTO notifications (user_id, type, title, message, booking_id, link)
      VALUES (
        admin_id,
        'payment',
        'Confirm booking',
        who || ' paid and is waiting for you to confirm or disapprove.',
        NEW.booking_id,
        booking_link
      );
    END LOOP;
  END IF;

  IF NEW.status = 'rejected' AND (OLD.status IS NULL OR OLD.status <> 'rejected') THEN
    SELECT client_id INTO booking_client FROM bookings WHERE id = NEW.booking_id;
    INSERT INTO notifications (user_id, type, message, booking_id, link)
    VALUES (
      booking_client,
      'payment',
      'Payment proof rejected. Reason: ' || COALESCE(NULLIF(TRIM(NEW.rejection_note), ''), 'Please re-upload your payment proof.'),
      NEW.booking_id,
      '/client-bookings/' || NEW.booking_id::text
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_admin_cancellation_fee()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_id UUID;
  client_name TEXT;
  package_name TEXT;
BEGIN
  SELECT COALESCE(NULLIF(TRIM(pr.full_name), ''), 'A client'), COALESCE(pkg.name, 'a package')
  INTO client_name, package_name
  FROM bookings b
  LEFT JOIN profiles pr ON pr.id = b.client_id
  LEFT JOIN packages pkg ON pkg.id = b.package_id
  WHERE b.id = NEW.booking_id;

  IF NEW.fee_status = 'submitted' AND (TG_OP = 'INSERT' OR OLD.fee_status IS DISTINCT FROM 'submitted') THEN
    FOR admin_id IN SELECT id FROM profiles WHERE role = 'admin' LOOP
      INSERT INTO notifications (user_id, type, title, message, booking_id, link)
      VALUES (
        admin_id,
        'payment',
        'Cancellation fee',
        client_name || ' · ' || package_name || ' submitted a cancellation fee to verify.',
        NEW.booking_id,
        '/admin/cancellations'
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cancellation_fee_admin_notify ON public.cancellations;
CREATE TRIGGER cancellation_fee_admin_notify
  AFTER INSERT OR UPDATE OF fee_status ON public.cancellations
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_cancellation_fee();
