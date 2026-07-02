-- Cancellation hold flow: client uploads fee proof, admin approves before cancelled

ALTER TABLE cancellations ALTER COLUMN fee_amount SET DEFAULT 100;

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check CHECK (status IN (
  'pending', 'awaiting_payment', 'payment_submitted', 'confirmed', 'completed', 'cancelled',
  'cancellation_pending', 'cancellation_submitted'
));

DROP POLICY IF EXISTS cancellations_client_update ON cancellations;
CREATE POLICY cancellations_client_update ON cancellations
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_id AND b.client_id = auth.uid())
  );
