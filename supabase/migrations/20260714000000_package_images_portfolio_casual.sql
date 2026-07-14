-- Package images + rename portfolio category Studio → Casual

ALTER TABLE packages
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS image_public_id TEXT;

ALTER TABLE public_portfolio_items
  ALTER COLUMN category SET DEFAULT 'Casual';

UPDATE public_portfolio_items
SET category = 'Casual'
WHERE category = 'Studio';
