-- Link completed prequal guest sessions to borrowers created from the completion modal.
ALTER TABLE public.prequal_sessions
  ADD COLUMN IF NOT EXISTS borrower_id UUID REFERENCES public.borrowers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_prequal_sessions_borrower_id
  ON public.prequal_sessions (borrower_id)
  WHERE borrower_id IS NOT NULL;

COMMENT ON COLUMN public.prequal_sessions.borrower_id IS
  'Borrower record created when guest completes profile after pre-qualification.';
