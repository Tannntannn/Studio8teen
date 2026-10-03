-- Fix guest flag: trigger was resetting is_guest to false on service-role updates.
-- Also set is_guest at signup from auth metadata so walk-ins are marked immediately.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  guest_flag boolean := COALESCE((NEW.raw_user_meta_data->>'is_guest')::boolean, false);
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, is_guest, guest_expires_at, claimed_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.email, ''),
    'client',
    guest_flag,
    CASE WHEN guest_flag THEN NOW() + INTERVAL '7 days' ELSE NULL END,
    NULL
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_profile_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role text := COALESCE(auth.jwt() ->> 'role', '');
BEGIN
  -- Service role may freely manage guest flags (create-guest-session / finalize)
  IF jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.role IS DISTINCT FROM NEW.role AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'role_change_forbidden: Only admins can change roles.';
  END IF;

  IF TG_OP = 'UPDATE' AND NOT public.is_admin() THEN
    NEW.id := OLD.id;
    NEW.role := OLD.role;
    NEW.email := COALESCE(NEW.email, OLD.email);

    -- Claiming a guest account is allowed; forging guest status is not
    IF COALESCE(OLD.is_guest, false) AND NOT COALESCE(NEW.is_guest, false) THEN
      NEW.is_guest := false;
      NEW.claimed_at := COALESCE(NEW.claimed_at, NOW());
      NEW.guest_expires_at := NULL;
      NEW.guest_archived_at := NULL;
    ELSE
      NEW.is_guest := COALESCE(OLD.is_guest, false);
      NEW.guest_expires_at := OLD.guest_expires_at;
      NEW.claimed_at := OLD.claimed_at;
      IF OLD.guest_archived_at IS NOT NULL THEN
        NEW.guest_archived_at := OLD.guest_archived_at;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Backfill: synthetic guest emails that were never marked
UPDATE public.profiles p
SET
  is_guest = true,
  guest_expires_at = COALESCE(guest_expires_at, NOW() + INTERVAL '7 days')
WHERE role = 'client'
  AND COALESCE(is_guest, false) = false
  AND claimed_at IS NULL
  AND email ILIKE '%@guest.studio8teen.local';
