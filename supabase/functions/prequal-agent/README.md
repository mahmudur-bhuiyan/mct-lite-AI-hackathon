# Pre-Qualification Agent — "Alex"

Alex is a conversational mortgage **pre-qualification agent**. Borrowers chat in plain
English (no forms), and a tool-calling LLM extracts their financials, computes DTI,
matches a loan product, builds a document checklist, generates a pre-qualification
letter, and routes them to a loan officer. Everything a borrower shares streams live
into an **Eligibility Scorecard**, and completed sessions flow into a real-time **Loan
Officer (LO) Pipeline**.

The feature is split by audience:

- **Guest borrowers** (`/prequal-public`) — no login required. First/last name, email,
  and optional phone start a token-scoped session. After the letter is generated, a
  completion modal saves contact details into the **borrowers** table for LO follow-up.
- **Loan officers & staff** (`/prequal/dashboard`) — authenticated pipeline dashboard
  with stats, detail drawer (including phone), and AI briefing packet.

Signed-in users who visit `/prequal-public` are redirected to the dashboard
(`GuestOnlyRoute`). The legacy authenticated chat route `/prequal` also redirects to
`/dashboard`; Alex chat is public-only.

---

## Architecture at a glance

```
                        Browser (React)
  ┌───────────────────────────────────────────────────────────┐
  │  PublicAlexPrequal ─┐                                       │
  │  PrequalChat ───────┤  usePrequalAgent  ──► prequal-agent   │
  │  PrequalDashboard ──┴─ usePrequalPipeline / usePrequalSessions│
  │  PrequalGuestCompletionModal (post-letter borrower save)      │
  └───────────────────────────────────────────────────────────┘
                                   │  (session_token for guests; JWT unused for chat)
                                   ▼
                    Edge Function: prequal-agent (Deno)
       ┌────────────────────────────────────────────────────────┐
       │  auth resolve (guest init | guest turn | resume |       │
       │    lookup | create_borrower)                           │
       │  OpenAI chat completion + function-calling loop        │
       │  executeTool(...) ── _shared/prequal-tools.ts          │
       │  persist: messages, profile, loan match, docs, status    │
       │  fetchLoanOfficers() ── user_roles + profiles (DB)     │
       └────────────────────────────────────────────────────────┘
                                   │  (service role)
                                   ▼
     Postgres: prequal_sessions / _profiles / _loan_matches
               / _document_items / _messages  (+ borrowers link)
```

- The **LLM is the orchestrator**; the **math is deterministic**. Every dollar figure,
  DTI, product decision, and officer assignment comes from pure functions in
  [`_shared/prequal-tools.ts`](../_shared/prequal-tools.ts), not from the model. The
  model only decides *when* to call each tool and how to phrase the reply.
- Those pure functions are shared verbatim between the edge function and the frontend
  unit tests, so pipeline math is covered without an LLM in the loop.
- US phone formatting/validation is shared via
  [`_shared/phone-validation.ts`](../_shared/phone-validation.ts) (also tested from
  `src/lib/phone-validation.test.ts`).

---

## File map

### Frontend (`src/`)
| Path | Responsibility |
| --- | --- |
| `pages/PublicAlexPrequal.tsx` | Public entry point; renders `PrequalChat` in `guest` mode |
| `pages/PrequalChat.tsx` | Chat UI, guest intake (first/last name, email, phone), resume picker, streaming bubbles, Eligibility Scorecard sidebar, PDF letter export, completion modal trigger |
| `pages/PrequalDashboard.tsx` | LO pipeline table, stats cards, AI briefing packet, borrower phone in detail drawer |
| `components/auth/GuestOnlyRoute.tsx` | Redirects authenticated users away from `/prequal-public` |
| `components/prequal/PrequalGuestCompletionModal.tsx` | Post-letter modal: confirm name, email, phone, mailing address; creates/updates borrower |
| `hooks/usePrequalAgent.ts` | Core state machine: messages, streaming, guest lifecycle, resume, borrower linking, scorecard state |
| `hooks/usePrequalSessions.ts` | React Query hooks for session list, messages, and session detail hydration |
| `hooks/usePrequalPipeline.ts` | LO pipeline query + realtime subscription + stats + officer name resolution |
| `lib/prequal-pipeline.ts` | Re-exports pipeline types/helpers from `_shared/prequal-tools.ts` |
| `lib/prequal-tools.test.ts` | Vitest coverage of the deterministic tool chain |
| `lib/phone-validation.test.ts` | Vitest coverage of shared phone helpers |

