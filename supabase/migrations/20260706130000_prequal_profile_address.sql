-- Mailing address on pre-qual profile (collected in chat for borrower auto-create)

ALTER TABLE public.prequal_profiles
  ADD COLUMN IF NOT EXISTS street_address TEXT,
  ADD COLUMN IF NOT EXISTS postal_code TEXT,
  ADD COLUMN IF NOT EXISTS letter_ready BOOLEAN DEFAULT false;
