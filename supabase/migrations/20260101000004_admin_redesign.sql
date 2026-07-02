-- Admin dashboard redesign: availability toggles, booking read tracking, prep checklist

ALTER TABLE studio_availability
  ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS admin_read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE packages
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'studio',
  ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';

CREATE TABLE IF NOT EXISTS admin_preparation_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  completed_at TIMESTAMPTZ,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE admin_preparation_checklist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS prep_checklist_admin ON admin_preparation_checklist;
CREATE POLICY prep_checklist_admin ON admin_preparation_checklist
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Default preparation tasks
INSERT INTO admin_preparation_checklist (label, category, sort_order) VALUES
  ('Confirm studio lighting and backdrops', 'equipment', 1),
  ('Charge camera batteries and format memory cards', 'equipment', 2),
  ('Review client booking notes and package details', 'booking', 3),
  ('Prepare props for scheduled sessions', 'equipment', 4),
  ('Verify payment QR code is displayed in settings', 'payment', 5),
  ('Clean studio and sanitize high-touch surfaces', 'studio', 6);