### Backend (`supabase/`)
| Path | Responsibility |
| --- | --- |
| `functions/prequal-agent/index.ts` | Edge function: auth, agentic loop, guest resume, borrower create, persistence |
| `functions/_shared/prequal-tools.ts` | Deterministic tool implementations + pipeline row builders (shared with tests) |
| `functions/_shared/phone-validation.ts` | Canonical US phone format (`+1 (555) 123-4567`), input constraint, storage normalize |
| `functions/_shared/ai-utils.ts` | Shared provider routing (`chatCompletion`, `getOpenAIApiKey`, CORS) |

### Database (`supabase/migrations/`)
| Migration | Change |
| --- | --- |
| `20260626100000_prequal_agent.sql` | Base schema, RLS policies, indexes, `updated_at` triggers |
| `20260703120000_prequal_guest_sessions.sql` | `guest_name` / `guest_email` on sessions; `borrower_email` on profiles & matches |
| `20260703153000_backfill_prequal_loan_matches.sql` | Backfill pipeline rows for sessions with a profile but no match |
| `20260703160000_prequal_session_title.sql` | `title` column + backfill from first user message |
| `20260703161000_prequal_session_title_20.sql` | Cap existing titles at 20 chars |
| `20260705120000_prequal_guest_phone.sql` | `guest_phone` on sessions; `borrower_phone` on profiles |
| `20260705190000_prequal_session_borrower_id.sql` | `borrower_id` FK on sessions (links to `borrowers` after completion modal) |
| `20260706100000_abandon_duplicate_guest_prequal_sessions.sql` | One-time cleanup: abandon intake-only duplicate guest sessions when email already has a qualified session |
| `20260706120000_backfill_completed_prequal_sessions.sql` | Mark letter-complete sessions `completed` and backfill missing `prequal_loan_matches` rows |
| `20260706130000_prequal_profile_address.sql` | `street_address`, `postal_code`, `letter_ready` on profiles |
| `20260706140000_prequal_match_borrower_phone.sql` | `borrower_phone` on `prequal_loan_matches`; backfill from profile/session |

---

## Routes

| Route | Guard | Component |
| --- | --- | --- |
| `/prequal-public` | Public, guest-only (`GuestOnlyRoute`) | `PublicAlexPrequal` (guest chat) |
| `/prequal-public/calculator` | Public | `PublicPrequalCalculator` |
| `/prequal/dashboard` | Authenticated | `PrequalDashboard` (LO pipeline) |
| `/prequal` | Authenticated | Redirects to `/dashboard` |

---

## Data model

All prequal tables live in `public` and are keyed off `prequal_sessions.id`.

- **`prequal_sessions`** — one row per chat. Holds `user_id` (nullable for guests),
  `session_token` (guest auth), `status` (`active` / `completed` / `abandoned`),
  `guest_name` / `guest_email` / `guest_phone`, `borrower_id` (set after completion
  modal), and a short `title`.
- **`prequal_profiles`** — extracted financials (income, debts, credit tier,
  employment, target price, down payment, computed `front_dti` / `back_dti`, contact
  phone, mailing address, `letter_ready`). One row per session (`UNIQUE(session_id)`,
  upserted).
- **`prequal_loan_matches`** — the matched product and numbers that feed the LO
  pipeline (`product_type`, `prequal_amount`, `ltv`, `estimated_rate`,
  `monthly_payment`, `borrower_phone`, `status`, `letter_generated`, `assigned_officer`).
- **`prequal_document_items`** — per-session document checklist (`document_name`,
  `required`, `collected`).
- **`prequal_messages`** — append-only chat transcript (`role`, `content`). The
  client-only greeting is **not** persisted.
- **`borrowers`** — created or updated when a guest submits the completion modal
  (`data_source = 'prequal'`, `api_payload` stores session/officer context). Returning
  guests with the same email auto-link to an existing borrower record.

---

## Edge function API

`POST /functions/v1/prequal-agent`

### Standalone operations (no chat turn)

These run before JWT/guest-turn auth and do not invoke the LLM:

