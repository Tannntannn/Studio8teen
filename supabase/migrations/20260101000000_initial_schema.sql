-- StudioBook initial schema

-- Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('client', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Packages
CREATE TABLE IF NOT EXISTS packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  features JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_popular BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Studio settings (singleton row)
CREATE TABLE IF NOT EXISTS studio_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  payment_qr_url TEXT,
  payment_qr_public_id TEXT,
  downpayment_percent INT NOT NULL DEFAULT 50,
  payment_instructions TEXT DEFAULT 'Scan the QR code and upload your payment screenshot below.'
);

INSERT INTO studio_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Studio availability
CREATE TABLE IF NOT EXISTS studio_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  avail_date DATE NOT NULL,
  time_slot TEXT NOT NULL,
  capacity INT NOT NULL DEFAULT 1,
  booked_count INT NOT NULL DEFAULT 0,
  UNIQUE(avail_date, time_slot)
);

-- Bookings
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES packages(id),
  event_date DATE NOT NULL,
  time_slot TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'awaiting_payment' CHECK (status IN (
    'pending', 'awaiting_payment', 'payment_submitted', 'confirmed', 'completed', 'cancelled'
  )),
  notes TEXT DEFAULT '',
  qr_token TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('downpayment', 'full')),
  amount NUMERIC(10,2) NOT NULL,
  proof_image_url TEXT,
  cloudinary_public_id TEXT,
  status TEXT NOT NULL DEFAULT 'awaiting' CHECK (status IN ('awaiting', 'submitted', 'verified', 'rejected')),
  verified_by UUID REFERENCES profiles(id),
  verified_at TIMESTAMPTZ,
  rejection_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Public portfolio
CREATE TABLE IF NOT EXISTS public_portfolio_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Studio',
  cloudinary_url TEXT NOT NULL,
  cloudinary_public_id TEXT,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Client gallery (post-shoot)
CREATE TABLE IF NOT EXISTS client_gallery_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  cloudinary_url TEXT NOT NULL,
  cloudinary_public_id TEXT,
  caption TEXT DEFAULT '',
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pose suggestions
CREATE TABLE IF NOT EXISTS pose_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL DEFAULT 'Portrait',
  cloudinary_url TEXT NOT NULL,
  cloudinary_public_id TEXT,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Mood boards
CREATE TABLE IF NOT EXISTS mood_boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  items JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(booking_id)
);

-- Event checklists
CREATE TABLE IF NOT EXISTS event_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  tasks JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(booking_id)
);

-- Cancellations
CREATE TABLE IF NOT EXISTS cancellations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  reason TEXT NOT NULL DEFAULT '',
  cancelled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  refund_status TEXT DEFAULT 'pending' CHECK (refund_status IN ('pending', 'approved', 'denied', 'na'))
);

-- FAQ entries
CREATE TABLE IF NOT EXISTS faq_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  keywords TEXT[] NOT NULL DEFAULT '{}'
);

-- Helper: check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'client')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Notification triggers
CREATE OR REPLACE FUNCTION notify_booking_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO notifications (user_id, type, message)
    VALUES (
      NEW.client_id,
      'booking',
      'Your booking status changed to: ' || REPLACE(NEW.status, '_', ' ')
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS booking_status_notify ON bookings;
CREATE TRIGGER booking_status_notify
  AFTER UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION notify_booking_status_change();

CREATE OR REPLACE FUNCTION notify_payment_submitted()
RETURNS TRIGGER AS $$
DECLARE
  admin_id UUID;
  booking_client UUID;
BEGIN
  IF NEW.status = 'submitted' AND (OLD.status IS NULL OR OLD.status != 'submitted') THEN
    SELECT client_id INTO booking_client FROM bookings WHERE id = NEW.booking_id;
    INSERT INTO notifications (user_id, type, message)
    VALUES (booking_client, 'payment', 'Payment proof submitted — awaiting verification.');
    FOR admin_id IN SELECT id FROM profiles WHERE role = 'admin' LOOP
      INSERT INTO notifications (user_id, type, message)
      VALUES (admin_id, 'payment', 'New payment proof to verify.');
    END LOOP;
  END IF;
  IF NEW.status = 'verified' AND OLD.status != 'verified' THEN
    SELECT client_id INTO booking_client FROM bookings WHERE id = NEW.booking_id;
    INSERT INTO notifications (user_id, type, message)
    VALUES (booking_client, 'payment', 'Payment verified! Your booking is confirmed.');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS payment_notify ON payments;
CREATE TRIGGER payment_notify
  AFTER INSERT OR UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION notify_payment_submitted();

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_portfolio_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_gallery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pose_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mood_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE cancellations ENABLE ROW LEVEL SECURITY;
ALTER TABLE faq_entries ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY profiles_select ON profiles FOR SELECT USING (true);
CREATE POLICY profiles_update_own ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY profiles_admin_all ON profiles FOR ALL USING (is_admin());

-- Packages
CREATE POLICY packages_select ON packages FOR SELECT USING (true);
CREATE POLICY packages_admin ON packages FOR ALL USING (is_admin());

-- Studio settings
CREATE POLICY settings_select ON studio_settings FOR SELECT USING (true);
CREATE POLICY settings_admin ON studio_settings FOR UPDATE USING (is_admin());

-- Availability
CREATE POLICY availability_select ON studio_availability FOR SELECT USING (true);
CREATE POLICY availability_admin ON studio_availability FOR ALL USING (is_admin());

-- Bookings
CREATE POLICY bookings_client_select ON bookings FOR SELECT USING (client_id = auth.uid() OR is_admin());
CREATE POLICY bookings_client_insert ON bookings FOR INSERT WITH CHECK (client_id = auth.uid());
CREATE POLICY bookings_admin_update ON bookings FOR UPDATE USING (is_admin());
CREATE POLICY bookings_client_update ON bookings FOR UPDATE USING (client_id = auth.uid());

-- Payments
CREATE POLICY payments_select ON payments FOR SELECT USING (
  EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_id AND (b.client_id = auth.uid() OR is_admin()))
);
CREATE POLICY payments_insert ON payments FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_id AND b.client_id = auth.uid())
);
CREATE POLICY payments_admin_update ON payments FOR UPDATE USING (is_admin());
CREATE POLICY payments_client_update ON payments FOR UPDATE USING (
  EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_id AND b.client_id = auth.uid())
);

