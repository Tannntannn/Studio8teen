-- 30-minute slots (9:00 AM – 6:00 PM), default capacity 1 booking per slot

UPDATE studio_settings
SET time_slots = '[
  "09:00","09:30","10:00","10:30","11:00","11:30",
  "12:00","12:30","13:00","13:30","14:00","14:30",
  "15:00","15:30","16:00","16:30","17:00","17:30","18:00"
]'::jsonb
WHERE id = 1;

-- Align existing rows to 1 booking per slot (keep capacity if already overbooked)
UPDATE studio_availability
SET capacity = GREATEST(booked_count, 1)
WHERE capacity IS DISTINCT FROM GREATEST(booked_count, 1);

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
    v_capacity := 1;
  END IF;

  INSERT INTO studio_availability (avail_date, time_slot, capacity, booked_count, is_enabled)
  VALUES (p_date, p_time_slot, v_capacity, v_count, true)
  ON CONFLICT (avail_date, time_slot)
  DO UPDATE SET booked_count = v_count;
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
  SELECT COALESCE(
    time_slots,
    '[
      "09:00","09:30","10:00","10:30","11:00","11:30",
      "12:00","12:30","13:00","13:30","14:00","14:30",
      "15:00","15:30","16:00","16:30","17:00","17:30","18:00"
    ]'::jsonb
  )
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
      VALUES (v_date, v_slot, 1, public.count_active_bookings_for_slot(v_date, v_slot), true)
      ON CONFLICT (avail_date, time_slot) DO NOTHING;
    END LOOP;
  END LOOP;

  PERFORM public.sync_month_availability(p_year_month);
END;
$$;
