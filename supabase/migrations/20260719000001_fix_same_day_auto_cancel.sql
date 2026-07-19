-- Fix: do not auto-cancel same-day unapproved bookings (walk-ins / today slots).
-- Only cancel after the shoot date has passed.

CREATE OR REPLACE FUNCTION public.cancel_expired_unapproved_bookings()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cancelled_count INT;
  v_reason TEXT := 'Automatically cancelled: your booking was not approved before the scheduled shoot date.';
BEGIN
  UPDATE bookings
  SET
    status = 'cancelled',
    notes = CASE
      WHEN COALESCE(TRIM(notes), '') = '' THEN v_reason
      WHEN notes ILIKE '%' || v_reason || '%' THEN notes
      ELSE notes || E'\n' || v_reason
    END,
    updated_at = NOW()
  WHERE event_date < CURRENT_DATE
    AND status IN ('awaiting_payment', 'payment_submitted', 'pending');

  GET DIAGNOSTICS cancelled_count = ROW_COUNT;
  RETURN cancelled_count;
END;
$$;
