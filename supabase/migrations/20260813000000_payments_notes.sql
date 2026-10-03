-- Store payment method / walk-in cash notes on payments
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN public.payments.notes IS
  'Client-facing note, e.g. Paid via GCash or Cash (walk-in).';
