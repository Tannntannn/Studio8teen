-- Mood board outfit/prop image assets + multi payment QRs + guest snapshot

ALTER TABLE public.photography_themes
  ADD COLUMN IF NOT EXISTS outfit_images JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS prop_images JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.photography_themes.outfit_images IS
  'Array of {id,url,public_id,label,category} cutout images for collage';
COMMENT ON COLUMN public.photography_themes.prop_images IS
  'Array of {id,url,public_id,label,category} cutout images for collage';

ALTER TABLE public.studio_settings
  ADD COLUMN IF NOT EXISTS payment_methods JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.studio_settings.payment_methods IS
  '[{id,platform,label,url,public_id}] e.g. gcash, maya, gotyme, maribank';

-- Seed payment_methods from legacy single QR when empty
UPDATE public.studio_settings
SET payment_methods = jsonb_build_array(
  jsonb_build_object(
    'id', 'legacy-gcash',
    'platform', 'gcash',
    'label', 'GCash',
    'url', payment_qr_url,
    'public_id', payment_qr_public_id
  )
)
WHERE id = 1
  AND payment_qr_url IS NOT NULL
  AND (payment_methods IS NULL OR payment_methods = '[]'::jsonb);

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS guest_snapshot JSONB NULL;

COMMENT ON COLUMN public.bookings.guest_snapshot IS
  'Walk-in guest contact retained after guest auth account is removed';

-- Soft archive flag so guests can be cleaned without losing booking history
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS guest_archived_at TIMESTAMPTZ NULL;
