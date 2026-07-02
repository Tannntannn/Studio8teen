-- StudioBook initial schema

CREATE TYPE user_role AS ENUM ('client', 'admin');
CREATE TYPE booking_status AS ENUM (
  'pending', 'awaiting_payment', 'payment_submitted', 'confirmed', 'completed', 'cancelled'
);
CREATE TYPE payment_type AS ENUM ('downpayment', 'full');
CREATE TYPE payment_status AS ENUM ('awaiting', 'submitted', 'verified', 'rejected');
CREATE TYPE refund_status AS ENUM ('none', 'pending', 'processed');

-- Profiles (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  role user_role NOT NULL DEFAULT 'client',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Packages
CREATE TABLE packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price NUMERIC(12, 2) NOT NULL,
  features JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Studio settings (singleton row)
CREATE TABLE studio_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  payment_qr_url TEXT,
  payment_qr_public_id TEXT,
  downpayment_percent INT NOT NULL DEFAULT 50,
  payment_instructions TEXT DEFAULT 'Scan the QR code and upload your payment screenshot.',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO studio_settings (id) VALUES (1);

-- Studio availability
CREATE TABLE studio_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  avail_date DATE NOT NULL,
  time_slot TEXT NOT NULL,
  capacity INT NOT NULL DEFAULT 1,
  booked_count INT NOT NULL DEFAULT 0,
  UNIQUE (avail_date, time_slot)
);

-- Bookings
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES packages(id),
  event_date DATE NOT NULL,
  time_slot TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  status booking_status NOT NULL DEFAULT 'awaiting_payment',
  notes TEXT DEFAULT '',
  qr_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payments
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  payment_type payment_type NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  proof_image_url TEXT,
  cloudinary_public_id TEXT,
  status payment_status NOT NULL DEFAULT 'awaiting',
  verified_by UUID REFERENCES profiles(id),
  verified_at TIMESTAMPTZ,
  rejection_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Public portfolio
CREATE TABLE public_portfolio_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Studio',
  cloudinary_url TEXT NOT NULL,
  cloudinary_public_id TEXT,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Client gallery (post-shoot)
CREATE TABLE client_gallery_items (
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
CREATE TABLE pose_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL DEFAULT 'Portrait',
  cloudinary_url TEXT NOT NULL,
  cloudinary_public_id TEXT,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Mood boards
CREATE TABLE mood_boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  items JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (booking_id)
);

-- Event checklists
CREATE TABLE event_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  tasks JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (booking_id)
);

-- Cancellations
CREATE TABLE cancellations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  cancelled_by UUID REFERENCES profiles(id),
  cancelled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  refund_status refund_status NOT NULL DEFAULT 'none'
);

-- FAQ
CREATE TABLE faq_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  keywords TEXT[] NOT NULL DEFAULT '{}'
);

-- Helper: is admin
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
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'client')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Notification triggers
CREATE OR REPLACE FUNCTION notify_booking_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO notifications (user_id, type, message)
    VALUES (
      NEW.client_id,
      'booking',
      'Your booking status changed to: ' || NEW.status::TEXT
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER booking_status_notify
  AFTER UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION notify_booking_status_change();

-- Default checklist on booking confirm
CREATE OR REPLACE FUNCTION create_booking_extras()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    INSERT INTO event_checklists (booking_id, tasks)
    VALUES (NEW.id, '[
      {"label": "Confirm outfit choices", "checked": false},
      {"label": "Review pose suggestions", "checked": false},
      {"label": "Prepare mood board inspiration", "checked": false},
      {"label": "Arrive 15 minutes early", "checked": false}
    ]'::jsonb)
    ON CONFLICT (booking_id) DO NOTHING;

    INSERT INTO mood_boards (booking_id, client_id, items)
    VALUES (NEW.id, NEW.client_id, '[]'::jsonb)
    ON CONFLICT (booking_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER booking_confirmed_extras
  AFTER UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION create_booking_extras();

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
CREATE POLICY profiles_select ON profiles FOR SELECT USING (id = auth.uid() OR is_admin());
CREATE POLICY profiles_update ON profiles FOR UPDATE USING (id = auth.uid() OR is_admin());

-- Packages
CREATE POLICY packages_select ON packages FOR SELECT USING (TRUE);
CREATE POLICY packages_admin ON packages FOR ALL USING (is_admin());

-- Studio settings
CREATE POLICY settings_select ON studio_settings FOR SELECT USING (TRUE);
CREATE POLICY settings_admin ON studio_settings FOR ALL USING (is_admin());

-- Availability
CREATE POLICY availability_select ON studio_availability FOR SELECT USING (TRUE);
CREATE POLICY availability_admin ON studio_availability FOR ALL USING (is_admin());

-- Bookings
CREATE POLICY bookings_client_select ON bookings FOR SELECT USING (client_id = auth.uid() OR is_admin());
CREATE POLICY bookings_client_insert ON bookings FOR INSERT WITH CHECK (client_id = auth.uid());
CREATE POLICY bookings_admin_update ON bookings FOR UPDATE USING (is_admin() OR client_id = auth.uid());

-- Payments
CREATE POLICY payments_select ON payments FOR SELECT USING (
  EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_id AND (b.client_id = auth.uid() OR is_admin()))
);
CREATE POLICY payments_insert ON payments FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_id AND b.client_id = auth.uid())
);
CREATE POLICY payments_admin_update ON payments FOR UPDATE USING (is_admin());

