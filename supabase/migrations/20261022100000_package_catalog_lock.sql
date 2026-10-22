-- Keep admin edits when the official catalog is synced again.

ALTER TABLE packages
  ADD COLUMN IF NOT EXISTS catalog_locked BOOLEAN NOT NULL DEFAULT false;
