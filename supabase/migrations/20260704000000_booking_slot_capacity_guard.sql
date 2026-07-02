-- Prevent bookings when a slot is full or closed (server-side guard)

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

  PERFORM public.sync_availability_slot(NEW.event_date, NEW.time_slot);

  SELECT * INTO v_slot
  FROM public.studio_availability
  WHERE avail_date = NEW.event_date AND time_slot = NEW.time_slot;

  IF NOT FOUND THEN
    v_cap := 2;
    v_enabled := true;
    v_count := public.count_active_bookings_for_slot(NEW.event_date, NEW.time_slot);
  ELSE
    v_cap := v_slot.capacity;
    v_enabled := v_slot.is_enabled;
    v_count := v_slot.booked_count;
  END IF;

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

DROP TRIGGER IF EXISTS booking_slot_capacity_check ON bookings;
CREATE TRIGGER booking_slot_capacity_check
  BEFORE INSERT OR UPDATE OF event_date, time_slot, status ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_booking_slot_capacity();
