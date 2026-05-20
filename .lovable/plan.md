## 1. Seed demo data so all 3 roles see content

Extend `supabase/functions/seed-demo-users` (idempotent) so after the 3 demo accounts are upserted, it also seeds:

**Borrowers (owned by lo@demo.co):** ~5 borrowers (mix of states/cities) with `created_by = LO user id`, `data_source='demo'`.

**Loans (owned by lo@demo.co):** ~6 loans across stages (`application`, `processing`, `underwriting`, `approved`, `closing`, `funded`) with `loan_officer_id = LO id`, `created_by = LO id`, realistic amounts/rates/LTV/credit/DTI, linked to seeded borrowers. `data_source='demo'`, deterministic `external_id` so re-runs upsert instead of duplicate.

**Tasks (visible to all 3 roles):**
- 2 tasks created by admin, assigned to LO (linked to a seeded loan)
- 2 tasks created by LO, assigned to user@demo.co
- 1 task assigned to admin
RLS (`tasks_user_own`) already lets each role see their own assignments; admin sees all via `tasks_admin_all`.

**Idempotency:** delete existing rows where `data_source='demo'` (borrowers/loans) and tasks with a `[demo]` title prefix before re-inserting, so re-running the function refreshes cleanly without piling up rows.

**Trigger:** add an "Reseed demo data" button in Admin → User Management (admin-only) that invokes `seed-demo-users`. Also document that publishing redeploys the function automatically.

## 2. Admin invite → create user + email credentials

User chose **"Admin creates the user directly"** + **Lovable transactional email**.

**New edge function `admin-invite-user`** (verify_jwt off, validate caller is admin in code):
- Input: `{ email, full_name?, role: 'admin'|'loan_officer'|'user' }`
- Generates a strong temporary password
- `admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata })`
- Upserts `profiles` and resets `user_roles` to the requested role
- Inserts a row in `user_invites` (audit trail, `used_at = now()`)
- Calls `send-transactional-email` with subject "You've been invited to Mortgage Control Tower" and a branded HTML email containing: login URL, email, temp password, role, and a "change password on first login" note
- Logs via `log_activity('user.invited', 'user', new_user_id, {...})`

**Email infra (one-time):** call `email_domain--scaffold_transactional_email` to generate the `send-transactional-email` function and queue infra. This requires a verified email domain — if none is configured, the publish step will surface the email setup dialog. Until DNS is verified, the function still enqueues; the response includes the temp password so the admin can share it manually as a fallback.

**Frontend (`src/pages/admin/UserManagement.tsx` + `src/hooks/useUserInvites.ts`):**
- Replace `useCreateUserInvite` mutation body with `supabase.functions.invoke('admin-invite-user', { body: {...} })`
- On success, toast "Invite sent to {email}" and show the temp password in a dismissible dialog (admin can copy if email is delayed)
- Keep the existing pending-invites list (now shows recently invited users)
- Role dropdown options: `admin`, `loan_officer`, `user` (use `LiteRole` from `src/lib/permissions.ts`)

## 3. Verification

- Run `seed-demo-users` → log in as each demo user:
  - admin sees all 6 loans + all tasks
  - lo sees own 6 loans + assigned/created tasks
  - user sees only assigned tasks (no loans, expected — has no `loans:read`)
- Admin → User Management → Invite "test@demo.co" as loan_officer → new row appears in auth users + profile + user_role, email queued (visible in Cloud → Emails), temp password shown in modal
- Re-run seed → counts unchanged (idempotent)

## Technical notes

- No schema changes required; tasks/loans/borrowers tables already support the seed pattern.
- `data_source='demo'` is the cleanup marker for borrowers/loans; tasks use a `[demo]` title prefix since they have no `data_source` column.
- `admin-invite-user` uses `requireAdmin` from `supabase/functions/_shared/require-admin.ts`.
- Email template lives inline in the edge function (small HTML string) — no React Email scaffold needed since this isn't an auth email.
- If `send-transactional-email` is missing at call time, the function still creates the user and returns the temp password so the flow doesn't hard-fail on a fresh project.