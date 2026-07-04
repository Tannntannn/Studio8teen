-- Allow multiple moods and photography styles per theme

ALTER TABLE photography_themes
  ALTER COLUMN mood DROP DEFAULT,
  ALTER COLUMN photography_style DROP DEFAULT;

ALTER TABLE photography_themes
  ALTER COLUMN mood TYPE JSONB USING (
    CASE
      WHEN mood IS NULL OR TRIM(mood::text) = '' THEN '[]'::jsonb
      ELSE jsonb_build_array(TRIM(mood::text))
    END
  ),
  ALTER COLUMN photography_style TYPE JSONB USING (
    CASE
      WHEN photography_style IS NULL OR TRIM(photography_style::text) = '' THEN '[]'::jsonb
      ELSE jsonb_build_array(TRIM(photography_style::text))
    END
  );

ALTER TABLE photography_themes
  ALTER COLUMN mood SET DEFAULT '[]'::jsonb,
  ALTER COLUMN photography_style SET DEFAULT '[]'::jsonb;
