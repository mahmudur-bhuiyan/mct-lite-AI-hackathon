-- Expand knowledge_entries for seed migration columns

ALTER TABLE public.knowledge_entries
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.knowledge_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS summary TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_entries_slug ON public.knowledge_entries(slug);
