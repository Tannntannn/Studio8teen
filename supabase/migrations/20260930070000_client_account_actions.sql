-- Admins can deactivate or delete a client login.
-- Bookings, mood boards, and galleries stay when the account is deleted.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.protect_profile_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role text := COALESCE(auth.jwt() ->> 'role', '');
BEGIN
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
    NEW.deactivated_at := OLD.deactivated_at;

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

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT con.conname, rel.relname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY (con.conkey)
    WHERE nsp.nspname = 'public'
      AND con.contype = 'f'
      AND rel.relname IN ('bookings', 'mood_boards', 'client_gallery_items')
      AND att.attname = 'client_id'
      AND con.confrelid = 'public.profiles'::regclass
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', r.relname, r.conname);
  END LOOP;
END $$;

ALTER TABLE public.bookings ALTER COLUMN client_id DROP NOT NULL;
ALTER TABLE public.mood_boards ALTER COLUMN client_id DROP NOT NULL;
ALTER TABLE public.client_gallery_items ALTER COLUMN client_id DROP NOT NULL;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_client_id_fkey;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.mood_boards
  DROP CONSTRAINT IF EXISTS mood_boards_client_id_fkey;
ALTER TABLE public.mood_boards
  ADD CONSTRAINT mood_boards_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.client_gallery_items
  DROP CONSTRAINT IF EXISTS client_gallery_items_client_id_fkey;
ALTER TABLE public.client_gallery_items
  ADD CONSTRAINT client_gallery_items_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
