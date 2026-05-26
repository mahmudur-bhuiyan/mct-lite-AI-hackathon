## Goal

The custom domain should land users on the login screen. Public landing page, demo-login buttons, Google sign-in, and self-serve admin signup all go away. The very first person to sign up becomes the superadmin; after that, signup is locked and new users can only join via admin invite. Login routes each user to the view that matches their role. while can keep the 3 demo accoutns which arre already present only when entered the creds.

## Changes

### 1. Routing (`src/App.tsx`)

- `/` → `<Navigate to="/login" replace />` (drop `Index` import/usage).
- `/home` → also redirect to `/login`.
- Keep `Index.tsx` file in repo but unrouted (safe to delete later).
- Leave `/signup` mounted — page itself enforces the new gating.

### 2. Login page (`src/pages/Login.tsx`)

- Remove the entire **Demo Accounts** panel (`DEMO_ACCOUNTS`, `fillDemo`, `loginAsDemo`).
- Remove Google sign-in button + divider + `handleGoogleSignIn`.
- Remove the "Don't have an account? Sign up" footer link.
- Keep role-based redirect (`routeForRole`) — already in place.
- Add a small "Need access? Contact your administrator." note in place of the signup link.

### 3. Signup page (`src/pages/Signup.tsx`)

- Remove Google button, full-name field stays, keep email + password + confirm password.
- On mount, call new edge function `check-signup-open` (or query a public RPC) that returns `{ open: boolean }`:
  - `open === false` → render a locked card: "Signup is closed. Ask an admin to invite you." with a link back to `/login`. No form.
  - `open === true` → render the form (banner says "You'll be the workspace administrator").
- On submit, call edge function `bootstrap-first-admin` (instead of direct `supabase.auth.signUp`):
  - Function re-checks that no admin exists (race-safe), creates the user via service role with `email_confirm: true`, inserts `profiles` row, and inserts `user_roles { role: 'admin' }`.
  - Returns success → frontend calls `signIn(email, password)` then navigates to `/admin`.
- Remove the "Already have an account? Sign in" Google block; keep the plain text "Sign in" link.

### 4. New edge function `bootstrap-first-admin`

Path: `supabase/functions/bootstrap-first-admin/index.ts` (verify_jwt = false).

- `GET` / `?check=1` → returns `{ open: <count of admin role rows === 0> }`.
- `POST { email, password, full_name }` →
  1. Re-check admin count = 0; if not, return 403 `signup_closed`.
  2. `supabase.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name } })`.
  3. Upsert `profiles` and insert `user_roles` with role `admin`.
  4. `log_activity('first_admin_bootstrap', 'auth', user.id)`.
  5. Return `{ ok: true }`.
- Uses `SUPABASE_SERVICE_ROLE_KEY`.

### 5. Auth + invite flow (already in place, no rework)

- Admin invites via existing `admin-invite-user` edge function (creates user + role, returns temp password).
- Invited users log in at `/login` and `routeForRole` sends them to:
  - `admin`/`moderator` → `/admin`
  - `loan_officer` → `/dashboard`
  - `user` → `/knowledge`

### 6. AuthContext (`src/contexts/AuthContext.tsx`)

- No behavioral change required. `signInWithGoogle` stays exported (other code paths may import it) but is no longer invoked from Login/Signup UI.

## Technical notes

- The `handle_new_user` DB trigger currently assigns role `user` on every signup. We bypass it for the first admin by using `admin.createUser` from the edge function and explicitly upserting `user_roles` to `admin` (the trigger's `ON CONFLICT DO NOTHING` on `(user_id, role)` means we just insert an additional `admin` row, then we delete the stray `user` row in the same transaction).
- "Signup open" check uses `select count(*) from user_roles where role = 'admin'` via service role.
- No new tables, no migration required.

## Out of scope

- Password reset flow (already exists).
- Email delivery for invites (still surfaces temp password in admin modal until a sender domain is verified).
- Removing/cleaning the `Index.tsx` landing components (left in repo, just unrouted).