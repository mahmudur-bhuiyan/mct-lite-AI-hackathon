## Problem

After signing in (admin or user), the app briefly flashes **"Access Denied — restricted to administrators only"** before the real page renders. For non-admin users, the same banner also appears on some routes that should silently redirect.

## Root Cause

In `src/contexts/AuthContext.tsx`:

- `loading` is flipped to `false` immediately when `onAuthStateChange` fires.
- The actual profile + role lookup (`fetchProfile` → `fetchUserRole`) is deferred via `setTimeout(..., 0)` and runs asynchronously.
- Result: there is a window where `user` is set, `loading === false`, but `profile` is still `null` (so `profile.role` is `undefined`).

The guards then misbehave during that window:

- `src/components/auth/AdminRoute.tsx` — checks `profile?.role === "admin"`. With profile still null it renders the destructive **Access Denied** alert instead of waiting.
- `src/components/routing/ModuleRoute.tsx` — when a `requiredRole` is set, calls `checkRole(profile?.role, requiredRole)` with `undefined` and shows the same Access Denied alert for normal users on role-gated routes.
- `src/components/layout/AdminLayout.tsx` — uses `useEffectivePermissions().isLoading`, which only becomes true once a `customRoleId` is known; before profile loads it is `false`, so the layout does not gate either.

This is why admins see a flash and regular users see Access Denied on some routes (any route wrapped in `ModuleRoute requiredRole="..."`).

## Fix

Make profile/role loading a first-class loading state and have all role guards wait for it.

### 1. `src/contexts/AuthContext.tsx`
- Add `profileLoading` state (default `true` while a session exists but profile hasn't resolved).
- Set `profileLoading = true` whenever a session is detected and `fetchProfile` starts; set it to `false` in a `finally` block inside `fetchProfile`.
- When there is no session, set `profileLoading = false`.
- Expose `profileLoading` via `AuthContextType` (and a convenience `authReady = !loading && (!user || !profileLoading)`).

### 2. `src/components/auth/AdminRoute.tsx`
- Treat `loading || (user && profileLoading)` as the loading state and render the existing spinner.
- Only render the Access Denied alert once profile has loaded and `profile.role !== "admin"`.

### 3. `src/components/routing/ModuleRoute.tsx`
- Include `profileLoading` (when `user` is present) in the early loading branch so the spinner shows instead of the Access Denied alert during the role-resolution window.
- Keep existing permission/feature-flag/module checks unchanged.

### 4. `src/components/layout/AdminLayout.tsx`
- Extend the loading branch to also wait while `profileLoading` is true, so the layout does not briefly render the inner Access Denied alert from `useEffectivePermissions`.

### 5. (Optional, low-risk) `src/components/routing/CalendarRoleRoute.tsx`
- Same pattern: wait for `profileLoading` before deciding to `Navigate` away.

## Out of Scope

- No changes to RLS, migrations, role data, edge functions, or the existing `OpenAI not configured` runtime error (separate Admin → Integrations setup task).
- No refactor of `useEffectivePermissions` beyond what's needed for the loading gate.

## How to test

1. Hard refresh, sign in as `admin@demo.co` → land on `/admin`. Expect a brief spinner, then the admin dashboard. **No Access Denied flash.**
2. Sign out, sign in as `lo@demo.co` → land on `/dashboard`. Visit a Loan Officer route (e.g. `/loans`). Expect spinner then content, no Access Denied banner.
3. Sign out, sign in as `user@demo.co`. Try to visit `/admin` directly → should show Access Denied (correct, after profile loads). Visit `/knowledge` and `/ai-chat` → load normally with no flash.
4. Refresh the page while already signed in as each role — same behavior, no flash.