| Body key | Purpose |
| --- | --- |
| `create_borrower` | Guest submits completion modal — creates or updates `borrowers`, links `prequal_sessions.borrower_id`. Requires valid `session_id` + `session_token` and a completed pre-qual (letter + assigned officer). |
| `lookup_guest_sessions` | `{ email }` — list prior guest sessions for welcome-back UI (capped by `limitGuestResumeSessions`: up to 2 active + 1 completed). |
| `resume_guest` | `{ session_id, session_token, resume_guest: true }` — restore session from `localStorage` on page load. |
| `resume_guest_by_email` | `{ email, session_id }` — resume a chosen prior session (email must match). Abandons other intake-only sessions for the same email. |

### Chat auth (priority order)

1. **Guest init** — `{ "init_guest": { "name", "email", "phone?" } }` → creates a
   session, returns `session_token`, seeds profile contact fields, and may return
   `borrower_id` / `borrower_profile` if the email already has a linked borrower. No
   LLM message is generated on this call (`initialized: true`, `message: null`).
2. **Guest turn** — `{ "session_id", "session_token", ... }` → token verified against
   stored session (`user_id IS NULL`).
3. **Authenticated** — `Authorization: Bearer <supabase_jwt>` is still validated when
   present, but the product route no longer exposes an authenticated Alex chat UI.

Everything else returns `401 Unauthorized`.

Phone numbers on init and `create_borrower` must pass shared US validation (11 digits,
leading country code `1`, stored as `+1 (555) 123-4567`).

### Chat request body

```jsonc
{
  "messages": [{ "role": "user", "content": "..." }],
  "session_id": "uuid | null",
  "session_token": "string",       // guest only
  "profile": { /* current scorecard profile */ },
  "user_message": "latest user text",
  "init_guest": { "name": "...", "email": "...", "phone": "..." }, // guest bootstrap only
  "contact": { "name": "...", "email": "..." }  // authenticated turn (legacy)
}
```

### Chat response body

```jsonc
{
  "message": "assistant reply text",
  "session_id": "uuid",
  "session_token": "string | undefined",
  "profile": { /* updated scorecard profile */ },
  "letter_data": { "borrower_name", "prequal_amount", "loan_product", "purchase_price" } | null,
  "document_gaps": ["W-2 forms (last 2 years)", ...],
  "loan_match": { "product_type", "prequal_amount", "loan_amount", "ltv", "estimated_rate", "monthly_payment" } | null,
  "assigned_officer": "Sarah Mitchell" | undefined,
  "assigned_officer_profile": { "name", "email", "title", ... } | undefined,
  "borrower_id": "uuid | undefined",
  "borrower_profile": { "first_name", "last_name", "email", "phone", ... } | undefined
}
```

`create_borrower` response:

```jsonc
{ "success": true, "borrower_id": "uuid", "created": true }
// or
{ "success": true, "borrower_id": "uuid", "updated": true }
```

Errors return `{ "error": "<user-facing message>" }`. Provider errors are sanitized by
`formatUserFacingAiError` before reaching the borrower (no raw API URLs or stack noise).

---

## Agent tools

The model runs an agentic loop (`MAX_LOOPS = 10`) with OpenAI function calling
(`gpt-4o-mini`, `tool_choice: "auto"`). Each tool maps to a pure function in
`_shared/prequal-tools.ts`:

| Tool | When the model calls it | Deterministic output |
| --- | --- | --- |
| `extract_financials` | Any profile detail is mentioned | Merges stated fields into the profile (never invents values); includes phone and mailing address when provided |
| `calculate_dti` | Income + debts + price + down payment known | Front/back DTI via 30-yr amortization, status band |
| `match_loan_products` | Credit tier + price + down + income known | Product (Conventional/FHA/VA/USDA), rate, payment, max pre-qual amount |
| `check_document_gaps` | After a product is matched | Checklist tailored to employment type + product |
| `generate_prequal_letter` | Full legal name confirmed + all data collected | Letter payload (PDF rendered client-side with jsPDF); sets `letter_ready` |
| `route_to_officer` | Immediately after the letter | Assigns an officer from the live DB roster (`user_roles.role = 'loan_officer'`) |

Key business rules encoded in the tools:

- **Product selection** — veterans → VA; `fair`/`poor` credit or `< 10%` down → FHA;
  otherwise Conventional (rate adjusted by credit tier).
- **Max pre-qual** — capped so back-end DTI stays `≤ 43%` (Fannie Mae ceiling), and
  never exceeds the borrower's target price.
