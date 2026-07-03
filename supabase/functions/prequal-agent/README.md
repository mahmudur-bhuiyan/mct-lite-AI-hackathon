# Pre-Qualification Agent — "Alex"

Alex is a conversational mortgage **pre-qualification agent**. Borrowers chat in plain
English (no forms), and a tool-calling LLM extracts their financials, computes DTI,
matches a loan product, builds a document checklist, generates a pre-qualification
letter, and routes them to a loan officer. Everything a borrower shares streams live
into an **Eligibility Scorecard**, and completed sessions flow into a real-time **Loan
Officer (LO) Pipeline**.

The feature works in two modes:

- **Guest** (`/prequal-public`) — no login required; a lightweight name/email intake
  starts a token-scoped session.
- **Authenticated** (`/prequal`) — signed-in borrowers/officers get chat history,
  session restore, and the pipeline dashboard.

---

## Architecture at a glance

```
                        Browser (React)
  ┌───────────────────────────────────────────────────────────┐
  │  PublicAlexPrequal ─┐                                       │
  │  PrequalChat ───────┤  usePrequalAgent  ──► supabase.functions.invoke("prequal-agent")
  │  PrequalDashboard ──┴─ usePrequalPipeline / usePrequalSessions
  └───────────────────────────────────────────────────────────┘
                                   │  (JWT for users, session_token for guests)
                                   ▼
                    Edge Function: prequal-agent (Deno)
       ┌────────────────────────────────────────────────────────┐
       │  auth resolve (user | guest | init_guest)                │
       │  OpenAI chat completion + function-calling loop          │
       │  executeTool(...) ── _shared/prequal-tools.ts (pure fns) │
       │  persist: messages, profile, loan match, docs, status    │
       └────────────────────────────────────────────────────────┘
                                   │  (service role)
                                   ▼
     Postgres: prequal_sessions / _profiles / _loan_matches
               / _document_items / _messages  (RLS on)
```

- The **LLM is the orchestrator**; the **math is deterministic**. Every dollar figure,
  DTI, product decision, and officer assignment comes from pure functions in
  [`_shared/prequal-tools.ts`](../_shared/prequal-tools.ts), not from the model. The
  model only decides *when* to call each tool and how to phrase the reply.
- Those pure functions are shared verbatim between the edge function and the frontend
  unit tests, so pipeline math is covered without an LLM in the loop.

---

## File map

### Frontend (`src/`)
| Path | Responsibility |
| --- | --- |
| `pages/PublicAlexPrequal.tsx` | Public entry point; renders `PrequalChat` in `guest` mode |
| `pages/PrequalChat.tsx` | Chat UI, streaming bubbles, intake form, Eligibility Scorecard sidebar, PDF letter export |
| `pages/PrequalDashboard.tsx` | LO pipeline table, stats cards, AI briefing packet |
| `hooks/usePrequalAgent.ts` | Core state machine: messages, streaming, sessions, guest lifecycle, scorecard state |
| `hooks/usePrequalSessions.ts` | React Query hooks for session list, messages, and session detail hydration |
| `hooks/usePrequalPipeline.ts` | LO pipeline query + realtime subscription + stats |
| `lib/prequal-pipeline.ts` | Pipeline row/stats types and helpers (`dtiColorClass`, `computePipelineStats`) |
| `lib/prequal-tools.test.ts` | Vitest coverage of the deterministic tool chain |

### Backend (`supabase/`)
| Path | Responsibility |
| --- | --- |
| `functions/prequal-agent/index.ts` | Edge function: auth, agentic loop, persistence |
| `functions/_shared/prequal-tools.ts` | Deterministic tool implementations + officer roster (shared with tests) |
| `functions/_shared/ai-utils.ts` | Shared provider routing (`chatCompletion`, `getOpenAIApiKey`, CORS) |

### Database (`supabase/migrations/`)
| Migration | Change |
| --- | --- |
| `20260626100000_prequal_agent.sql` | Base schema, RLS policies, indexes, `updated_at` triggers |
| `20260703120000_prequal_guest_sessions.sql` | `guest_name` / `guest_email` on sessions; `borrower_email` on profiles & matches |
| `20260703153000_backfill_prequal_loan_matches.sql` | Backfill pipeline rows for sessions with a profile but no match |
| `20260703160000_prequal_session_title.sql` | `title` column + backfill from first user message |
| `20260703161000_prequal_session_title_20.sql` | Cap existing titles at 20 chars |

---

## Routes

| Route | Guard | Component |
| --- | --- | --- |
| `/prequal-public` | Public | `PublicAlexPrequal` (guest chat) |
| `/prequal` | Authenticated | `PrequalChat` (with history sidebar) |
| `/prequal/dashboard` | Authenticated | `PrequalDashboard` (LO pipeline) |
| `/prequal?new=1` | Authenticated | Opens a blank draft session |

---

## Data model

All tables live in `public` and are keyed off `prequal_sessions.id`.

- **`prequal_sessions`** — one row per chat. Holds `user_id` (nullable for guests),
  `session_token` (guest auth), `status` (`active` / `completed` / `abandoned`),
  `guest_name` / `guest_email`, and a short `title`.
- **`prequal_profiles`** — extracted financials (income, debts, credit tier,
  employment, target price, down payment, computed `front_dti` / `back_dti`). One row
  per session (`UNIQUE(session_id)`, upserted).
