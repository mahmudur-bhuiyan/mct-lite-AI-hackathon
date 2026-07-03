-- User preferences and other per-profile settings stored in profiles.metadata
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.profiles.metadata IS 'User-scoped JSON blob; preferences live at metadata.preferences';
