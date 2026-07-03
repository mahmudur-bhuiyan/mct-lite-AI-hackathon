-- Clients table (CRM) — referenced by meetings; missing from original Lovable base in repo

CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  company TEXT,
  phone TEXT,
  status TEXT DEFAULT 'active',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clients_select_authenticated" ON public.clients;
CREATE POLICY "clients_select_authenticated"
  ON public.clients FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "clients_insert_authenticated" ON public.clients;
CREATE POLICY "clients_insert_authenticated"
  ON public.clients FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "clients_update_authenticated" ON public.clients;
CREATE POLICY "clients_update_authenticated"
  ON public.clients FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "clients_delete_admin" ON public.clients;
CREATE POLICY "clients_delete_admin"
  ON public.clients FOR DELETE TO authenticated
  USING (public.has_role('admin'::public.app_role, auth.uid()));
