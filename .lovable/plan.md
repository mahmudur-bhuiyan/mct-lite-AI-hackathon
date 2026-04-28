# Connect Own Backend via Lovable Cloud

## Current state (verified)

The remix still uses the original project's Supabase instance:

- `.env` → `VITE_SUPABASE_URL=https://spppmtgzugvknfqeyjqq.supabase.co`
- `src/integrations/supabase/public-config.ts` → hardcoded fallback to `spppmtgzugvknfqeyjqq`
- `supabase/config.toml` + `supabase/.temp/linked-project.json` → linked to `spppmtgzugvknfqeyjqq` ("mortgage-control-tower")
- Live network logs show every auth/profile/role request hitting `spppmtgzugvknfqeyjqq.supabase.co`
- Logged-in user in preview (`admin@collabai.software`) is from the original DB

This means: any data you create, every login, every role — is going to the original owner's database, not yours.

## What this plan does

Switch the entire app to a brand-new Lovable Cloud project owned by this remix, then re-seed the minimum data needed for MCT Lite to run.

## Steps

### 1. Enable Lovable Cloud
Provision a fresh Cloud (Supabase) backend for this project. This auto-injects new `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_SUPABASE_PROJECT_ID` and rewires `src/integrations/supabase/client.ts` to the new project.

### 2. Remove hardcoded references to the old project
- `src/integrations/supabase/public-config.ts`: drop the `DEV_FALLBACK_URL` / `DEV_FALLBACK_KEY` constants pointing at `spppmtgzugvknfqeyjqq` so nothing can silently fall back to the old backend.
- `.env` / `.env.example` / `DEPLOYMENT_ENV_SETUP.md`: replace example values with placeholders (no secrets in repo).
- `supabase/config.toml` + `supabase/.temp/*`: update `project_id` to the new Cloud ref so CLI commands target the new project.

### 3. Apply schema to the new database
The new Cloud project starts empty. Run the existing migrations under `supabase/migrations/` against it so all tables (`profiles`, `user_roles`, `module_settings`, `loans`, `borrowers`, `activity_logs`, `app_role` enum, RLS policies, RPCs like `log_activity`, `has_role`, etc.) exist.

### 4. Seed MCT Lite configuration
Apply `supabase/seeds/lite_modules_and_roles.sql` (created in the previous step) to enable only the 8 active modules and confirm the 3-role hierarchy.

### 5. Fix the `activity_logs_resource_type_check` regression
Network logs show login attempts fail to log because `"auth"` isn't in the allowed `resource_type` check constraint. Add a migration that extends the check constraint to include `'auth'` (or change the call site to a permitted value). This is what's causing the 23514 errors visible right now.

### 6. Bootstrap the first admin user
Empty DB = no users. Create:
- `admin@mortgagecontroltower.com` (admin role) via Cloud Users panel, then insert a row in `user_roles` with `role='admin'`.
- Optional: `demo@mortgagecontroltower.com` as `loan_officer` for demos.
Document the credentials in a setup note (not committed).

### 7. Edge function secrets
Re-add any secrets the edge functions need (Gmail OAuth, LendingPad, OpenAI/Lovable AI key, etc.) to the new Cloud project. The old project's secrets do not transfer.

### 8. Verify
- Visit `/env-debug` → confirm new URL/key are loaded.
- Sign in as the new admin → confirm `profiles` + `user_roles` populate.
- Confirm sidebar renders the 8 lite modules.
- Confirm `log_activity` no longer 400s.

## Technical notes

- Auth users from the old project cannot be migrated automatically (password hashes are owned by the source project). New accounts must be created in the new project.
- Loan/borrower data also does not transfer — fresh DB. If you want to copy data, that's a separate export/import task.
- Microsoft SSO (`VITE_MICROSOFT_*`) is unaffected; it's identity-provider config, not Supabase.
- After cutover, the old `spppmtgzugvknfqeyjqq` references should appear nowhere in `src/` or `supabase/`.

## Risks

- **Data loss perception**: anything you've created while logged into the original project stays there — it's not yours and won't move. Confirm you accept this before cutover.
- **Edge functions**: ~80+ functions exist; they'll redeploy against the new project but any provider-specific webhooks (Gmail, LendingPad, Teams) will need their callback URLs reconfigured in those external services to point at the new project's function URLs.