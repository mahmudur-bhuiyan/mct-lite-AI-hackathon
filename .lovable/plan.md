## Plan

### 1. Replace MCT Lite logo + wordmark with MortgageAI logo

- Copy uploaded `user-uploads://MortgageAI_Logo.svg` → `src/assets/mortgageai-logo.svg`.
- Create small `Brand.tsx` component that renders the SVG (sized for context) with the text **"Control Tower"** on the same line/area just under or beside it. Used everywhere the old logo+wordmark pair appears.
- Swap usages in:
  - `src/components/layout/AppSidebar.tsx` (replace `Brain`+Sparkles tile and "MCT Lite / Mortgage Control Tower Lite" text)
  - `src/components/landing/Footer.tsx` (replace `Building2` tile + "MCT Lite" / shortName)
  - `src/components/layout/PublicDocsLayout.tsx` (replace `Building2` tile + brand text)
  - `src/pages/Login.tsx` and `src/pages/Signup.tsx` headers (if they show the icon/wordmark)
- Update text references "MCT Lite" → "Control Tower" in user-facing landing copy: `HeroSection.tsx`, `FeatureGrid.tsx`, `ProblemSolution.tsx`, `ValueProps.tsx`, `SocialProof.tsx`, `PricingPreview.tsx`, `FinalCTA.tsx`, `Footer.tsx`.
- Update `index.html` `<title>` and meta tags from "MCT Lite — Mortgage Control Tower Lite" to "Control Tower".
- Update `BrandingContext.tsx` defaults (`companyName`, `shortName`) to "Control Tower".

Leave inline code comments like `// MCT Lite: ...` untouched (non-user-facing).

### 2. User Management: show all users, remove Seed Demo button

In `src/pages/admin/UserManagement.tsx`:
- Remove the "Reseed Demo Data" button (line ~416–418), `handleReseedDemo`, and `seedingDemo` state.
- The list already pulls from `profiles` + `user_roles`, so invited users (created via `admin-invite-user`, which upserts profiles + inserts user_roles) already appear. Verify nothing filters them out; if any filter exists, remove it so **all** profiles show with name, email, role, status, created date. No backend change needed.

### Out of scope
- No DB schema changes.
- No changes to invite/email flow (already wired in prior step).
- No changes to seed-demo-users edge function itself (just remove the UI trigger).
