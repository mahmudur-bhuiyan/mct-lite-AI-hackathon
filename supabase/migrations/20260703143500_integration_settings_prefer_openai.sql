-- Prefer OpenAI over Google AI for agent routing (API key stays in edge secrets / Admin UI).
UPDATE public.integration_settings
SET is_active = false, updated_at = now()
WHERE provider_name = 'google';

UPDATE public.integration_settings
SET
  is_active = true,
  validation_status = COALESCE(validation_status, 'not_tested'),
  updated_at = now()
WHERE provider_name = 'openai';
