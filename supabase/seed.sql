-- Seed packages (Studio 8Teen official catalog from package pictures)
-- Run sync from admin Packages page or re-run this after migration 20260101000004

DELETE FROM packages WHERE name IN (
  'Studio Session', 'Wedding Coverage', 'Birthday Events', 'Photobooth Rental', 'Corporate Events'
);

INSERT INTO packages (name, price, features, category, description, is_active, is_popular) VALUES
  ('Solo', 400, '["1 pax · 18 minutes","8 enhanced photos (soft copies)","2 pcs. 3R printed copies","1 backdrop · free use of studio props","Soft copies on GDrive for 1 month"]', 'selfshoot', '18-minute solo self-shoot session', true, false),
  ('Solo Session', 600, '["1 pax · 12 minutes","5 color-enhanced photos (soft copies)","3R size printed copies","1 backdrop · free use of studio props","Free RAW soft copies on GDrive (1 month)"]', 'selfshoot', '12-minute solo session with prints', true, false),
  ('Duo', 550, '["2 pax · 18 minutes","8 enhanced photos (soft copies)","2 pcs. 3R printed copies","1 backdrop · free use of studio props","Soft copies on GDrive for 1 month"]', 'selfshoot', '18-minute session for two', true, true),
  ('Duo Plus', 750, '["2 pax · 12 minutes","5 color-enhanced photos · 3R prints","1 backdrop · free use of studio props","Free RAW soft copies on GDrive (1 month)","Add ₱50 for solo shots"]', 'selfshoot', 'Extended duo session with RAW files', true, false),
  ('Group', 700, '["3 pax · 18 minutes","8 enhanced photos (soft copies)","2 pcs. 3R printed copies","1 backdrop · free use of studio props","Soft copies on GDrive for 1 month"]', 'selfshoot', '18-minute group session for 3 people', true, false),
  ('Group Plus', 900, '["3 pax · 18 minutes","5 color-enhanced photos · 3R prints","1 backdrop · free use of studio props","Free RAW soft copies on GDrive (1 month)","Add ₱50 for solo or couple shots"]', 'selfshoot', 'Group session with enhanced deliverables', true, false),
  ('1 Hour Session', 1150, '["Up to 5 pax · 1 hour","Pre-birthdays, birthdays, prenups, family, etc.","18 enhanced photos","5 pcs. 4R non-fading prints","Free use of studio props or bring your own"]', 'studio', '1-hour photoshoot with photographer', true, false),
  ('1 Hour Session Premium', 2500, '["Up to 13 pax · 1 hour","28 photos · 3 pcs. 4R non-fading prints","1 pcs. A4 non-fading print with frame","3 pcs. 3R non-fading prints","Free RAW soft copies on GDrive (1 month)"]', 'studio', 'Premium 1-hour session for larger groups', true, true),
  ('Photobooth Package A', 3000, '["2 hours · regular photo with photo standee","Non-fading prints"]', 'photobooth', '2-hour photobooth with standee prints', true, false),
  ('Photobooth Package B', 4000, '["2 hours · magnetic 4R photo","Non-fading prints"]', 'photobooth', '2-hour magnetic 4R photobooth', true, false),
  ('Photobooth Package C', 3300, '["2 hours · photo strip / polaroid size","Non-fading prints"]', 'photobooth', '2-hour photo strip / polaroid photobooth', true, false),
  ('Photobooth Package D', 4300, '["2 hours · photo strip / polaroid with magnet","Non-fading prints"]', 'photobooth', '2-hour polaroid photobooth with magnet', true, false),
  ('Photo Coverage Silver', 4000, '["3–4 hours · Baptismal, birthdays, civil wedding","Coverage from program entrance","All RAW photos · 100 enhanced (client-selected)","Church to reception travel (if baptismal)"]', 'event', 'Photo coverage only — Silver tier', true, false),
  ('Photo Coverage Gold', 5000, '["4–5 hours · Baptismal, birthdays, civil wedding","Coverage from program entrance","150 enhanced photos (client-selected) · all RAW","Church to reception travel (if baptismal)"]', 'event', 'Photo coverage only — Gold tier', true, false),
  ('Photo Coverage Platinum', 6000, '["5–6 hours · Baptismal, birthdays, civil wedding","Preparation to end of program","All photos enhanced · 1 pc. A4 photo with frame","Church to reception travel (if baptismal)"]', 'event', 'Photo coverage only — Platinum tier', true, true),
  ('Photo & Video Silver', 10000, '["4–5 hours · Baptismal, birthdays, civil wedding","Coverage from program entrance","All RAW photos · 100 enhanced · video highlights"]', 'event', 'Photo and video coverage — Silver tier', true, false),
  ('Photo & Video Gold', 10500, '["5–6 hours · Baptismal, birthdays, civil wedding","Coverage from program entrance","150 enhanced photos · all RAW · video highlights"]', 'event', 'Photo and video coverage — Gold tier', true, false),
  ('Photo & Video Platinum', 12500, '["7–8 hours · Baptismal, birthdays, civil wedding","Preparation to end of program","All photos enhanced · A4 with frame · video highlights"]', 'event', 'Photo and video coverage — Platinum tier', true, false),
  ('All In Package', 17000, '["7–8 hours · Baptismal, birthdays, civil wedding","Preparation to end of program · all photos enhanced","1 pc. 11R photo with frame · video highlights","2 hrs UNLI photobooth · 4R non-fading prints","Free 30-min studio shoot · invitation layout · 16GB flashdrive"]', 'event', 'Complete event coverage bundle', true, true);

