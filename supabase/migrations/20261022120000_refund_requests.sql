-- Manual refund requests. Approving does not call PayMongo.
-- The ₱100 cancellation fee stays on the cancellations table.

CREATE TABLE IF NOT EXISTS refund_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  client_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'refunded', 'rejected')),
  admin_note TEXT NOT NULL DEFAULT '',
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS refund_requests_booking_idx ON refund_requests (booking_id, created_at DESC);

ALTER TABLE refund_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS refund_requests_select ON refund_requests;
CREATE POLICY refund_requests_select ON refund_requests FOR SELECT USING (
  client_id = auth.uid()
  OR is_admin()
  OR EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.id = booking_id AND b.client_id = auth.uid()
  )
);

DROP POLICY IF EXISTS refund_requests_insert ON refund_requests;
CREATE POLICY refund_requests_insert ON refund_requests FOR INSERT WITH CHECK (
  client_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.id = booking_id AND b.client_id = auth.uid()
  )
);

DROP POLICY IF EXISTS refund_requests_admin_update ON refund_requests;
CREATE POLICY refund_requests_admin_update ON refund_requests FOR UPDATE USING (is_admin());

CREATE OR REPLACE FUNCTION public.guard_refund_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT EXISTS (
      SELECT 1 FROM payments p
      WHERE p.booking_id = NEW.booking_id AND p.status = 'verified'
    ) THEN
      RAISE EXCEPTION 'refund_not_allowed: A verified payment is required before a refund can be requested.';
    END IF;
    IF EXISTS (
      SELECT 1 FROM refund_requests r
      WHERE r.booking_id = NEW.booking_id AND r.status IN ('pending', 'refunded')
    ) THEN
      RAISE EXCEPTION 'refund_exists: This booking already has an open or completed refund.';
    END IF;
    NEW.status := 'pending';
    NEW.reviewed_at := NULL;
    NEW.reviewed_by := NULL;
  ELSIF TG_OP = 'UPDATE' AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'refund_forbidden: Only the studio can review refunds.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS refund_requests_guard ON refund_requests;
CREATE TRIGGER refund_requests_guard
  BEFORE INSERT OR UPDATE ON refund_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_refund_request();
