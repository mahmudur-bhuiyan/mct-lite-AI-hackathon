-- Knowledge entries (framework) — required before seed_knowledge_entries

CREATE TABLE IF NOT EXISTS public.knowledge_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT,
  category TEXT,
  tags TEXT[] DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.knowledge_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "knowledge_entries_select_authenticated" ON public.knowledge_entries;
CREATE POLICY "knowledge_entries_select_authenticated"
  ON public.knowledge_entries FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "knowledge_entries_admin_all" ON public.knowledge_entries;
CREATE POLICY "knowledge_entries_admin_all"
  ON public.knowledge_entries FOR ALL TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()))
  WITH CHECK (public.has_role('admin'::public.app_role, auth.uid()));
