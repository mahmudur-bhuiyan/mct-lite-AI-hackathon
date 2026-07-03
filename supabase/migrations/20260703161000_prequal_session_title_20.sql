-- Cap existing chat titles at 20 characters (including ellipsis)
UPDATE public.prequal_sessions
SET title = left(btrim(title), 19) || '…'
WHERE title IS NOT NULL
  AND length(btrim(title)) > 20;