-- Notifications
CREATE POLICY notifications_own ON notifications FOR ALL USING (user_id = auth.uid() OR is_admin());

-- Public portfolio
CREATE POLICY public_portfolio_select ON public_portfolio_items FOR SELECT USING (TRUE);
CREATE POLICY public_portfolio_admin ON public_portfolio_items FOR ALL USING (is_admin());

-- Client gallery
CREATE POLICY client_gallery_select ON client_gallery_items FOR SELECT USING (client_id = auth.uid() OR is_admin());
CREATE POLICY client_gallery_admin ON client_gallery_items FOR ALL USING (is_admin());

-- Poses
CREATE POLICY poses_select ON pose_suggestions FOR SELECT USING (TRUE);
CREATE POLICY poses_admin ON pose_suggestions FOR ALL USING (is_admin());

-- Mood boards
CREATE POLICY mood_boards_select ON mood_boards FOR SELECT USING (client_id = auth.uid() OR is_admin());
CREATE POLICY mood_boards_update ON mood_boards FOR UPDATE USING (client_id = auth.uid() OR is_admin());
CREATE POLICY mood_boards_insert ON mood_boards FOR INSERT WITH CHECK (is_admin());

-- Checklists
CREATE POLICY checklists_select ON event_checklists FOR SELECT USING (
  EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_id AND (b.client_id = auth.uid() OR is_admin()))
);
CREATE POLICY checklists_update ON event_checklists FOR UPDATE USING (
  EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_id AND (b.client_id = auth.uid() OR is_admin()))
);
CREATE POLICY checklists_insert ON event_checklists FOR INSERT WITH CHECK (is_admin());

-- Cancellations
CREATE POLICY cancellations_select ON cancellations FOR SELECT USING (is_admin() OR EXISTS (
  SELECT 1 FROM bookings b WHERE b.id = booking_id AND b.client_id = auth.uid()
));
CREATE POLICY cancellations_insert ON cancellations FOR INSERT WITH CHECK (
  is_admin() OR EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_id AND b.client_id = auth.uid())
);

-- FAQ
CREATE POLICY faq_select ON faq_entries FOR SELECT USING (TRUE);
CREATE POLICY faq_admin ON faq_entries FOR ALL USING (is_admin());

-- Report RPCs
CREATE OR REPLACE FUNCTION get_booking_stats()
RETURNS JSON AS $$
  SELECT json_build_object(
    'total', (SELECT COUNT(*) FROM bookings),
    'confirmed', (SELECT COUNT(*) FROM bookings WHERE status = 'confirmed'),
    'pending_payment', (SELECT COUNT(*) FROM bookings WHERE status IN ('awaiting_payment', 'payment_submitted')),
    'cancelled', (SELECT COUNT(*) FROM cancellations),
    'revenue', (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'verified')
  );
$$ LANGUAGE sql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_booking_stats() TO authenticated;
