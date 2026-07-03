-- Backfill LO pipeline rows for sessions that have profile data but no loan match.
-- (Occurs when generate_prequal_letter ran without match_loan_products in the same turn.)

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
  'Conventional',
  GREATEST(COALESCE(p.target_price, 0) - COALESCE(p.down_payment, 0), 0),
  GREATEST(COALESCE(p.target_price, 0) - COALESCE(p.down_payment, 0), 0),
  COALESCE(p.down_payment, 0),
  CASE
    WHEN COALESCE(p.target_price, 0) > 0 THEN
      ROUND((GREATEST(p.target_price - COALESCE(p.down_payment, 0), 0) / p.target_price) * 100)
    ELSE 0
  END,
  7.0,
  0,
  p.back_dti,
  p.credit_tier,
  CASE WHEN s.status = 'completed' THEN 'qualified' ELSE 'pending' END,
  (s.status = 'completed'),
  NULL
FROM public.prequal_sessions s
JOIN public.prequal_profiles p ON p.session_id = s.id
WHERE p.target_price IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.prequal_loan_matches m WHERE m.session_id = s.id
  );