-- Seed FAQ
INSERT INTO faq_entries (question, answer, keywords) VALUES
  ('What are your operating hours?', 'Studio 8Teen is open Monday to Saturday, 9 AM to 6 PM. Sunday sessions are by appointment only.', ARRAY['hours', 'open', 'schedule', 'time']),
  ('How do I book a session?', 'Create an account, go to Bookings, select a package and date, then submit your booking request and payment proof.', ARRAY['book', 'booking', 'reserve', 'schedule']),
  ('What payment methods do you accept?', 'We accept GCash and bank transfer. Scan our payment QR code and upload your payment screenshot for verification.', ARRAY['payment', 'gcash', 'pay', 'downpayment']),
  ('What is the downpayment policy?', 'You can pay a downpayment (default 50%) to confirm your booking, or pay in full. The remaining balance is due before the event.', ARRAY['downpayment', 'deposit', 'partial', 'full']),
  ('Can I cancel my booking?', 'Yes, you can cancel from your booking detail page. Cancellation and refund policies apply based on how close to the event date.', ARRAY['cancel', 'cancellation', 'refund']),
  ('When will I receive my photos?', 'Edited photos are typically delivered within 2-3 weeks after your session via your client Portfolio gallery.', ARRAY['photos', 'delivery', 'gallery', 'portfolio', 'when']),
  ('Do you offer outdoor shoots?', 'Yes! Select your preferred location when booking. Outdoor sessions may have additional travel fees.', ARRAY['outdoor', 'location', 'outside']),
  ('What should I bring to my session?', 'Check your event preparation checklist in the booking detail. Generally: comfortable clothes, props, and any inspiration references.', ARRAY['bring', 'prepare', 'checklist', 'what'])
ON CONFLICT DO NOTHING;

-- Seed availability (next 14 days, slots 9-5)
INSERT INTO studio_availability (avail_date, time_slot, capacity, booked_count, is_enabled)
SELECT d::date, slot, 2, 0, true
FROM generate_series(CURRENT_DATE, CURRENT_DATE + 13, '1 day') AS d
CROSS JOIN (VALUES ('09:00'), ('11:00'), ('13:00'), ('15:00'), ('17:00')) AS slots(slot)
ON CONFLICT (avail_date, time_slot) DO NOTHING;
