-- Allow admins to permanently delete bookings

DROP POLICY IF EXISTS bookings_admin_delete ON public.bookings;
CREATE POLICY bookings_admin_delete ON public.bookings
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
