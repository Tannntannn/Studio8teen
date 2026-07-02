-- UI overhaul: booking contact/address/add-ons, cancellation fees, profile fields

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS contact_number TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS client_address TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS selected_addons JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS addons_total NUMERIC(10,2) DEFAULT 0;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS address TEXT DEFAULT '';

ALTER TABLE cancellations
  ADD COLUMN IF NOT EXISTS fee_amount NUMERIC(10,2) DEFAULT 100,
  ADD COLUMN IF NOT EXISTS fee_proof_url TEXT,
  ADD COLUMN IF NOT EXISTS fee_proof_public_id TEXT,
  ADD COLUMN IF NOT EXISTS fee_status TEXT DEFAULT 'awaiting'
    CHECK (fee_status IN ('awaiting', 'submitted', 'verified', 'rejected', 'na')),
  ADD COLUMN IF NOT EXISTS fee_admin_notes TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS fee_verified_at TIMESTAMPTZ;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ;

DROP POLICY IF EXISTS cancellations_admin_update ON cancellations;
CREATE POLICY cancellations_admin_update ON cancellations
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS client_gallery_admin_delete ON client_gallery_items;
CREATE POLICY client_gallery_admin_delete ON client_gallery_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS pose_admin_delete ON pose_suggestions;
CREATE POLICY pose_admin_delete ON pose_suggestions
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