- **`prequal_loan_matches`** — the matched product and numbers that feed the LO
  pipeline (`product_type`, `prequal_amount`, `ltv`, `estimated_rate`,
  `monthly_payment`, `status`, `letter_generated`, `assigned_officer`).
- **`prequal_document_items`** — per-session document checklist (`document_name`,
  `required`, `collected`).
- **`prequal_messages`** — append-only chat transcript (`role`, `content`). The
  client-only greeting is **not** persisted.

---

## Edge function API

`POST /functions/v1/prequal-agent`

Auth is resolved in priority order:

1. **Authenticated** — `Authorization: Bearer <supabase_jwt>` → validated via the
   anon client (`auth.getUser`), then business logic runs.
2. **Guest init** — `{ "init_guest": { "name", "email" } }` → creates a session,
   returns a `session_token`, and stores the borrower's contact. No message is
   generated on this call.
3. **Guest turn** — `{ "session_id", "session_token", ... }` → the token is verified
   against the stored session (must be a guest session, `user_id IS NULL`).

Everything else (`401 Unauthorized`) is rejected.

### Request body

```jsonc
{
  "messages": [{ "role": "user", "content": "..." }],  // conversation so far
  "session_id": "uuid | null",
  "session_token": "string",       // guest only
  "profile": { /* current scorecard profile */ },
  "user_message": "latest user text",
  "contact": { "name": "...", "email": "..." },  // authenticated only
  "init_guest": { "name": "...", "email": "..." } // guest bootstrap only
}
```

### Response body

```jsonc
{
  "message": "assistant reply text",
  "session_id": "uuid",
  "session_token": "string | undefined",
  "profile": { /* updated scorecard profile */ },
  "letter_data": { "borrower_name", "prequal_amount", "loan_product", "purchase_price" } | null,
  "document_gaps": ["W-2 forms (last 2 years)", ...],
  "loan_match": { "product_type", "prequal_amount", "loan_amount", "ltv", "estimated_rate", "monthly_payment" } | null,
  "assigned_officer": "Sarah Mitchell" | undefined
}
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
| `extract_financials` | Any profile detail is mentioned | Merges stated fields into the profile (never invents values) |
| `calculate_dti` | Income + debts + price + down payment known | Front/back DTI via 30-yr amortization, status band |
| `match_loan_products` | Credit tier + price + down + income known | Product (Conventional/FHA/VA/USDA), rate, payment, max pre-qual amount |
| `check_document_gaps` | After a product is matched | Checklist tailored to employment type + product |
| `generate_prequal_letter` | Full legal name confirmed + all data collected | Letter payload (PDF rendered client-side with jsPDF) |
| `route_to_officer` | Immediately after the letter | Assigns an officer from the product roster |

Key business rules encoded in the tools:

- **Product selection** — veterans → VA; `fair`/`poor` credit or `< 10%` down → FHA;
  otherwise Conventional (rate adjusted by credit tier).
- **Max pre-qual** — capped so back-end DTI stays `≤ 43%` (Fannie Mae ceiling), and
  never exceeds the borrower's target price.
- **Officer routing** — round-robin within a product-specific roster
  (`OFFICERS_BY_PRODUCT`); full details resolved by `getOfficerProfile` for the UI card.
- **No hallucinated money** — the system prompt forbids assuming defaults (e.g. "20%
  down"); only explicitly stated values are extracted.

---

## Frontend behavior notes

- **Word-by-word streaming** — the edge function returns the full reply; the client
  reveals it token-by-token (`streamWords`, ~28ms/word) for a ChatGPT-style feel while
  the scorecard updates instantly.
- **Live scorecard** — profile, DTI bars, loan match, document gaps, letter, and
  officer card all render from live agent state, then hydrate from the DB when an old
  session is reopened (`usePrequalSessionDetails`).
- **Guest persistence** — guest sessions are cached in `localStorage`
  (`mct_prequal_guest_session`) so a refresh resumes the same chat.
- **History** — `usePrequalSessions` only lists sessions that have a real user reply
  (greeting-only drafts stay hidden); `?new=1` forces a fresh draft.
- **Pipeline realtime** — `usePrequalPipeline` subscribes to `postgres_changes` on the
  session/profile/match tables and also polls every 30s.
- **PDF letter** — generated entirely client-side in `PrequalChat.downloadLetter` via
  `jsPDF` (branded MCT Mortgage letter, 90-day validity).

---

## Security & RLS

- RLS is enabled on all five tables. Authenticated policies allow reads/writes so loan
  officers can see the full pipeline (borrower data is intentionally shared across the
  LO team, per the pipeline requirement).
- **Guests never touch the DB directly.** All guest writes go through the edge function
  using the **service role**, gated by `session_token` verification — the anon client
  has no guest policies.
- The JWT is validated (`auth.getUser`) **before** any business logic in authenticated
  mode, per repo edge-function conventions.
- Borrower PII (email, name) is never logged; only sanitized error strings are surfaced.
- Secrets: the function reads `OPENAI_API_KEY` via shared `getOpenAIApiKey()` (settings
  table → env fallback). Nothing sensitive is committed.

---

## Local development

```bash
# Frontend
npm run dev

# Run the deterministic tool tests (no LLM required)
npm run test -- prequal-tools

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

Because the pipeline math lives in shared pure functions, these tests protect the
numbers borrowers see without needing to mock the model.
