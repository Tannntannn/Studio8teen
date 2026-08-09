-- Guest / walk-in quick sessions + mood board collage storage

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_guest BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS guest_expires_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS profiles_guest_expires_idx
  ON public.profiles (guest_expires_at)
  WHERE is_guest = true AND claimed_at IS NULL;

ALTER TABLE public.mood_boards
  ADD COLUMN IF NOT EXISTS collage JSONB NULL;

COMMENT ON COLUMN public.profiles.is_guest IS 'True for quick-session walk-in accounts that have not claimed a password yet';
COMMENT ON COLUMN public.profiles.guest_expires_at IS 'When unclaimed guest data is eligible for deletion';
COMMENT ON COLUMN public.profiles.claimed_at IS 'When a guest converted to a full account';
COMMENT ON COLUMN public.mood_boards.collage IS 'Generated collage payload: images, colors, prefs, generated_at';

-- Allow guests to claim (is_guest false + claimed_at) but block forging guest status
CREATE OR REPLACE FUNCTION public.protect_profile_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.role IS DISTINCT FROM NEW.role AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'role_change_forbidden: Only admins can change roles.';
  END IF;

  IF TG_OP = 'UPDATE' AND NOT public.is_admin() THEN
    NEW.id := OLD.id;
    NEW.role := OLD.role;
    NEW.email := COALESCE(NEW.email, OLD.email);

    -- Claiming a guest account is allowed; other guest-field edits are not
    IF COALESCE(OLD.is_guest, false) AND NOT COALESCE(NEW.is_guest, false) THEN
      NEW.is_guest := false;
      NEW.claimed_at := COALESCE(NEW.claimed_at, NOW());
      NEW.guest_expires_at := NULL;
    ELSE
      NEW.is_guest := COALESCE(OLD.is_guest, false);
      NEW.guest_expires_at := OLD.guest_expires_at;
      NEW.claimed_at := OLD.claimed_at;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_updates ON public.profiles;
CREATE TRIGGER protect_profile_updates
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_updates();

-- Helper for cleanup jobs / admin tooling
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
    AND p.guest_expires_at IS NOT NULL
    AND p.guest_expires_at < NOW()
    AND p.role = 'client';
$$;

REVOKE ALL ON FUNCTION public.list_expired_guest_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_expired_guest_ids() TO service_role;

-- Align FAQ copy with self-service quick session
UPDATE public.faq_entries
SET
  answer = 'Book online through StudioBook: create an account (or start a Quick Session for walk-ins), go to Bookings, choose your package, date, and time slot, then upload your payment proof and wait for admin approval. Once confirmed, you will receive your booking details and studio location. Please book at least one (1) week ahead when possible. Walk-ins can use Quick Session on the website to book a same-day slot if the package allows it.',
  keywords = ARRAY['book', 'booking', 'reserve', 'schedule', 'how', 'walk-in', 'walk in', 'appointment', 'online', 'guest', 'quick session']
WHERE question = 'How do I book a session?';

UPDATE public.faq_entries
SET
  answer = 'Bookings should ideally be made at least one (1) week before your appointment. Walk-ins are welcome: use Quick Session (name, phone, email — no password yet) to book a same-day slot for packages that allow walk-ins. Your guest session stays for 7 days unless you create a password to keep it permanently. We still prioritize clients who reserved ahead of time.',
  keywords = ARRAY['booking', 'policy', 'walk-in', 'walk in', 'week', 'ahead', 'slot', 'reserve', 'guest', 'quick session']
WHERE question = 'What is the booking and walk-in policy?';
