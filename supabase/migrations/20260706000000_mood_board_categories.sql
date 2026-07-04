-- Admin-managed mood board dropdown categories (theme, mood, location, photography style)

CREATE TABLE IF NOT EXISTS mood_board_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_type TEXT NOT NULL CHECK (category_type IN ('theme', 'mood', 'location_type', 'photography_style')),
  label TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (category_type, label)
);

CREATE INDEX IF NOT EXISTS mood_board_categories_type_idx ON mood_board_categories (category_type, sort_order);

ALTER TABLE mood_board_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mood_board_categories_select ON mood_board_categories;
CREATE POLICY mood_board_categories_select ON mood_board_categories
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS mood_board_categories_admin ON mood_board_categories;
CREATE POLICY mood_board_categories_admin ON mood_board_categories
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

INSERT INTO mood_board_categories (category_type, label, sort_order) VALUES
  ('theme', 'Minimalist', 1),
  ('theme', 'Modern', 2),
  ('theme', 'Vintage', 3),
  ('theme', 'Cinematic', 4),
  ('theme', 'Floral', 5),
  ('theme', 'Luxury', 6),
  ('theme', 'Elegant', 7),
  ('theme', 'Nature', 8),
  ('mood', 'Romantic', 1),
  ('mood', 'Joyful', 2),
  ('mood', 'Formal', 3),
  ('mood', 'Playful', 4),
  ('mood', 'Cozy', 5),
  ('mood', 'Dramatic', 6),
  ('mood', 'Natural', 7),
  ('location_type', 'Indoor', 1),
  ('location_type', 'Garden', 2),
  ('location_type', 'Beach', 3),
  ('location_type', 'Church', 4),
  ('location_type', 'Outdoor', 5),
  ('location_type', 'Nature', 6),
  ('photography_style', 'Editorial', 1),
  ('photography_style', 'Fine Art', 2),
  ('photography_style', 'Aerial', 3),
  ('photography_style', 'Close-up', 4),
  ('photography_style', 'Portrait', 5),
  ('photography_style', 'Candid', 6),
  ('photography_style', 'Traditional', 7)
ON CONFLICT (category_type, label) DO NOTHING;
