-- Fix checklist insert for clients on their own bookings
CREATE POLICY checklists_client_insert ON event_checklists FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_id AND b.client_id = auth.uid())
);
