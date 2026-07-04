-- Studio reminders FAQ content (from official studio reminder graphics)

UPDATE faq_entries
SET
  question = 'How do I book a session?',
  answer = 'Book online through StudioBook: create an account, go to Bookings, choose your package, date, and time slot, then upload your payment proof and wait for admin approval. Once confirmed, you will receive your booking details and studio location. Please book at least one (1) week ahead when possible, and double-check your date and time before submitting. Walk-ins are also welcome — message us first to check if a slot is available or if you are willing to wait, because we prioritize clients who reserved a slot.',
  keywords = ARRAY['book', 'booking', 'reserve', 'schedule', 'how', 'walk-in', 'walk in', 'appointment', 'online']
WHERE question ILIKE '%book%a session%';

UPDATE faq_entries
SET
  question = 'Can I cancel or reschedule my booking?',
  answer = 'Yes. Cancellations and rescheduling are allowed. A cancellation/reschedule fee of ₱200 applies once your booking has been approved. You can request this from your booking detail page in StudioBook.',
  keywords = ARRAY['cancel', 'cancellation', 'reschedule', 'refund', 'fee', '200']
WHERE question ILIKE '%cancel%';

UPDATE faq_entries
SET
  question = 'When will I receive my photos?',
  answer = 'Edited enhanced photos are typically uploaded the same day when possible. You can view and download them from your Client Portfolio in StudioBook. Please save your photos promptly — they may be removed from your portfolio after one (1) month.',
  keywords = ARRAY['photos', 'delivery', 'gallery', 'portfolio', 'when', 'soft copies', 'enhanced', 'download']
WHERE question ILIKE '%receive my photos%';

INSERT INTO faq_entries (question, answer, keywords)
SELECT v.question, v.answer, v.keywords
FROM (VALUES
  (
    'What is the booking and walk-in policy?',
    'Bookings should ideally be made at least one (1) week before your appointment. Walk-ins are also allowed — just message us first to check if there is an available slot or if you are willing to wait, because we prioritize clients who reserved the slot.',
    ARRAY['booking', 'policy', 'walk-in', 'walk in', 'week', 'ahead', 'slot', 'reserve']::TEXT[]
  ),
  (
    'How do I get my enhanced soft copies?',
    'Your enhanced soft copies are delivered through your Client Portfolio in StudioBook. Photos are usually uploaded the same day when possible. Please download or save them right away — they may be removed after one (1) month.',
    ARRAY['soft copies', 'soft copy', 'enhanced', 'portfolio', 'download', 'gdrive', 'drive', 'digital', 'files']::TEXT[]
  ),
  (
    'What are the penalties for damaged studio equipment?',
    'Clients are responsible for any damages to studio equipment. Penalties equivalent to the damage value will be applied — for example, damage to a backdrop with a ₱500 value.',
    ARRAY['penalty', 'penalties', 'damage', 'damaged', 'equipment', 'backdrop', 'break', 'broken']::TEXT[]
  ),
  (
    'What is the late arrival policy?',
    'Please be on time. For every 5 minutes late, a fee of ₱50 applies. If you are 1 hour late without prior notification, your appointment will be rescheduled and a fee of ₱200 applies.',
    ARRAY['late', 'arrival', 'arrive', 'minutes', 'hour', 'on time', 'tardy']::TEXT[]
  ),
  (
    'How many companions can I bring?',
    'You may bring only one (1) extra companion not included in the shoot. If you wish to bring another companion, you need to pay ₱50 or they may stay outside the studio.',
    ARRAY['companion', 'companions', 'guest', 'guests', 'extra', 'bring', 'friend', 'family']::TEXT[]
  ),
  (
    'Is the studio responsible for my personal belongings?',
    'No. The studio is not responsible for any lost or damaged personal belongings. Please keep your valuables with you.',
    ARRAY['belongings', 'lost', 'personal', 'items', 'valuables', 'responsible', 'liability']::TEXT[]
  )
) AS v(question, answer, keywords)
WHERE NOT EXISTS (
  SELECT 1 FROM faq_entries f WHERE f.question = v.question
);
