-- Photography themes for Mood Board Generator

CREATE TABLE IF NOT EXISTS photography_themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  color_palette JSONB NOT NULL DEFAULT '[]',
  outfit_suggestions JSONB NOT NULL DEFAULT '[]',
  prop_suggestions JSONB NOT NULL DEFAULT '[]',
  lighting_style TEXT NOT NULL DEFAULT '',
  editing_style TEXT NOT NULL DEFAULT '',
  additional_notes TEXT NOT NULL DEFAULT '',
  event_types JSONB NOT NULL DEFAULT '[]',
  inspiration_images JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE photography_themes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS photography_themes_select ON photography_themes;
CREATE POLICY photography_themes_select ON photography_themes
  FOR SELECT TO authenticated
  USING (is_active = true OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS photography_themes_admin ON photography_themes;
CREATE POLICY photography_themes_admin ON photography_themes
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Sample themes (admin can edit and add images)
INSERT INTO photography_themes (name, description, color_palette, outfit_suggestions, prop_suggestions, lighting_style, editing_style, additional_notes, event_types, sort_order)
VALUES
  (
    'Soft Romantic',
    'Dreamy, warm tones with gentle highlights — perfect for intimate portraits and couples.',
    '["#F8E8E0", "#D4A574", "#8B6F5C", "#FFF5EE", "#C9A88E"]',
    '["Flowing dresses", "Neutral linen suits", "Soft pastels", "Bare shoulders or off-shoulder tops"]',
    '["Fresh flowers", "Sheer fabric", "Vintage chair", "Candles"]',
    'Soft natural light or golden-hour backlight with diffused fill.',
    'Warm skin tones, lifted shadows, subtle film grain, creamy highlights.',
    'Best scheduled near sunset. Avoid harsh midday sun.',
    '["Couple", "Wedding", "Engagement", "Solo Portrait"]',
    1
  ),
  (
    'Bold Editorial',
    'High-contrast, fashion-forward looks with strong poses and dramatic lighting.',
    '["#1A1A1A", "#E8E1DA", "#A98B75", "#FFFFFF", "#5B4636"]',
    '["Structured blazers", "Monochrome outfits", "Statement accessories", "Tailored separates"]',
    '["Studio stools", "Geometric blocks", "Mirror panels", "Minimal props"]',
    'Studio strobes with hard key light and controlled shadows.',
    'Crisp contrast, clean retouching, desaturated backgrounds, punchy blacks.',
    'Coordinate outfit colors with the palette for a cohesive editorial set.',
    '["Corporate", "Graduation", "Solo Portrait", "Creative"]',
    2
  ),
  (
    'Natural Lifestyle',
    'Candid, airy sessions that feel authentic — ideal for families and outdoor events.',
    '["#87CEEB", "#F5F5DC", "#6B8E6B", "#FFFFFF", "#D2B48C"]',
    '["Casual denim", "White cotton", "Earth tones", "Comfortable layers"]',
    '["Blankets", "Books", "Bicycles", "Coffee cups", "Picnic baskets"]',
    'Open shade or overcast daylight for even, flattering illumination.',
    'True-to-life colors, light and airy processing, natural skin texture preserved.',
    'Great for parks, home sessions, and casual walk-and-shoot styles.',
    '["Family", "Birthday", "Maternity", "Kids"]',
    3
  );
