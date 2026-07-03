-- Switch AI agents from Google Gemini to OpenAI (uses OPENAI_API_KEY / Admin Integrations).
UPDATE public.ai_agents
SET provider_config =
  COALESCE(provider_config, '{}'::jsonb)
  - 'provider'
  - 'model'
  || jsonb_build_object('provider', 'openai', 'model', 'gpt-4o-mini')
WHERE provider_config->>'provider' = 'google'
   OR COALESCE(trim(provider_config->>'provider'), '') = '';
