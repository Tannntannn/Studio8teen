-- Reservation and cancellation payments write system activity logs.
-- admin_id stays null for events the client triggers.

ALTER TABLE public.activity_logs
  ALTER COLUMN admin_id DROP NOT NULL;

ALTER TABLE public.cancellations
  ADD COLUMN IF NOT EXISTS paymongo_checkout_id TEXT;

CREATE OR REPLACE FUNCTION public.log_verified_payment_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  client_name TEXT;
  package_name TEXT;
BEGIN
  IF NEW.status IS DISTINCT FROM 'verified' OR OLD.status = 'verified' THEN
    RETURN NEW;
  END IF;
  IF COALESCE(NEW.notes, '') NOT ILIKE '%PayMongo%' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(TRIM(pr.full_name), ''), 'A client'), COALESCE(pkg.name, 'a package')
  INTO client_name, package_name
  FROM bookings b
  LEFT JOIN profiles pr ON pr.id = b.client_id
  LEFT JOIN packages pkg ON pkg.id = b.package_id
  WHERE b.id = NEW.booking_id;

  INSERT INTO activity_logs (admin_id, action_description)
  VALUES (
    NULL,
    client_name || ' paid ₱' || trim(to_char(NEW.amount, 'FM999,999,990')) ||
    ' for ' || package_name || ', including the ₱150 reservation fee.'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payment_verified_activity ON public.payments;
CREATE TRIGGER payment_verified_activity
  AFTER UPDATE OF status ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.log_verified_payment_activity();

CREATE OR REPLACE FUNCTION public.notify_admin_payment_receipt()
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
  IF NEW.proof_image_url IS NULL THEN
    RETURN NEW;
  END IF;
  IF OLD.proof_image_url IS NOT DISTINCT FROM NEW.proof_image_url THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM 'verified' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(TRIM(pr.full_name), ''), 'A client'), COALESCE(pkg.name, 'a package')
  INTO client_name, package_name
  FROM bookings b
  LEFT JOIN profiles pr ON pr.id = b.client_id
  LEFT JOIN packages pkg ON pkg.id = b.package_id
  WHERE b.id = NEW.booking_id;

  INSERT INTO activity_logs (admin_id, action_description)
  VALUES (
    NULL,
    client_name || ' uploaded a payment receipt for ' || package_name || '.'
  );

  FOR admin_id IN SELECT id FROM profiles WHERE role = 'admin' LOOP
    INSERT INTO notifications (user_id, type, title, message, booking_id, link)
    VALUES (
      admin_id,
      'payment',
      'Payment receipt',
      client_name || ' · ' || package_name || ' uploaded a payment receipt.',
      NEW.booking_id,
      '/admin/bookings/' || NEW.booking_id::text
    );
  END LOOP;

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
    IF NEW.paymongo_checkout_id IS NOT NULL THEN
      INSERT INTO activity_logs (admin_id, action_description)
      VALUES (
        NULL,
        client_name || ' paid ₱100 cancellation fee for ' || package_name || '.'
      );
    ELSE
      INSERT INTO activity_logs (admin_id, action_description)
      VALUES (
        NULL,
        client_name || ' submitted a ₱' || trim(to_char(COALESCE(NEW.fee_amount, 100), 'FM999,999,990')) ||
        ' cancellation fee for ' || package_name || '.'
      );
    END IF;

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

CREATE OR REPLACE FUNCTION public.log_cancellation_receipt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  client_name TEXT;
  package_name TEXT;
BEGIN
  IF NEW.fee_proof_url IS NULL OR OLD.fee_proof_url IS NOT DISTINCT FROM NEW.fee_proof_url THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(TRIM(pr.full_name), ''), 'A client'), COALESCE(pkg.name, 'a package')
  INTO client_name, package_name
  FROM bookings b
  LEFT JOIN profiles pr ON pr.id = b.client_id
  LEFT JOIN packages pkg ON pkg.id = b.package_id
  WHERE b.id = NEW.booking_id;

  INSERT INTO activity_logs (admin_id, action_description)
  VALUES (
    NULL,
    client_name || ' uploaded a cancellation receipt for ' || package_name || '.'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cancellation_receipt_activity ON public.cancellations;
CREATE TRIGGER cancellation_receipt_activity
  AFTER UPDATE OF fee_proof_url ON public.cancellations
  FOR EACH ROW
  EXECUTE FUNCTION public.log_cancellation_receipt();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'activity_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;
  END IF;
END $$;
