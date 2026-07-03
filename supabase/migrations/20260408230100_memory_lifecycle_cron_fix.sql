-- Memory lifecycle cron (pg_cron already enabled in 20260402105000)

CREATE OR REPLACE FUNCTION public.prune_expired_memories()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.agent_memories
  WHERE expires_at IS NOT NULL AND expires_at < now();
  GET DIAGNOSTICS deleted_count = row_count;
  RETURN deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.consolidate_short_term_memories()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  promoted_count integer;
BEGIN
  UPDATE public.agent_memories
  SET
    memory_type = 'long_term',
    expires_at = NULL,
    importance_score = least(importance_score + 0.1, 1.0),
    updated_at = now()
  WHERE memory_type = 'short_term'
    AND access_count >= 3
    AND created_at >= now() - interval '7 days'
    AND (expires_at IS NULL OR expires_at > now());
  GET DIAGNOSTICS promoted_count = row_count;
  RETURN promoted_count;
END;
$$;

SELECT cron.unschedule('prune_expired_memories')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'prune_expired_memories');

SELECT cron.unschedule('consolidate_short_term_memories')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'consolidate_short_term_memories');

SELECT cron.schedule('prune_expired_memories', '*/30 * * * *', $$ SELECT public.prune_expired_memories(); $$);
SELECT cron.schedule('consolidate_short_term_memories', '5 * * * *', $$ SELECT public.consolidate_short_term_memories(); $$);
