-- Human-readable chat titles from the borrower's first message (e.g. "condo in 45k")
ALTER TABLE public.prequal_sessions
  ADD COLUMN IF NOT EXISTS title TEXT;

-- Backfill existing sessions from the earliest user message
UPDATE public.prequal_sessions s
SET title = sub.title
FROM (
  SELECT DISTINCT ON (m.session_id)
    m.session_id,
    left(trim(regexp_replace(m.content, '\s+', ' ', 'g')), 48) AS title
  FROM public.prequal_messages m
  WHERE m.role = 'user'
    AND length(trim(m.content)) > 0
  ORDER BY m.session_id, m.created_at ASC
) sub
WHERE s.id = sub.session_id
  AND (s.title IS NULL OR btrim(s.title) = '');