-- Notifications
CREATE POLICY notifications_own ON notifications FOR ALL USING (user_id = auth.uid());

-- Public portfolio
CREATE POLICY public_portfolio_select ON public_portfolio_items FOR SELECT USING (true);
CREATE POLICY public_portfolio_admin ON public_portfolio_items FOR ALL USING (is_admin());

-- Client gallery
CREATE POLICY client_gallery_select ON client_gallery_items FOR SELECT USING (client_id = auth.uid() OR is_admin());
CREATE POLICY client_gallery_admin ON client_gallery_items FOR ALL USING (is_admin());

-- Poses
CREATE POLICY poses_select ON pose_suggestions FOR SELECT USING (true);
CREATE POLICY poses_admin ON pose_suggestions FOR ALL USING (is_admin());

-- Mood boards
CREATE POLICY mood_boards_select ON mood_boards FOR SELECT USING (client_id = auth.uid() OR is_admin());
CREATE POLICY mood_boards_insert ON mood_boards FOR INSERT WITH CHECK (client_id = auth.uid());
CREATE POLICY mood_boards_update ON mood_boards FOR UPDATE USING (client_id = auth.uid() OR is_admin());

-- Checklists
CREATE POLICY checklists_select ON event_checklists FOR SELECT USING (
  EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_id AND (b.client_id = auth.uid() OR is_admin()))
);
CREATE POLICY checklists_update ON event_checklists FOR UPDATE USING (
  EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_id AND (b.client_id = auth.uid() OR is_admin()))
);
CREATE POLICY checklists_admin_insert ON event_checklists FOR INSERT WITH CHECK (is_admin());

-- Cancellations
CREATE POLICY cancellations_select ON cancellations FOR SELECT USING (
  EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_id AND (b.client_id = auth.uid() OR is_admin()))
);
CREATE POLICY cancellations_insert ON cancellations FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_id AND (b.client_id = auth.uid() OR is_admin()))
);

-- FAQ
CREATE POLICY faq_select ON faq_entries FOR SELECT USING (true);
CREATE POLICY faq_admin ON faq_entries FOR ALL USING (is_admin());

-- Report RPC functions
CREATE OR REPLACE FUNCTION get_booking_stats()
RETURNS JSON AS $$
  SELECT json_build_object(
    'total', (SELECT COUNT(*) FROM bookings),
    'confirmed', (SELECT COUNT(*) FROM bookings WHERE status = 'confirmed'),
    'pending_payment', (SELECT COUNT(*) FROM bookings WHERE status IN ('awaiting_payment', 'payment_submitted')),
    'cancelled', (SELECT COUNT(*) FROM bookings WHERE status = 'cancelled'),
    'completed', (SELECT COUNT(*) FROM bookings WHERE status = 'completed')
  );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_revenue_stats()
RETURNS JSON AS $$
  SELECT json_build_object(
    'total_verified', COALESCE((SELECT SUM(amount) FROM payments WHERE status = 'verified'), 0),
    'pending', COALESCE((SELECT SUM(amount) FROM payments WHERE status = 'submitted'), 0)
  );
$$ LANGUAGE sql SECURITY DEFINER;
