-- Fix: "Database error saving new user" on registration
-- Run this in Supabase SQL Editor if signup fails with 400/500

-- 1. Recreate trigger function with correct search_path (required by Supabase)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.email, ''),
    CASE
      WHEN (NEW.raw_user_meta_data->>'role') IN ('client', 'admin')
      THEN NEW.raw_user_meta_data->>'role'
      ELSE 'client'
    END
  );
  RETURN NEW;
END;
$$;

-- 2. Ensure trigger exists on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 3. RLS: allow new users to insert their own profile row
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
CREATE POLICY profiles_insert_own ON public.profiles
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (auth.uid() = id);

-- 4. Allow service role (used by auth trigger internally)
DROP POLICY IF EXISTS profiles_service_insert ON public.profiles;
CREATE POLICY profiles_service_insert ON public.profiles
  FOR INSERT
  TO service_role
  WITH CHECK (true);

GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.profiles TO postgres, service_role;
