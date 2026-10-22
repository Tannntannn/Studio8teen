-- Preparation checklists are no longer part of the booking flow.

DROP TABLE IF EXISTS event_checklists CASCADE;
DROP TABLE IF EXISTS admin_preparation_checklist CASCADE;

UPDATE faq_entries
SET
  answer = 'Comfortable clothes, any props you want in the photos, and inspiration references if you have them. The studio will confirm details on your booking page.',
  keywords = ARRAY['bring', 'prepare', 'what', 'session']
WHERE question = 'What should I bring to my session?';
