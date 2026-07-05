-- Optional phone on guest pre-qual intake (loan officer follow-up)

ALTER TABLE public.prequal_sessions
  ADD COLUMN IF NOT EXISTS guest_phone TEXT;

ALTER TABLE public.prequal_profiles
  ADD COLUMN IF NOT EXISTS borrower_phone TEXT;
