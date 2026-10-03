-- Label admin alerts with the client and the kind of check, and hide alerts for bookings that are already finished.

UPDATE public.notifications AS n
SET
  title = CASE
    WHEN n.message ILIKE '%cancellation%' THEN 'Cancellation fee'
    WHEN n.message ILIKE '%confirm%' OR n.message ILIKE '%paid%' OR n.message ILIKE '%disapprove%' THEN 'Confirm booking'
    ELSE 'Payment proof'
  END,
  message = COALESCE(NULLIF(TRIM(pr.full_name), ''), 'A client')
    || ' · '
    || COALESCE(pkg.name, 'Package')
    || CASE
      WHEN n.message ILIKE '%cancellation%' THEN ' submitted a cancellation fee to verify.'
      WHEN n.message ILIKE '%confirm%' OR n.message ILIKE '%paid%' OR n.message ILIKE '%disapprove%' THEN ' paid and is waiting for you to confirm or disapprove.'
      ELSE ' submitted a payment proof to verify.'
    END
FROM public.bookings b
LEFT JOIN public.profiles pr ON pr.id = b.client_id
LEFT JOIN public.packages pkg ON pkg.id = b.package_id
WHERE n.booking_id = b.id
  AND EXISTS (
    SELECT 1 FROM public.profiles admin
    WHERE admin.id = n.user_id AND admin.role = 'admin'
  )
  AND (
    n.message ILIKE '%proof%'
    OR n.message ILIKE '%waiting for you%'
    OR n.message ILIKE '%confirm or%'
    OR n.message ILIKE '%cancellation fee%'
  );

UPDATE public.notifications AS n
SET
  is_read = TRUE,
  dismissed_at = COALESCE(n.dismissed_at, NOW())
FROM public.bookings b
WHERE n.booking_id = b.id
  AND b.status IN ('cancelled', 'completed', 'confirmed')
  AND EXISTS (
    SELECT 1 FROM public.profiles admin
    WHERE admin.id = n.user_id AND admin.role = 'admin'
  )
  AND (
    COALESCE(n.title, '') IN ('Payment proof', 'Confirm booking', 'Cancellation fee')
    OR n.message ILIKE '%proof%'
    OR n.message ILIKE '%confirm or disapprove%'
    OR n.message ILIKE '%cancellation fee%'
  );
