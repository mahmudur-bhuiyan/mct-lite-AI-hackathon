## Goal

- Remove the **AI Chat** sidebar entry (the standalone `/ai` page).
- **AI Agents** page already lists only `is_enabled` admin-created agents — keep that, polish UX so a click goes straight to chat.
- Loan officers (and other non-admin users with allowed roles) can **customize** an enabled agent (override system prompt, attach their own Knowledge Base entries) without affecting other users.
- Chat history per agent stays persisted (already on `ai_chat_threads` + `ai_chat_messages`).

## Changes

### 1. Hide AI Chat in the sidebar
- In `src/components/layout/AppSidebar.tsx`, remove the `AI Chat` item from `aiToolsItems` and drop `/ai` from `loanOfficerNavAllow` / `userRoleNavAllow`.
- Keep the `/ai` route mounted in `App.tsx` so deep links don't 404, but it's no longer reachable from nav.

### 2. AI Agents browse → click goes straight to chat
- `src/pages/AgentsBrowse.tsx`:
  - Card primary CTA changes from **Learn More** → **Chat** and routes to `/agents/{agent.id}/chat`.
  - Avatar buttons in the team header also navigate to chat.
  - Add a small secondary `Details` link to keep `AgentDetail` accessible (so users can still read the user guide).
- `useRoleFilteredAgents` already filters to `is_enabled && allowed-for-role` — no change.

### 3. Per-user agent customization (LO “train it on my data”)
New table + UI so LOs adapt an agent without editing the global row.

- New migration creating `public.user_agent_customizations`:
  - `user_id uuid`, `agent_id uuid`, `system_prompt_override text`, `knowledge_entry_ids uuid[]`, `notes text`, timestamps. Unique `(user_id, agent_id)`.
  - RLS: a user can SELECT/INSERT/UPDATE/DELETE only their own row; admins manage all.
- New hook `useAgentCustomization(agentId)` (read + upsert).
- New page/dialog `Customize Agent` reachable from each agent card and from `AgentChat` header (gear icon already there). It lets the user:
  - Edit a personal system-prompt override (textarea, prefilled with the agent's base prompt).
  - Pick Knowledge Base entries from `useKnowledge()` (multi-select) to attach as scope.
  - Save / Reset to default.

### 4. Wire customization into chat
- `supabase/functions/run-ai-agent/index.ts`: before assembling the system prompt, look up `user_agent_customizations` for `(auth.uid(), agent_id)`. If present:
  - Replace base `system_prompt` with the override.
  - Add the selected `knowledge_entry_ids` to the knowledge-scope filter that the agent already uses.
- No change to provider routing or memory pipeline.

### 5. Sidebar wiring & cleanup
- Verify `loanOfficerNavAllow` still keeps `/agents`.
- No removal of `AIChat` page file (kept for `/ai` direct link), only removed from nav.

## Acceptance test

1. Sidebar: no **AI Chat** entry; **AI Agents** is still visible.
2. `/agents` shows only enabled agents allowed for the user's role.
3. Clicking an agent card → opens `/agents/{id}/chat`; messages stream and reload from history on revisit.
4. As LO: open **Customize**, edit prompt + select 2 knowledge entries, save. Next chat reply uses the override and cites attached knowledge.
5. As another user: same agent uses the original/global system prompt — customizations are not shared.

## Out of scope

- No edits to global `ai_agents` rows by non-admins.
- No changes to provider/model routing or Lovable AI Gateway fallback.
- No new admin screens — Admin → AI Agents already manages base agents.
