-- Gallery photos must belong to a category and stay within 30 per booking.

ALTER TABLE client_gallery_items
  ADD COLUMN IF NOT EXISTS category TEXT;

ALTER TABLE client_gallery_items
  DROP CONSTRAINT IF EXISTS client_gallery_items_category_check;

ALTER TABLE client_gallery_items
  ADD CONSTRAINT client_gallery_items_category_check
  CHECK (category IS NULL OR category IN ('Prenup', 'Ceremony', 'Reception', 'Studio'));

CREATE OR REPLACE FUNCTION public.enforce_gallery_photo_cap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  IF NEW.booking_id IS NOT NULL AND TG_OP = 'INSERT' THEN
    SELECT COUNT(*)::INT INTO v_count
    FROM client_gallery_items
    WHERE booking_id = NEW.booking_id;
    IF v_count >= 30 THEN
      RAISE EXCEPTION 'gallery_limit: This booking already has 30 photos.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS client_gallery_photo_cap ON client_gallery_items;
CREATE TRIGGER client_gallery_photo_cap
  BEFORE INSERT ON client_gallery_items
  FOR EACH ROW EXECUTE FUNCTION public.enforce_gallery_photo_cap();
