-- Guest walk-in logins expire after 2 days (bookings/payments are retained via soft-archive).

CREATE OR REPLACE FUNCTION public.list_expired_guest_ids()
RETURNS TABLE (id UUID, email TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.email
  FROM public.profiles p
  WHERE p.is_guest = true
    AND p.claimed_at IS NULL
    AND p.guest_archived_at IS NULL
    AND p.guest_expires_at IS NOT NULL
    AND p.guest_expires_at < NOW()
    AND p.role = 'client';
$$;

COMMENT ON COLUMN public.profiles.guest_expires_at IS
  'When unclaimed guest login is eligible for soft-archive (default ~2 days). Bookings/payments stay.';

-- Shorten any still-active guests that were created with the old 7-day window
UPDATE public.profiles
SET guest_expires_at = LEAST(guest_expires_at, created_at + INTERVAL '2 days')
WHERE is_guest = true
  AND claimed_at IS NULL
  AND guest_archived_at IS NULL
  AND guest_expires_at IS NOT NULL
  AND guest_expires_at > created_at + INTERVAL '2 days';

UPDATE public.faq_entries
SET
  answer = 'Bookings should ideally be made at least one (1) week before your appointment. Walk-ins are welcome: use Quick Session to book a same-day slot for packages that allow walk-ins. Your guest login stays about 2 days unless you create a password. Your booking and payment records stay with the studio even after the guest login ends.',
  keywords = ARRAY['booking', 'policy', 'walk-in', 'walk in', 'week', 'ahead', 'slot', 'reserve', 'guest', 'quick session']
WHERE question = 'What is the booking and walk-in policy?';
