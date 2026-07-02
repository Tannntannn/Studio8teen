-- Sync studio availability with bookings; configurable time slots; client-safe reads

ALTER TABLE studio_settings
  ADD COLUMN IF NOT EXISTS time_slots JSONB NOT NULL DEFAULT '["09:00","11:00","13:00","15:00","17:00"]'::jsonb;

CREATE OR REPLACE FUNCTION public.active_booking_statuses()
RETURNS TEXT[]
LANGUAGE sql IMMUTABLE
AS $$
  SELECT ARRAY[
    'pending', 'awaiting_payment', 'payment_submitted', 'confirmed', 'completed',
    'cancellation_pending', 'cancellation_submitted'
  ]::TEXT[];
$$;

CREATE OR REPLACE FUNCTION public.count_active_bookings_for_slot(p_date DATE, p_time_slot TEXT)
RETURNS INT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COUNT(*)::INT
  FROM bookings
  WHERE event_date = p_date
    AND time_slot = p_time_slot
    AND status = ANY(public.active_booking_statuses());
$$;

CREATE OR REPLACE FUNCTION public.sync_availability_slot(p_date DATE, p_time_slot TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count INT;
  v_capacity INT;
BEGIN
  v_count := public.count_active_bookings_for_slot(p_date, p_time_slot);

  SELECT capacity INTO v_capacity
  FROM studio_availability
  WHERE avail_date = p_date AND time_slot = p_time_slot;

  IF v_capacity IS NULL THEN
    v_capacity := 2;
  END IF;

  INSERT INTO studio_availability (avail_date, time_slot, capacity, booked_count, is_enabled)
  VALUES (p_date, p_time_slot, v_capacity, v_count, true)
  ON CONFLICT (avail_date, time_slot)
  DO UPDATE SET booked_count = v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_month_availability(p_year_month TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT event_date AS d, time_slot AS s
    FROM bookings
    WHERE to_char(event_date, 'YYYY-MM') = p_year_month
      AND status = ANY(public.active_booking_statuses())
  LOOP
    PERFORM public.sync_availability_slot(r.d, r.s);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_month_availability(p_year_month TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_slots JSONB;
  v_days INT;
  v_y INT;
  v_m INT;
  v_d INT;
  v_date DATE;
  v_slot TEXT;
BEGIN
  SELECT COALESCE(time_slots, '["09:00","11:00","13:00","15:00","17:00"]'::jsonb)
  INTO v_slots
  FROM studio_settings
  WHERE id = 1;

  v_y := split_part(p_year_month, '-', 1)::INT;
  v_m := split_part(p_year_month, '-', 2)::INT;
  v_days := EXTRACT(DAY FROM (date_trunc('month', make_date(v_y, v_m, 1)) + INTERVAL '1 month - 1 day'))::INT;

  FOR v_d IN 1..v_days LOOP
    v_date := make_date(v_y, v_m, v_d);
    FOR v_slot IN SELECT jsonb_array_elements_text(v_slots) LOOP
      PERFORM public.sync_availability_slot(v_date, v_slot);
      INSERT INTO studio_availability (avail_date, time_slot, capacity, booked_count, is_enabled)
      VALUES (v_date, v_slot, 2, public.count_active_bookings_for_slot(v_date, v_slot), true)
      ON CONFLICT (avail_date, time_slot) DO NOTHING;
    END LOOP;
  END LOOP;

  PERFORM public.sync_month_availability(p_year_month);
END;
$$;

CREATE OR REPLACE FUNCTION public.on_booking_slot_change()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.sync_availability_slot(OLD.event_date, OLD.time_slot);
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.event_date IS DISTINCT FROM NEW.event_date OR OLD.time_slot IS DISTINCT FROM NEW.time_slot THEN
      PERFORM public.sync_availability_slot(OLD.event_date, OLD.time_slot);
    END IF;
    PERFORM public.sync_availability_slot(NEW.event_date, NEW.time_slot);
    RETURN NEW;
  END IF;

  PERFORM public.sync_availability_slot(NEW.event_date, NEW.time_slot);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS booking_availability_sync ON bookings;
CREATE TRIGGER booking_availability_sync
  AFTER INSERT OR UPDATE OF event_date, time_slot, status OR DELETE ON bookings
  FOR EACH ROW EXECUTE FUNCTION public.on_booking_slot_change();

-- Backfill existing bookings into availability
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT event_date AS d, time_slot AS s
    FROM bookings
    WHERE status = ANY(public.active_booking_statuses())
  LOOP
    PERFORM public.sync_availability_slot(r.d, r.s);
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.sync_availability_slot(DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_month_availability(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_month_availability(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_active_bookings_for_slot(DATE, TEXT) TO authenticated;
