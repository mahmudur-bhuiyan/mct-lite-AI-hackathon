-- ============================================================
-- Pre-Qualification Agent Schema
-- SJ Innovation Hackathon 2026
-- ============================================================

-- Session table: one per borrower chat
CREATE TABLE IF NOT EXISTS public.prequal_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_token   TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'completed', 'abandoned')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Financial profile: extracted from conversation
CREATE TABLE IF NOT EXISTS public.prequal_profiles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          UUID NOT NULL REFERENCES public.prequal_sessions(id) ON DELETE CASCADE,
  borrower_name       TEXT,
  annual_income       NUMERIC,
  monthly_debts       NUMERIC,
  assets              NUMERIC,
  employment_type     TEXT CHECK (employment_type IN ('w2','self_employed','contractor','retired','other')),
  years_employed      NUMERIC,
  credit_tier         TEXT CHECK (credit_tier IN ('excellent','good','fair','poor')),
  is_veteran          BOOLEAN DEFAULT false,
  is_first_time_buyer BOOLEAN DEFAULT false,
  target_price        NUMERIC,
  down_payment        NUMERIC,
  front_dti           NUMERIC,
  back_dti            NUMERIC,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id)
);

-- Loan match result
CREATE TABLE IF NOT EXISTS public.prequal_loan_matches (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID NOT NULL REFERENCES public.prequal_sessions(id) ON DELETE CASCADE,
  borrower_name    TEXT,
  product_type     TEXT NOT NULL CHECK (product_type IN ('Conventional','FHA','VA','USDA')),
  prequal_amount   NUMERIC NOT NULL,
  loan_amount      NUMERIC NOT NULL,
  down_payment     NUMERIC NOT NULL,
  ltv              NUMERIC NOT NULL,
  estimated_rate   NUMERIC NOT NULL,
  monthly_payment  NUMERIC NOT NULL,
  back_dti         NUMERIC,
  credit_tier      TEXT,
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','qualified','referred','declined')),
  letter_generated BOOLEAN DEFAULT false,
  assigned_officer TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id)
);

-- Document checklist items
CREATE TABLE IF NOT EXISTS public.prequal_document_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL REFERENCES public.prequal_sessions(id) ON DELETE CASCADE,
  document_name TEXT NOT NULL,
  required      BOOLEAN DEFAULT true,
  collected     BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, document_name)
);

-- Chat message log (for history display)
CREATE TABLE IF NOT EXISTS public.prequal_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES public.prequal_sessions(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── RLS Policies ────────────────────────────────────────────

ALTER TABLE public.prequal_sessions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prequal_profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prequal_loan_matches   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prequal_document_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prequal_messages       ENABLE ROW LEVEL SECURITY;

-- Authenticated users can see all sessions (loan officers need full pipeline view)
CREATE POLICY "authenticated_read_sessions"
  ON public.prequal_sessions FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "authenticated_insert_sessions"
  ON public.prequal_sessions FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated_update_sessions"
  ON public.prequal_sessions FOR UPDATE
  TO authenticated USING (true);

CREATE POLICY "authenticated_read_profiles"
  ON public.prequal_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_insert_profiles"
  ON public.prequal_profiles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_update_profiles"
  ON public.prequal_profiles FOR UPDATE TO authenticated USING (true);

CREATE POLICY "authenticated_read_matches"
  ON public.prequal_loan_matches FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_insert_matches"
  ON public.prequal_loan_matches FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_update_matches"
  ON public.prequal_loan_matches FOR UPDATE TO authenticated USING (true);

CREATE POLICY "authenticated_read_docs"
  ON public.prequal_document_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_insert_docs"
  ON public.prequal_document_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_update_docs"
  ON public.prequal_document_items FOR UPDATE TO authenticated USING (true);

CREATE POLICY "authenticated_read_messages"
  ON public.prequal_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_insert_messages"
  ON public.prequal_messages FOR INSERT TO authenticated WITH CHECK (true);

-- ── Indexes ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_prequal_sessions_user ON public.prequal_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_prequal_profiles_session ON public.prequal_profiles(session_id);
CREATE INDEX IF NOT EXISTS idx_prequal_matches_session ON public.prequal_loan_matches(session_id);
CREATE INDEX IF NOT EXISTS idx_prequal_matches_status ON public.prequal_loan_matches(status);
CREATE INDEX IF NOT EXISTS idx_prequal_messages_session ON public.prequal_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_prequal_docs_session ON public.prequal_document_items(session_id);

-- ── Updated_at trigger ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ language 'plpgsql';

CREATE TRIGGER update_prequal_sessions_updated_at
  BEFORE UPDATE ON public.prequal_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_prequal_profiles_updated_at
  BEFORE UPDATE ON public.prequal_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
