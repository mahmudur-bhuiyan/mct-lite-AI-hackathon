-- Activity logs (framework) — required before expand_activity_log_resource_types

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT activity_logs_resource_type_check CHECK (
    resource_type IN (
      'auth','loan','borrower','client','meeting','task','knowledge','user','role',
      'module','agent','document','rate_lock','pricing','compliance','system','other'
    )
  )
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity_logs_select_own" ON public.activity_logs;
CREATE POLICY "activity_logs_select_own"
  ON public.activity_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role('admin'::public.app_role, auth.uid()));

DROP POLICY IF EXISTS "activity_logs_insert_own" ON public.activity_logs;
CREATE POLICY "activity_logs_insert_own"
  ON public.activity_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
