-- Align agent_memories with 20260512000001 expectations (table created earlier in 08210000)

ALTER TABLE public.agent_memories
  ADD COLUMN IF NOT EXISTS memory_category TEXT,
  ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'conversation',
  ADD COLUMN IF NOT EXISTS source_id UUID,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS consolidated BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS superseded_by UUID REFERENCES public.agent_memories(id);

CREATE INDEX IF NOT EXISTS idx_agent_memories_active
  ON public.agent_memories(agent_id, user_id, is_active);
