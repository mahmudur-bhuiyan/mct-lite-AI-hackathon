# Mortgage Control Tower Lite — Configuration Plan

Ship a streamlined "Lite" build by **hiding** features behind the existing module/feature-flag/role guards. **Nothing is deleted** — everything is reversible from `/admin/modules` and `/admin/roles` once we want to re-enable it.

---

## 1. Rebranding to "MCT Lite"

**`src/contexts/BrandingContext.tsx`** — update defaults:
- `companyName`: `"Mortgage Control Tower Lite"`
- `tagline`: `"Your loan pipeline. Simplified."`
- `supportEmail`: `"support@mortgagecontroltower.com"`
- Add `shortName: "MCT Lite"` to the context.

**Sidebar header** (`src/components/layout/AppSidebar.tsx`) — replace the hard-coded `"Control Tower"` / `{companyName}` block with `"MCT Lite"` (primary) and `"Mortgage Control Tower Lite"` (subtitle).

**CollabAI removal** — replace `"CollabAI"`, `"CollabAI Agentic Workforce"`, `"collabai.software"` with `"MCT Lite"` / `"Mortgage Control Tower Lite"` / `"mortgagecontroltower.com"` in:
- `src/pages/Index.tsx`, `src/pages/Pricing.tsx`, `src/pages/Login.tsx`
- `src/components/landing/*` (Hero, Footer, FinalCTA, PricingPreview)
- `src/components/pricing/*` (rename `CollabAISecurityBadge.tsx` → `SecurityBadge.tsx`, update imports in `index.ts`)
- `src/components/OnboardingWizard.tsx`, `src/pages/admin/SystemSettings.tsx`
- `index.html` `<title>` + meta
- Headline docs only: `docs/README.md`, `docs/QUICKSTART.md`, `docs/PRODUCT_OVERVIEW.md`, `docs/ADMIN-GUIDE.md` (skip dated daily logs and deployment runbooks to keep churn low — call this out in the summary).

---

## 2. Supabase — new project, same schema

- User supplies `VITE_SUPABASE_URL`, `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_PUBLISHABLE_KEY` via Settings.
- **No migration files touched.** All existing migrations, edge functions, and RLS policies remain.
- Add a one-time setup note in `docs/QUICKSTART.md` describing: link new project, push migrations (`supabase db push`), deploy functions, set secrets.

---

## 3. Three roles

Roles in `profiles.role`:

| Role string     | Access                                                                                  |
| --------------- | --------------------------------------------------------------------------------------- |
| `admin`         | Everything + entire `/admin/*`                                                          |
| `loan_officer`  | Dashboard, Loans (own via RLS), Borrowers (own), AI Chat, Knowledge, Notifications, Action Items |
| `user`          | Dashboard (summary), AI Chat, Knowledge (read), Notifications                            |

Changes:
- **`src/lib/permissions.ts`** — add a `LITE_ROLE_PERMISSIONS: Record<"admin"|"loan_officer"|"user", string[]>` map listing the permission keys each role gets by default.
- **`src/hooks/useEffectivePermissions.ts`** — when the user has no `custom_role_id` and no per-user settings, fall back to `LITE_ROLE_PERMISSIONS[profile.role]` instead of an empty list. Admin still short-circuits to all permissions.
- **`src/components/routing/ModuleRoute.tsx`** `checkRole` — replace the `user → moderator → admin` hierarchy with the explicit set `{admin, loan_officer, user}`. Admin satisfies every requirement; `loan_officer` satisfies `loan_officer` and `user`; `user` satisfies only `user`.
- **`src/pages/admin/RoleManagement.tsx`** — surface the three built-in roles as read-only "system roles" at the top; custom roles still allowed below.
- Add a SQL helper in a **new** migration `supabase/migrations/<ts>_seed_lite_roles.sql` that ensures the `roles` table has `admin`, `loan_officer`, `user` rows with appropriate `permissions` arrays (idempotent `ON CONFLICT (slug) DO NOTHING`).

---

## 4. Active vs hidden modules

Use the existing `module_settings` table. Add a migration `supabase/migrations/<ts>_seed_lite_modules.sql` that upserts these slugs (enabled flags shown):

| Slug                  | Enabled | Notes                                        |
| --------------------- | ------- | -------------------------------------------- |
| `loans`               | `true`  | Loans + Borrowers + Action Items + Calendar |
| `meetings`            | `false` |                                              |
| `tasks`               | `false` |                                              |
| `clients`             | `false` |                                              |
| `pricing`             | `false` |                                              |
| `rate_locks`          | `false` |                                              |
| `hedge_analytics`     | `false` |                                              |
| `underwriting_queue`  | `false` |                                              |
| `document_review`     | `false` |                                              |
| `communication_center`| `false` |                                              |
| `email_intelligence`  | `false` |                                              |
| `borrower_portal`     | `false` |                                              |
| `prequal_calculator`  | `false` | `/prequal-public` widget remains public      |
| `compliance`          | `false` |                                              |
| `hmda`                | `false` |                                              |
| `licensing`           | `false` |                                              |
| `leaderboard`         | `false` |                                              |
| `pipeline_views`      | `false` | HubSpot/Encompass pipeline pages             |

Routing changes in **`src/App.tsx`**:
- Wrap all currently-ungated hidden routes in `<ModuleRoute requiresModule="...">` using the slugs above (e.g. `/meetings/*` gets `requiresModule="meetings"`, `/pipeline/*` gets `requiresModule="pipeline_views"`, `/communication-center` gets `requiresModule="communication_center"`, etc.).
- Active routes (`/dashboard`, `/loans/*`, `/borrowers/*`, `/ai`, `/ai/chat`, `/knowledge/*`, `/notifications`, `/action-items`) keep their existing guards. `/loans` and `/borrowers` already use `requiresModule="loans"` — leave intact.
- **Do not delete any imports or `<Route>` blocks** — admin can flip a module on later and it just works.

**`src/components/layout/AppSidebar.tsx`** — `navigationItems` becomes exactly:

1. Dashboard
2. Loans (`module: "loans"`, perm `loans:read`)
3. Borrowers (`module: "loans"`, perm `borrowers:read`)
4. Knowledge Base (perm `knowledge:read`, flag `enableKnowledgeBase`)
5. Notifications (flag `enableNotifications`)
6. Action Items

`aiToolsItems` becomes:
- AI Chat (perm `ai_chat:read`, flag `enableAIChat`)

Remove Pipeline, Operations Calendar, Email Intelligence, Communication Center, AI Agents, Feedback from the sidebar arrays. Their routes stay reachable by URL once the matching module is enabled.

---

## 5. Slim admin nav

**`src/components/layout/AdminSidebar.tsx`** — collapse `sidebarGroups` to only:

- **DASHBOARD** → Overview
- **USERS & ACCESS** → User Management, Role Management
- **AI** → AI Models
- **SYSTEM** → Module Management, System Settings, Integrations

All other groups (Content & Feedback, Risk & Compliance, Developer Docs, Cron, Activity Logs, AI Usage, Deployment, Environment, SSO, Onboarding) are **removed from the array** but their routes in `App.tsx` stay intact, so admin can still reach them by URL.

---

## 6. Integrations — untouched

`/admin/integrations` and `/admin/integrations/:slug` (`ProviderDetail`) already render every provider (LendingPad, Encompass, Zoom, Microsoft Teams, Gmail, DocuSign, OpenAI, Google, Anthropic, Perplexity, SendGrid). No code changes needed — only a quick visual check that all provider cards render in the new Supabase project once `integration_providers` is seeded by existing migrations.

---

## 7. Signup → default role `user`

- **`src/pages/Signup.tsx`** — when creating the profile after `supabase.auth.signUp`, insert `role: "user"` into `profiles` (it likely already does — verify and harden).
- Add a "first-user becomes admin" check: a new edge function `bootstrap-first-admin` (or extend an existing one) that, on signup, counts `profiles` and if `count === 1` upgrades that user's `user_roles` to `admin`. Document the manual fallback (the existing `docs/QUICKSTART.md` SQL snippet) in the rebranded quickstart.
- `/admin/users` already supports role assignment — surface a clear "Promote to Loan Officer / Admin" action in the row menu (small UI tweak in `UserManagement.tsx`).

---

## 8. Role-aware Dashboard

**`src/pages/Dashboard.tsx`** — branch on `profile.role`:

- `admin`: existing pipeline snapshot + AI agent status + user count (use `useAdminStats`, `useManagerDashboard`).
- `loan_officer`: own active loans count, pending conditions, today's action items, AI chat shortcut (`useDashboard`, `useActionItems`).
- `user`: welcome card, AI chat shortcut, recent knowledge articles (`useKnowledge`).

No new hooks — reuse `useDashboard`, `useManagerDashboard`, `useAdminStats`, `useActionItems`, `useKnowledge`.

---

## 9. Untouched (guardrails)

- `supabase/functions/_shared/ai-utils.ts`
- `useLoanTransitions` + `transition-loan-status` edge function
- `loan_timeline_events` table
- Every existing RLS policy and migration file
- `ai_chat_threads` `conversation_id` threading
- `retrieve-agent-memories` + `extract-agent-memories`
- JWT validation in edge functions

---

## Technical summary

**Files edited:**
- `src/contexts/BrandingContext.tsx`
- `src/lib/permissions.ts`
- `src/hooks/useEffectivePermissions.ts`
- `src/components/routing/ModuleRoute.tsx`
- `src/components/layout/AppSidebar.tsx`
- `src/components/layout/AdminSidebar.tsx`
- `src/App.tsx` (wrap hidden routes in `ModuleRoute requiresModule=...`, no deletions)
- `src/pages/Dashboard.tsx`
- `src/pages/Signup.tsx`, `src/pages/admin/UserManagement.tsx`
- `src/pages/Index.tsx`, `src/pages/Pricing.tsx`, `src/pages/Login.tsx`
- `src/components/landing/*`, `src/components/pricing/*`
- `src/components/OnboardingWizard.tsx`, `src/pages/admin/SystemSettings.tsx`
- `index.html`
- Headline `docs/*.md` only

**Files added:**
- `supabase/migrations/<ts>_seed_lite_modules.sql` (upsert 18 module rows)
- `supabase/migrations/<ts>_seed_lite_roles.sql` (upsert `admin`/`loan_officer`/`user` in `roles`)
- Optional: `supabase/functions/bootstrap-first-admin/index.ts`

**Files explicitly NOT touched:** all existing migrations, all edge functions in the guardrail list, every page/component under hidden modules (they continue to exist, just gated).

**Risks:**
- A user with the legacy `moderator` role string will lose access until reassigned — flag this in the migration's comment and in the rebranded quickstart.
- Module slugs added by the new seed must match the strings used in `requiresModule={...}` props in `App.tsx` — single source of truth lives in the migration; document the list in `src/lib/admin-routes.ts` as a constant to avoid drift.

**Reversibility:** Flip any module to `enabled=true` in `/admin/modules` to instantly restore its routes and (if added back to the array) its sidebar entry. No code redeploy needed for backend visibility; sidebar entries require uncommenting one line in `AppSidebar.tsx`.