- **Officer routing** — random pick from active loan officers in the database (via
  `fetchLoanOfficers`); full card details resolved by `getOfficerProfile`.
- **No hallucinated money** — the system prompt forbids assuming defaults (e.g. "20%
  down"); only explicitly stated values are extracted.
- **Pipeline repair** — if a session completes with a letter but no `prequal_loan_matches`
  row, the edge function backfills the pipeline row and marks the session `completed`.

---

## Frontend behavior notes

- **Word-by-word streaming** — the edge function returns the full reply; the client
  reveals it token-by-token (`streamWords`, ~28ms/word) for a ChatGPT-style feel while
  the scorecard updates instantly.
- **Live scorecard** — profile, DTI bars, loan match, document gaps, letter, and
  officer card all render from live agent state, then hydrate from the DB when an old
  session is reopened.
- **Guest intake** — first name, last name, email, optional US phone; phone validated
  client-side and again server-side on init.
- **Guest persistence** — guest sessions are cached in `localStorage`
  (`mct_prequal_guest_session`) so a refresh resumes via `resume_guest`.
- **Welcome back** — if the email already has prior sessions, the intake form offers
  resume vs. start new (`lookup_guest_sessions` → `resume_guest_by_email`).
- **Duplicate session cleanup** — resuming or starting a session abandons other
  intake-only active sessions for the same email (no user messages, no loan match).
- **Post-letter completion** — when chat reaches letter + officer assignment, guests
  without a linked borrower see `PrequalGuestCompletionModal` to confirm contact info
  and mailing address; submit calls `create_borrower`. Returning borrowers can update
  their profile (`mode: "update"`).
- **Borrower auto-link** — on init/resume, the edge function links `borrower_id` when
  the guest email matches an existing prequal borrower or prior session.
- **Pipeline realtime** — `usePrequalPipeline` subscribes to `postgres_changes` on the
  session/profile/match tables and also polls every 30s. Phone displays in the detail
  drawer via `formatPhoneDisplay`.
- **PDF letter** — generated entirely client-side in `PrequalChat.downloadLetter` via
  `jsPDF` (branded MCT Mortgage letter, 90-day validity).

---

## Security & RLS

- RLS is enabled on all five prequal tables. Authenticated policies allow reads/writes so loan
  officers can see the full pipeline (borrower data is intentionally shared across the
  LO team, per the pipeline requirement).
- **Guests never touch the DB directly.** All guest writes go through the edge function
  using the **service role**, gated by `session_token` verification — the anon client
  has no guest policies.
- `create_borrower` requires a valid guest session token and a completed pre-qual
  (letter + officer) before inserting into `borrowers`.
- Borrower PII (email, name, phone) is never logged; only sanitized error strings are surfaced.
- Secrets: the function reads `OPENAI_API_KEY` via shared `getOpenAIApiKey()` (settings
  table → env fallback). Nothing sensitive is committed.

---

## Local development

```bash
# Frontend
npm run dev

# Run the deterministic tool tests (no LLM required)
npm run test -- prequal-tools

# Phone validation tests
npm run test -- phone-validation

# Serve the edge function locally
npx supabase functions serve prequal-agent

# Apply migrations
npx supabase db push
```

### Deploy

```bash
npx supabase functions deploy prequal-agent
```

Required edge-function secret: `OPENAI_API_KEY` (plus the standard `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`).

Loan officers must exist in `user_roles` with role `loan_officer` and a `profiles` row
for Alex to assign and display them.

---

## Testing

`src/lib/prequal-tools.test.ts` exercises the full deterministic chain against
`_shared/prequal-tools.ts`:

- End-to-end scenario: extract → DTI → match → docs → letter → pipeline row.
- Veteran routing → VA product + VA-specific documents.
- FHA selection for low down payment; high-DTI flagging.
- Pipeline stat aggregation across mixed statuses.
- `resolveLoanMatchForPersist` fallbacks (letter-only turns, carried match fields).
- Session-title formatting and financial extraction edge cases.
- `limitGuestResumeSessions` caps (2 active + 1 completed).
- `letter_ready` / `normalizePipelineStatus` promotion to qualified.

`src/lib/phone-validation.test.ts` covers canonical formatting, 11-digit validation, and
legacy 10-digit display normalization.

Because the pipeline math lives in shared pure functions, these tests protect the
numbers borrowers see without needing to mock the model.
