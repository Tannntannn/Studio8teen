-- Clients may attach a receipt after PayMongo marks the payment verified.
-- They still cannot change a payment into verified or rejected themselves.

CREATE OR REPLACE FUNCTION public.protect_payment_client_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role TEXT := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
  );
BEGIN
  IF public.is_admin() OR jwt_role = 'service_role' THEN
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
    IF NEW.status IN ('verified', 'rejected') THEN
      RAISE EXCEPTION 'payment_forbidden: Clients cannot verify or reject payments.';
    END IF;
    IF NOT (
      (OLD.status IN ('awaiting', 'rejected') AND NEW.status IN ('awaiting', 'submitted'))
      OR (OLD.status = 'submitted' AND NEW.status = 'awaiting')
    ) THEN
      RAISE EXCEPTION 'payment_forbidden: Illegal payment status change.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Tell admins when a client uploads a PayMongo receipt.

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

DROP TRIGGER IF EXISTS payment_receipt_admin_notify ON public.payments;
CREATE TRIGGER payment_receipt_admin_notify
  AFTER UPDATE OF proof_image_url ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_payment_receipt();
