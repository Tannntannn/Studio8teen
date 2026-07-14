-- Walk-in bookings + per-booking AI pose/mood suggestions

ALTER TABLE packages
  ADD COLUMN IF NOT EXISTS allows_walk_in BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS is_walk_in BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS booking_pose_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  poses JSONB NOT NULL DEFAULT '[]'::jsonb,
  mood_board JSONB NOT NULL DEFAULT '{}'::jsonb,
  pinned_indexes INTEGER[] NOT NULL DEFAULT '{}',
  photographer_notes TEXT DEFAULT '',
  model_used TEXT DEFAULT '',
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_pose_suggestions_booking
  ON booking_pose_suggestions(booking_id);

ALTER TABLE booking_pose_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clients can view own booking pose suggestions" ON booking_pose_suggestions;
CREATE POLICY "Clients can view own booking pose suggestions"
  ON booking_pose_suggestions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_pose_suggestions.booking_id
        AND (b.client_id = auth.uid() OR EXISTS (
          SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
        ))
    )
  );

DROP POLICY IF EXISTS "Admins manage booking pose suggestions" ON booking_pose_suggestions;
CREATE POLICY "Admins manage booking pose suggestions"
  ON booking_pose_suggestions FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );
