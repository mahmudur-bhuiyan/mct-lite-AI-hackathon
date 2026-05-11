## Goal

Make the Admin → Integration Hub fully functional in the Lite project, mirroring how it works in the main Control Tower Mortgage App, while hiding providers that you didn't ask for (keep their code so we can re-enable later).

Working set you asked for:
- **AI Providers (LLM):** OpenAI, Anthropic (Claude), Google (Gemini) — save key + Test button
- **LOS:** Encompass, LendingPad
- **Data Feeds:** Freddie Mac, Credit Bureau
- **Pipeline Sync / CRM:** HubSpot
- **Meeting providers:** Zoom (S2S OAuth)
- **Communication:** SendGrid

Hide (keep code, just don't render the card/tile):
- AI Providers: Perplexity
- Data Feeds: Fannie Mae, VOE/VOI, AVM, AUS DU, AUS LPA, Investor/TPO, Hedge, Appraisal/AMC, Flood, Title, HOI, RON, eClose, Adverse Action
- Communication: DocuSign (you didn't list it)

## What's there already vs what's missing

Already in the Lite repo (copied from main):
- Admin page `src/pages/admin/Integrations.tsx`
- All cards: `OpenAIIntegrationCard`, `AIProviderIntegrationCard`, `EncompassIntegrationCard`, `LendingPadIntegrationCard`, `ZoomIntegrationCard`, `SendGridIntegrationCard`, `DocuSignIntegrationCard`, `data-feeds/IntegrationsGrid` + `DataFeedIntegrationCard`
- All edge functions: `validate-api-key`, `sync-data-feed`, `sync-zoom-files`, `zoom-disconnect`, `lendingpad-oauth-*`, `los-sync-encompass`, `los-sync-lendingpad`, `send-borrower-email`, etc.

Why nothing works today:
- DB has no `integration_settings` table (Lite migration set was trimmed)
- `src/hooks/useIntegrationSettings.ts` is a no-op stub returning fake data so the build compiles — every Save / Test button is silently a no-op
- `IntegrationsGrid` shows all 16 data-feed cards (we want only Freddie Mac, Credit Bureau, plus HubSpot under Pipeline Sync)
- Tabs include Perplexity card and DocuSign card

## Plan

### 1. Database — create `integration_settings` (and supporting bits)

New migration (additive, won't touch other tables):

- Table `public.integration_settings` matching main schema:
  - `id uuid pk default gen_random_uuid()`
  - `provider_name text unique not null`
  - `display_name text not null`
  - `api_key text` (raw, server-only readable)
  - `api_key_masked text` (safe to show in UI: `sk-…xyz`)
  - `config jsonb default '{}'`
  - `is_active boolean default true`
  - `last_validated_at timestamptz`
  - `validation_status text` (`valid` | `invalid` | `not_tested` | `error`)
  - `validation_error text`
  - `created_at` / `updated_at` timestamptz with `tg_set_updated_at` trigger
  - `created_by uuid`, `updated_by uuid`
- Index on `provider_name`
- RLS enabled. Policies (using existing `has_role(auth.uid(),'admin')`):
  - `select` / `insert` / `update` / `delete` only when admin
  - Edge functions use service role and bypass RLS
- Seed display-name rows (no keys) for: openai, anthropic, google, encompass, lendingpad, hubspot, zoom, sendgrid, freddie-mac, credit-bureau

After migration, `src/integrations/supabase/types.ts` is regenerated automatically.

### 2. Replace the stub hook with the real one

File: `src/hooks/useIntegrationSettings.ts`
- Delete the no-op stub
- Port the full hook implementation from the main project (Control Tower) verbatim:
  - `useIntegrationSettings`, `useIntegrationSetting`
  - `useSaveIntegrationSetting`
  - `useValidateIntegrationKey` (calls `validate-api-key` edge function — handles zoom / lendingpad / encompass / data-feed extras)
  - `useDeleteIntegrationSetting`
  - `useToggleIntegrationStatus`
  - Re-export `integrationSettingsKeys`, `IntegrationSetting`
- Also add the small `useToggleIntegrationActive` alias and `useCreateIntegrationSetting` / `useTestIntegrationConnection` re-exports the existing cards import, so nothing breaks at build time.

### 3. Trim the Integration Hub UI

File: `src/pages/admin/Integrations.tsx`
- Remove the `perplexityConfig` card from the AI Providers tab (keep file/imports for re-enable)
- Keep `OpenAIIntegrationCard`, `AIProviderIntegrationCard` for Anthropic + Google only

File: `src/components/admin/data-feeds/IntegrationsGrid.tsx`
- Reduce the `INTEGRATIONS` array to only `freddie-mac` and `credit-bureau` (comment out the rest with a `// HIDDEN: re-enable later` block so the data is preserved)

File: `src/pages/admin/Integrations.tsx` (Communication tab)
- Hide DocuSign block (comment it out, leave the import) since you didn't list e-sign

Pipeline Sync tab keeps Encompass + HubSpot unchanged.

Meeting providers tab keeps Zoom unchanged.

### 4. Edge functions — confirm wiring (no code changes expected)

Already deployed in the Lite project: `validate-api-key`, `sync-data-feed`, `sync-zoom-files`, `zoom-disconnect`, `lendingpad-oauth-start/-callback/-disconnect`, `los-sync-encompass`, `los-sync-lendingpad`, `send-borrower-email`.

Once `integration_settings` exists they will:
- Read api keys via `_shared/integration-utils.ts`
- Test buttons round-trip through `validate-api-key`
- Sync buttons work through `sync-data-feed` / `sync-zoom-files` / `los-sync-*`

If a provider needs an extra runtime secret (e.g. SendGrid fallback, Zoom S2S without DB keys), I'll list them after the migration runs and only ask you to add the ones actually missing.

### 5. Verification

- Build passes (no more stub-import drift)
- Open `/admin/integrations`:
  - **AI Providers tab** shows OpenAI, Anthropic, Google only — Perplexity gone
  - Save an OpenAI key → Test → toast says "Validated successfully" (or actual provider response); row in `integration_settings` updated with `validation_status='valid'`
  - Same for Anthropic + Google
- **LOS tab**: LendingPad card shows OAuth + Test
- **Data Feeds tab**: only Freddie Mac + Credit Bureau cards. Save key + base URL → Test
- **Pipeline Sync tab**: Encompass card (with Test + Sync) and HubSpot card (Test + Sync)
- **Meeting providers tab**: Zoom S2S — Save → Test connection → Sync now
- **Communication tab**: SendGrid only. Save → Test connection sends a SendGrid validation call

### Risks / caveats

- The main project's hook references column names that must exist exactly — the migration mirrors them 1:1 to avoid a second pass.
- Some edge functions also read provider-specific `config` keys (e.g. `zoom_account_id`, `lendingpad_token_url`) — those already work because the cards write the same keys.
- Hidden cards stay in code; toggling them back on is a one-line change later.

Ready to implement on approval.
