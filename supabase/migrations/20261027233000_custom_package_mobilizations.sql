-- Event packages can add custom mobilization options with their own fee.
-- A new client booking copies both the standard types and those custom options.

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
  pkg_category TEXT;
  pkg_mobs JSONB;
  item JSONB;
  cleaned JSONB := '[]'::jsonb;
  fee NUMERIC(10,2) := 0;
  item_price NUMERIC(10,2);
  item_id TEXT;
  item_label TEXT;
  item_count INT := 0;
  seen TEXT[] := ARRAY[]::TEXT[];
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
    NEW.mobilization_items := '[]'::jsonb;

    SELECT category, mobilizations INTO pkg_category, pkg_mobs
    FROM packages
    WHERE id = NEW.package_id;

    IF pkg_category = 'event' AND jsonb_typeof(pkg_mobs) = 'array' THEN
      FOR item IN SELECT value FROM jsonb_array_elements(pkg_mobs)
      LOOP
        EXIT WHEN item_count >= 20;
        item_id := left(btrim(coalesce(item->>'id', '')), 80);
        item_label := left(btrim(coalesce(item->>'label', '')), 80);
        IF item_id = '' OR item_id = ANY(seen) THEN
          CONTINUE;
        END IF;
        BEGIN
          item_price := GREATEST(COALESCE((item->>'price')::numeric, 0), 0);
        EXCEPTION WHEN OTHERS THEN
          item_price := 0;
        END;
        IF item_id IN ('van', 'hard_case', 'technical_setup', 'backup_assistant', 'on_site_edit') THEN
          cleaned := cleaned || jsonb_build_array(jsonb_build_object('id', item_id, 'price', item_price));
          fee := fee + item_price;
          seen := array_append(seen, item_id);
          item_count := item_count + 1;
        ELSIF item_id ~ '^custom_[A-Za-z0-9]{8,64}$' AND char_length(item_label) >= 2 THEN
          cleaned := cleaned || jsonb_build_array(jsonb_build_object('id', item_id, 'label', item_label, 'price', item_price));
          fee := fee + item_price;
          seen := array_append(seen, item_id);
          item_count := item_count + 1;
        END IF;
      END LOOP;
      NEW.mobilization_items := cleaned;
      NEW.mobilization_fee := fee;
    END IF;

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

  IF NEW.mobilization_fee IS DISTINCT FROM OLD.mobilization_fee
     OR NEW.mobilization_items IS DISTINCT FROM OLD.mobilization_items THEN
    RAISE EXCEPTION 'booking_forbidden: Clients cannot change mobilization.';
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
