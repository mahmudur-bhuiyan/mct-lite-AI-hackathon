-- Repair sessions where the borrower completed pre-qual in chat but no pipeline row exists.

UPDATE public.prequal_sessions s
SET status = 'completed'
WHERE s.status = 'active'
  AND EXISTS (
    SELECT 1
    FROM public.prequal_messages m
    WHERE m.session_id = s.id
      AND m.role = 'assistant'
      AND m.content ILIKE '%pre-qualified%'
  )
  AND EXISTS (
    SELECT 1
    FROM public.prequal_profiles p
    WHERE p.session_id = s.id
      AND (p.back_dti IS NOT NULL OR p.target_price IS NOT NULL)
  );

INSERT INTO public.prequal_loan_matches (
  session_id,
  borrower_name,
  borrower_email,
  product_type,
  prequal_amount,
  loan_amount,
  down_payment,
  ltv,
  estimated_rate,
  monthly_payment,
  back_dti,
  credit_tier,
  status,
  letter_generated,
  assigned_officer
)
SELECT
  s.id,
  COALESCE(p.borrower_name, s.guest_name),
  COALESCE(p.borrower_email, s.guest_email),
  CASE WHEN COALESCE(p.is_veteran, false) THEN 'VA' ELSE 'Conventional' END,
  GREATEST(COALESCE(p.target_price, 0), 0),
  GREATEST(COALESCE(p.target_price, 0) - COALESCE(p.down_payment, 0), 0),
  COALESCE(p.down_payment, 0),
  CASE
    WHEN COALESCE(p.target_price, 0) > 0 THEN
      ROUND(
        (GREATEST(p.target_price - COALESCE(p.down_payment, 0), 0) / p.target_price) * 100
      )
    ELSE 0
  END,
  7.0,
  0,
  p.back_dti,
  p.credit_tier,
  'qualified',
  true,
  NULL
FROM public.prequal_sessions s
JOIN public.prequal_profiles p ON p.session_id = s.id
WHERE s.status = 'completed'
  AND NOT EXISTS (
    SELECT 1 FROM public.prequal_loan_matches m WHERE m.session_id = s.id
  )
  AND COALESCE(p.target_price, 0) > 0;
