-- Event coverage uses a typed start time and must not occupy a studio slot.

CREATE OR REPLACE FUNCTION public.is_event_coverage_booking(p_package_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM packages WHERE id = p_package_id AND category = 'event'
  );
$$;

CREATE OR REPLACE FUNCTION public.count_active_bookings_for_slot(p_date DATE, p_time_slot TEXT)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INT
  FROM bookings
  WHERE event_date = p_date
    AND time_slot = p_time_slot
    AND status = ANY(public.active_booking_statuses())
    AND NOT public.is_event_coverage_booking(package_id);
$$;

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
  IF public.is_event_coverage_booking(NEW.package_id) THEN
    RETURN NEW;
  END IF;

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

CREATE OR REPLACE FUNCTION public.on_booking_slot_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF NOT public.is_event_coverage_booking(OLD.package_id) THEN
      PERFORM public.sync_availability_slot(OLD.event_date, OLD.time_slot);
    END IF;
    RETURN OLD;
  END IF;

  IF public.is_event_coverage_booking(NEW.package_id) THEN
    IF TG_OP = 'UPDATE' AND NOT public.is_event_coverage_booking(OLD.package_id) THEN
      PERFORM public.sync_availability_slot(OLD.event_date, OLD.time_slot);
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.event_date IS DISTINCT FROM NEW.event_date OR OLD.time_slot IS DISTINCT FROM NEW.time_slot THEN
      IF NOT public.is_event_coverage_booking(OLD.package_id) THEN
        PERFORM public.sync_availability_slot(OLD.event_date, OLD.time_slot);
      END IF;
    END IF;
    PERFORM public.sync_availability_slot(NEW.event_date, NEW.time_slot);
    RETURN NEW;
  END IF;

  PERFORM public.sync_availability_slot(NEW.event_date, NEW.time_slot);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_month_availability(p_year_month TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT b.event_date AS d, b.time_slot AS s
    FROM bookings b
    WHERE to_char(b.event_date, 'YYYY-MM') = p_year_month
      AND b.status = ANY(public.active_booking_statuses())
      AND NOT public.is_event_coverage_booking(b.package_id)
  LOOP
    PERFORM public.sync_availability_slot(r.d, r.s);
  END LOOP;
END;
$$;
