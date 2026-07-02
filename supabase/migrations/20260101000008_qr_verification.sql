-- Allow public QR verification for confirmed bookings (scan at studio / verify page)

DROP POLICY IF EXISTS bookings_qr_verify ON bookings;
CREATE POLICY bookings_qr_verify ON bookings
  FOR SELECT TO anon, authenticated
  USING (
    qr_token IS NOT NULL
    AND status IN ('confirmed', 'completed')
  );
