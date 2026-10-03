-- Keep chatbot answers aligned with PayMongo and admin confirmation.

UPDATE public.faq_entries
SET
  answer = 'Book on the website: create an account, or use Quick Session for a walk-in. Choose a package, date, and time, then pay online with PayMongo (GCash, Maya, or card). Cash is available for walk-ins. After payment, the studio still confirms the booking. Please book at least one (1) week ahead when you can.',
  keywords = ARRAY['book', 'booking', 'reserve', 'schedule', 'walk-in', 'walk in', 'appointment', 'online', 'guest', 'quick session', 'paymongo', 'gcash']
WHERE question = 'How do I book a session?';

UPDATE public.faq_entries
SET
  answer = 'Online payments use PayMongo: GCash, Maya, or card. Walk-ins can pay in cash. A successful payment does not confirm the session by itself — an admin still approves or disapproves the booking.',
  keywords = ARRAY['payment', 'pay', 'gcash', 'paymongo', 'maya', 'cash', 'card', 'method']
WHERE question = 'What payment methods do you accept?';

UPDATE public.faq_entries
SET
  answer = 'You can pay a downpayment (usually 50%) or the full amount. The remaining balance is due before the session. The studio confirms the booking after the payment is received.',
  keywords = ARRAY['downpayment', 'deposit', 'partial', 'full', 'balance', '50']
WHERE question = 'What is the downpayment policy?';
