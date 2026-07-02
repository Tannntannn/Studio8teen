-- Mood Board Generator revision: auto-analysis fields on photography_themes

ALTER TABLE photography_themes
  ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS photography_style TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS mood TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS location_type TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]';
A