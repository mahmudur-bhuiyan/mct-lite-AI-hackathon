-- Guest borrowers: name/email on session + pipeline contact fields

ALTER TABLE public.prequal_sessions
  ADD COLUMN IF NOT EXISTS guest_name TEXT,
  ADD COLUMN IF NOT EXISTS guest_email TEXT;

ALTER TABLE public.prequal_profiles
  ADD COLUMN IF NOT EXISTS borrower_email TEXT;

ALTER TABLE public.prequal_loan_matches
  ADD COLUMN IF NOT EXISTS borrower_email TEXT;

CREATE INDEX IF NOT EXISTS idx_prequal_sessions_guest_email
  ON public.prequal_sessions (guest_email)
  WHERE guest_email IS NOT NULL;
