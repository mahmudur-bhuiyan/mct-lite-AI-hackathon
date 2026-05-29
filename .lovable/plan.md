## Goal
Remove the "user" role experience from the product. Only **Admin**, **Manager** (moderator), and **Loan Officer** are exposed in the UI. Manager and Loan Officer share the same post-login destination. Existing accounts with role `user` are hidden from the admin list and can no longer be invited.

## Changes

### 1. `src/pages/Login.tsx` — role routing
- Update `routeForRole`:
  - `admin` → `/admin`
  - `moderator` (Manager) → `/dashboard` (same as Loan Officer)
  - `loan_officer` → `/dashboard`
  - Any other value (including `user`) → `/dashboard` (no more `/knowledge` landing)
- No visible role picker exists on the login form, so no UI element to remove there.

### 2. `src/pages/admin/UserManagement.tsx` — invite + listing
- `INVITE_ROLES`: drop `User`. Keep only `Loan Officer`, `Manager` (`moderator`), `Admin`.
- Default `inviteRole` state changes from `"user"` to `"loan_officer"`. Reset value after submit updated to match.
- Filter the rendered user list to exclude rows where `role === "user"` (still fetched, just hidden — keeps admin recovery possible if needed later).
- Update the "Total Users" stat to count only visible (non-`user`) accounts so the number matches the table.
- Edit Role dialog: remove `user` from the options shown for the app-role select so admins can't downgrade someone to `user`.

### 3. Nothing else touched
- No DB migration, no RLS change, no route guard change. Existing `user`-role accounts keep working at the DB level; they just become invisible in the admin UI and route to `/dashboard` if they sign in.

## Out of scope (please confirm if you want these too)
- Deleting or auto-converting existing `user`-role rows in `user_roles`.
- Removing the `'user'` value from the `app_role` Postgres enum.
- Hiding the Knowledge module (currently the old `user` landing page) from navigation.
