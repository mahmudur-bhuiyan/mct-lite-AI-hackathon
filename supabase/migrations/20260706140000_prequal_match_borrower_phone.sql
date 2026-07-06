-- Pipeline contact phone on loan match rows (mirrors borrower_email on prequal_loan_matches)

ALTER TABLE public.prequal_loan_matches
  ADD COLUMN IF NOT EXISTS borrower_phone TEXT;

UPDATE public.prequal_loan_matches m
SET borrower_phone = COALESCE(p.borrower_phone, s.guest_phone)
FROM public.prequal_sessions s
LEFT JOIN public.prequal_profiles p ON p.session_id = s.id
WHERE m.session_id = s.id
  AND m.borrower_phone IS NULL
  AND COALESCE(p.borrower_phone, s.guest_phone) IS NOT NULL;
