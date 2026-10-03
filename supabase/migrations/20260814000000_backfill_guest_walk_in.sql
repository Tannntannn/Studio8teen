-- Mark existing guest bookings as walk-in (safety net; also applied via one-off query)
UPDATE public.bookings b
SET is_walk_in = true
FROM public.profiles p
WHERE b.client_id = p.id
  AND b.is_walk_in = false
  AND (
    p.is_guest = true
    OR p.email ILIKE '%@guest.studio8teen.local'
    OR b.guest_snapshot IS NOT NULL
  );
