-- Rescheduling has no separate fee; cancellation fee remains ₱100.
UPDATE faq_entries
SET
  answer = 'Yes. Cancellations and rescheduling are allowed. Once your booking is approved, a non-refundable ₱100 cancellation fee applies if you cancel. Rescheduling is handled by the studio and does not add a separate fee. You can request cancellation from your booking detail page in StudioBook.',
  keywords = ARRAY['cancel', 'cancellation', 'reschedule', 'refund', 'fee', '100']
WHERE question ILIKE '%cancel%reschedule%'
   OR question = 'Can I cancel or reschedule my booking?';
