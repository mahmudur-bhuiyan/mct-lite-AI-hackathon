-- Retire duplicate intake-only guest sessions when the same email already has a
-- qualified pre-qual on a different session (common before email-based resume).

UPDATE public.prequal_sessions s
SET status = 'abandoned'
WHERE s.user_id IS NULL
  AND s.status = 'active'
  AND s.guest_email IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.prequal_loan_matches lm
    WHERE lm.session_id = s.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.prequal_messages m
    WHERE m.session_id = s.id AND m.role = 'user'
  )
  AND EXISTS (
    SELECT 1
    FROM public.prequal_sessions s2
    INNER JOIN public.prequal_loan_matches lm2 ON lm2.session_id = s2.id
    WHERE s2.user_id IS NULL
      AND lower(s2.guest_email) = lower(s.guest_email)
      AND s2.id <> s.id
      AND lm2.status = 'qualified'
  );
