/**
 * prequal-agent — Mortgage Pre-Qualification Agent
 * Uses OpenAI with function calling (agentic loop)
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  getOpenAIApiKey,
  chatCompletion,
  type ChatMessage,
  type ToolDefinition,
} from "../_shared/ai-utils.ts";
import {
  pickProfileFields,
  executeTool,
  buildPipelineMatchRow,
  resolveLoanMatchForPersist,
  formatSessionTitle,
  getOfficerProfile,
  limitGuestResumeSessions,
  normalizeLoanProduct,
  profileToOfficer,
  splitBorrowerName,
  mergeBorrowerSnapshotIntoProfile,
  coerceNumber,
  inferLetterFromAssistantMessage,
  inferOfficerFromAssistantMessage,
  type LetterData,
  type LoanMatch,
  type OfficerProfile,
  type PrequalProfile,
} from "../_shared/prequal-tools.ts";

const TOOLS = [
  {
    name: "extract_financials",
    description:
      "Extract and store profile fields the borrower explicitly stated. Call IMMEDIATELY when ANY of these are mentioned: name, email, street address, city, state, postal code, income, debts, assets, credit, employment, purchase price, down payment, veteran status, or first-time buyer status. Only include fields the borrower actually said — never invent defaults (e.g. do not assume 20% down).",
    input_schema: {
      type: "object",
      properties: {
        borrower_name: { type: "string", description: "Borrower's full legal name as stated or confirmed" },
        borrower_email: { type: "string", description: "Borrower's email address as stated" },
        street_address: { type: "string", description: "Current mailing street address as stated" },
        city: { type: "string", description: "City where the borrower lives or plans to buy" },
        state: { type: "string", description: "US state abbreviation (e.g. TX, CA)" },
        postal_code: { type: "string", description: "ZIP or postal code as stated" },
        annual_income: { type: "number", description: "Annual gross income in USD" },
        monthly_debts: { type: "number", description: "Total monthly debt payments" },
        assets: { type: "number", description: "Total liquid assets in USD" },
        employment_type: { type: "string", enum: ["w2", "self_employed", "contractor", "retired", "other"] },
        years_employed: { type: "number", description: "Years at current employer" },
        credit_tier: {
          type: "string",
          enum: ["excellent", "good", "fair", "poor"],
          description: "excellent=760+, good=700-759, fair=640-699, poor=below 640",
        },
        is_veteran: { type: "boolean" },
        is_first_time_buyer: { type: "boolean" },
        target_price: { type: "number", description: "Target home purchase price in USD" },
        down_payment: { type: "number", description: "Down payment amount in USD" },
      },
      required: [],
    },
  },
  {
    name: "calculate_dti",
    description:
      "Calculate Debt-to-Income ratio. Call when you have: annual_income + monthly_debts + target_price.",
    input_schema: {
      type: "object",
      properties: {
        annual_income: { type: "number" },
        monthly_debts: { type: "number" },
        target_price: { type: "number" },
        down_payment: { type: "number" },
        estimated_rate: { type: "number", description: "Estimated interest rate (use 7.0 if unknown)" },
      },
      required: ["annual_income", "monthly_debts", "target_price", "down_payment"],
    },
  },
  {
    name: "match_loan_products",
    description:
      "Match the borrower to the best loan product. Call when you have: target_price, down_payment, annual_income, credit_tier.",
    input_schema: {
      type: "object",
      properties: {
        target_price: { type: "number" },
        down_payment: { type: "number" },
        annual_income: { type: "number" },
        credit_tier: { type: "string", enum: ["excellent", "good", "fair", "poor"] },
        is_veteran: { type: "boolean" },
        monthly_debts: { type: "number" },
      },
      required: ["target_price", "down_payment", "annual_income", "credit_tier"],
    },
  },
  {
    name: "check_document_gaps",
    description:
      "Generate a document checklist based on employment type and loan product. Call after loan product is matched.",
    input_schema: {
      type: "object",
      properties: {
        employment_type: { type: "string", enum: ["w2", "self_employed", "contractor", "retired", "other"] },
        loan_product: { type: "string", enum: ["Conventional", "FHA", "VA", "USDA"] },
        is_veteran: { type: "boolean" },
      },
      required: ["employment_type", "loan_product"],
    },
  },
  {
    name: "generate_prequal_letter",
    description:
      "Generate the pre-qualification letter. Call ONLY after: borrower_name confirmed, mailing address collected, loan product matched, all key data collected.",
    input_schema: {
      type: "object",
      properties: {
        borrower_name: { type: "string" },
        prequal_amount: { type: "number" },
        loan_product: { type: "string" },
        purchase_price: { type: "number" },
      },
      required: ["borrower_name", "prequal_amount", "loan_product", "purchase_price"],
    },
  },
  {
    name: "route_to_officer",
    description:
      "Assign a loan officer to the borrower. Call immediately after generate_prequal_letter. After assignment, tell the borrower their loan officer will get back to them — never ask them to reach out to the officer.",
    input_schema: {
      type: "object",
      properties: {
        loan_product: { type: "string" },
        credit_tier: { type: "string" },
      },
      required: ["loan_product"],
    },
  },
];

const OPENAI_MODEL = "gpt-4o-mini";

const OPENAI_TOOLS: ToolDefinition[] = TOOLS.map((tool) => ({
  type: "function",
  function: {
    name: tool.name,
    description: tool.description,
    parameters: tool.input_schema,
  },
}));

function formatUserFacingAiError(raw: string, fallback = "Something went wrong. Please try again."): string {
  let msg = raw.trim();
  if (!msg) return fallback;

  msg = msg.replace(/^Error:\s*/i, "");
  msg = msg.replace(/^(?:Gemini|OpenAI|Anthropic|Google|Lovable AI)\s+API error\s*\(\d+\):\s*/i, "");

  const forMoreIdx = msg.indexOf("For more information");
  if (forMoreIdx > 0) msg = msg.slice(0, forMoreIdx).trim();

  const urlIdx = msg.search(/https?:\/\//);
  if (urlIdx > 0) msg = msg.slice(0, urlIdx).trim();

  msg = msg
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("*") && !/^Please retry in/i.test(line))
    .join(" ")
    .trim();

  msg = msg.replace(/\s+/g, " ").replace(/[.\s]+$/, "").trim();
  if (msg && !/[.!?]$/.test(msg)) msg += ".";

  if (msg.length > 220) {
    const sentence = msg.match(/^[^.!?]+[.!?]/);
    if (sentence) msg = sentence[0];
  }

  return msg || fallback;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

import {
  isValidPhoneNumber,
  normalizePhoneForStorage,
} from "../_shared/phone-validation.ts";

function isValidPhone(phone: string): boolean {
  return isValidPhoneNumber(phone);
}

function coerceStoredPhone(raw: string): string | undefined {
  return normalizePhoneForStorage(raw) ?? undefined;
}

async function fetchLoanOfficers(
  supabase: ReturnType<typeof createClient>,
): Promise<OfficerProfile[]> {
  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "loan_officer");
  if (error || !roles?.length) return [];

  const ids = roles.map((r) => r.user_id as string);
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", ids);
  if (profileError || !profiles?.length) return [];

  return profiles.map((row) =>
    profileToOfficer(row as { id: string; full_name: string | null; email: string | null }),
  );
}

async function repairMissingPipelineMatch(
  supabase: ReturnType<typeof createClient>,
  sessionId: string,
  sessionStatus: string,
  profile: PrequalProfile,
  letterData: LetterData | null,
  loanMatch: LoanMatch | null,
  assignedOfficer: string | null,
): Promise<void> {
  const { data: existing } = await supabase
    .from("prequal_loan_matches")
    .select("id")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (existing) return;

  const matchToPersist = resolveLoanMatchForPersist(loanMatch, profile, letterData);
  if (!matchToPersist) return;

  const pipelineRow = buildPipelineMatchRow(
    sessionId,
    profile,
    matchToPersist,
    letterData,
    assignedOfficer,
  );
  const { error } = await supabase.from("prequal_loan_matches").upsert(
    {
      ...pipelineRow,
      down_payment: matchToPersist.down_payment,
      ltv: matchToPersist.ltv,
    },
    { onConflict: "session_id" },
  );
  if (error) {
    console.error("Pipeline match repair error:", error.message);
    return;
  }
  if (letterData && sessionStatus !== "completed") {
    await supabase.from("prequal_sessions").update({ status: "completed" }).eq("id", sessionId);
  }
}

async function loadSessionPersistSeed(
  supabase: ReturnType<typeof createClient>,
  sessionId: string,
): Promise<{
  profile: PrequalProfile;
  loanMatch: LoanMatch | null;
  letterData: LetterData | null;
  assignedOfficer: string | null;
  sessionStatus: string;
}> {
  const [sessionRes, profileRes, matchRes] = await Promise.all([
    supabase.from("prequal_sessions").select("status").eq("id", sessionId).maybeSingle(),
    supabase.from("prequal_profiles").select("*").eq("session_id", sessionId).maybeSingle(),
    supabase.from("prequal_loan_matches").select("*").eq("session_id", sessionId).maybeSingle(),
  ]);

  const profile = pickProfileFields((profileRes.data as Record<string, unknown> | null) ?? {}) as PrequalProfile;
  const matchRow = matchRes.data as Record<string, unknown> | null;
  const sessionStatus = (sessionRes.data?.status as string | undefined) ?? "active";

  const assignedOfficer =
    (matchRow?.assigned_officer as string | undefined) ??
    (profile.assigned_officer as string | undefined) ??
    null;

  const loanMatch = matchRow
    ? ({
        product_type: matchRow.product_type,
        prequal_amount: coerceNumber(matchRow.prequal_amount) ?? 0,
        loan_amount: coerceNumber(matchRow.loan_amount) ?? 0,
        down_payment: coerceNumber(matchRow.down_payment) ?? 0,
        ltv: coerceNumber(matchRow.ltv) ?? 0,
        estimated_rate: coerceNumber(matchRow.estimated_rate) ?? 0,
        monthly_payment: coerceNumber(matchRow.monthly_payment) ?? 0,
      } satisfies LoanMatch)
    : null;

  let letterData: LetterData | null = null;
  const sessionCompleted = sessionStatus === "completed";
  const hasQualifyingMatch =
    !!matchRow?.letter_generated ||
    (sessionCompleted && matchRow?.prequal_amount != null);
  if (hasQualifyingMatch && matchRow) {
    letterData = {
      borrower_name:
        (matchRow.borrower_name as string | undefined) ??
        profile.borrower_name ??
        "Borrower",
      prequal_amount: coerceNumber(matchRow.prequal_amount) ?? 0,
      loan_product: String(matchRow.product_type ?? "Conventional"),
      purchase_price: profile.target_price ?? coerceNumber(matchRow.prequal_amount) ?? 0,
    };
  }

  return { profile, loanMatch, letterData, assignedOfficer, sessionStatus };
}

async function loadGuestSessionState(
  supabase: ReturnType<typeof createClient>,
  sessionId: string,
  sessionToken: string,
) {
  const { data: session, error: sessionError } = await supabase
    .from("prequal_sessions")
    .select("id, session_token, guest_name, guest_email, guest_phone, user_id, borrower_id, status")
    .eq("id", sessionId)
    .single();
  if (sessionError || !session || session.session_token !== sessionToken || session.user_id) {
    return { error: "Invalid guest session" as const };
  }

  const [messagesRes, profileRes, matchRes, docsRes] = await Promise.all([
    supabase
      .from("prequal_messages")
      .select("role, content")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true }),
    supabase.from("prequal_profiles").select("*").eq("session_id", sessionId).maybeSingle(),
    supabase.from("prequal_loan_matches").select("*").eq("session_id", sessionId).maybeSingle(),
    supabase
      .from("prequal_document_items")
      .select("document_name, collected")
      .eq("session_id", sessionId),
  ]);

  if (messagesRes.error) throw messagesRes.error;
  if (profileRes.error) throw profileRes.error;
  if (matchRes.error) throw matchRes.error;
  if (docsRes.error) throw docsRes.error;

  const profile = pickProfileFields((profileRes.data as Record<string, unknown> | null) ?? {}) as PrequalProfile;
  const matchRow = matchRes.data as Record<string, unknown> | null;
  const docs = (docsRes.data ?? []) as Array<{ document_name: string; collected: boolean }>;
  const messages = (messagesRes.data ?? []).filter(
    (m) => m.role === "user" || m.role === "assistant",
  );

  let assignedOfficer =
    (matchRow?.assigned_officer as string | undefined) ??
    (profile.assigned_officer as string | undefined) ??
    undefined;

  const loanOfficers = await fetchLoanOfficers(supabase);
  let assignedOfficerProfile = getOfficerProfile(assignedOfficer, loanOfficers);

  let letterData: LetterData | null = null;
  const sessionCompleted = session.status === "completed";
  let hasQualifyingMatch =
    !!matchRow?.letter_generated ||
    (sessionCompleted && matchRow?.prequal_amount != null);
  if (hasQualifyingMatch && matchRow) {
    letterData = {
      borrower_name:
        (matchRow.borrower_name as string | undefined) ??
        profile.borrower_name ??
        "Borrower",
      prequal_amount: coerceNumber(matchRow.prequal_amount) ?? 0,
      loan_product: String(matchRow.product_type ?? "Conventional"),
      purchase_price: profile.target_price ?? coerceNumber(matchRow.prequal_amount) ?? 0,
    };
  }

  let loanMatch: LoanMatch | null = matchRow
    ? {
        product_type: String(matchRow.product_type),
        prequal_amount: coerceNumber(matchRow.prequal_amount) ?? 0,
        loan_amount: coerceNumber(matchRow.loan_amount) ?? 0,
        down_payment: coerceNumber(matchRow.down_payment) ?? 0,
        ltv: coerceNumber(matchRow.ltv) ?? 0,
        estimated_rate: coerceNumber(matchRow.estimated_rate) ?? 0,
        monthly_payment: coerceNumber(matchRow.monthly_payment) ?? 0,
      }
    : null;

  if (!matchRow) {
    if (!letterData) {
      const inferred = inferLetterFromAssistantMessage(messages, profile);
      if (inferred) {
        letterData = inferred;
        profile.target_price = profile.target_price ?? inferred.purchase_price;
        if (inferred.purchase_price > inferred.prequal_amount) {
          profile.down_payment =
            profile.down_payment ?? inferred.purchase_price - inferred.prequal_amount;
        }
      }
    }
    if (!assignedOfficer) {
      assignedOfficer = inferOfficerFromAssistantMessage(messages) ?? undefined;
      if (assignedOfficer) {
        assignedOfficerProfile = getOfficerProfile(assignedOfficer, loanOfficers);
      }
    }
    if (letterData && (profile.target_price || profile.down_payment)) {
      await supabase.from("prequal_profiles").upsert(
        {
          session_id: sessionId,
          ...pickProfileFields(profile as Record<string, unknown>),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "session_id" },
      );
    }
    await repairMissingPipelineMatch(
      supabase,
      sessionId,
      session.status as string,
      profile,
      letterData,
      loanMatch,
      assignedOfficer ?? null,
    );
    const { data: repairedMatch } = await supabase
      .from("prequal_loan_matches")
      .select("*")
      .eq("session_id", sessionId)
      .maybeSingle();
    if (repairedMatch) {
      const row = repairedMatch as Record<string, unknown>;
      loanMatch = {
        product_type: String(row.product_type),
        prequal_amount: coerceNumber(row.prequal_amount) ?? 0,
        loan_amount: coerceNumber(row.loan_amount) ?? 0,
        down_payment: coerceNumber(row.down_payment) ?? 0,
        ltv: coerceNumber(row.ltv) ?? 0,
        estimated_rate: coerceNumber(row.estimated_rate) ?? 0,
        monthly_payment: coerceNumber(row.monthly_payment) ?? 0,
      };
      assignedOfficer = (row.assigned_officer as string | undefined) ?? assignedOfficer;
      assignedOfficerProfile = getOfficerProfile(assignedOfficer, loanOfficers);
      hasQualifyingMatch = !!row.letter_generated || sessionCompleted;
      if (hasQualifyingMatch) {
        letterData = {
          borrower_name:
            (row.borrower_name as string | undefined) ??
            profile.borrower_name ??
            "Borrower",
          prequal_amount: coerceNumber(row.prequal_amount) ?? 0,
          loan_product: String(row.product_type ?? "Conventional"),
          purchase_price: profile.target_price ?? coerceNumber(row.prequal_amount) ?? 0,
        };
      }
    }
  }

  const documentGaps = docs.filter((d) => !d.collected).map((d) => d.document_name);

  return {
    session,
    messages,
    profile,
    loanMatch,
    letterData,
    documentGaps,
    assignedOfficer,
    assignedOfficerProfile,
  };
}

/** Borrower already linked on a prior guest pre-qual for the same email. */
async function findExistingGuestBorrowerId(
  supabase: ReturnType<typeof createClient>,
  guestEmail: string,
  excludeSessionId?: string,
): Promise<string | null> {
  const email = guestEmail.trim().toLowerCase();
  if (!email) return null;

  let sessionQuery = supabase
    .from("prequal_sessions")
    .select("borrower_id")
    .eq("guest_email", email)
    .not("borrower_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (excludeSessionId) {
    sessionQuery = sessionQuery.neq("id", excludeSessionId);
  }
  const { data: linkedSession } = await sessionQuery.maybeSingle();
  if (linkedSession?.borrower_id) return linkedSession.borrower_id as string;

  const { data: borrower } = await supabase
    .from("borrowers")
    .select("id")
    .ilike("email", email)
    .eq("data_source", "prequal")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (borrower?.id as string | undefined) ?? null;
}

/** Link returning guest sessions to an existing borrower record when found. */
async function resolveGuestSessionBorrowerId(
  supabase: ReturnType<typeof createClient>,
  sessionId: string,
  guestEmail: string | null | undefined,
  currentBorrowerId: string | null | undefined,
): Promise<string | null> {
  if (currentBorrowerId) return currentBorrowerId;
  if (!guestEmail?.trim()) return null;

  const existing = await findExistingGuestBorrowerId(supabase, guestEmail, sessionId);
  if (!existing) return null;

  await supabase
    .from("prequal_sessions")
    .update({ borrower_id: existing })
    .eq("id", sessionId)
    .is("borrower_id", null);

  return existing;
}

async function loadBorrowerProfileSnapshot(
  supabase: ReturnType<typeof createClient>,
  borrowerId: string,
): Promise<Record<string, unknown> | null> {
  const { data } = await supabase
    .from("borrowers")
    .select("first_name, last_name, email, phone, street_address, city, state, postal_code")
    .eq("id", borrowerId)
    .maybeSingle();
  return data as Record<string, unknown> | null;
}

async function findLatestGuestPhoneForEmail(
  supabase: ReturnType<typeof createClient>,
  email: string,
): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  const { data } = await supabase
    .from("prequal_sessions")
    .select("guest_phone")
    .ilike("guest_email", normalized)
    .not("guest_phone", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const phone = String(data?.guest_phone ?? "").trim();
  return phone || null;
}

function mergeKnownGuestIdentity(
  profile: PrequalProfile,
  borrower: Record<string, unknown> | null,
  guest?: { name?: string | null; email?: string | null; phone?: string | null },
): PrequalProfile {
  let merged = mergeBorrowerSnapshotIntoProfile(profile, borrower);
  if (guest?.name && !merged.borrower_name?.trim()) {
    merged = { ...merged, borrower_name: guest.name.trim() };
  }
  if (guest?.email && !merged.borrower_email?.trim()) {
    merged = { ...merged, borrower_email: guest.email.trim().toLowerCase() };
  }
  if (guest?.phone && !merged.borrower_phone?.trim()) {
    merged = { ...merged, borrower_phone: guest.phone.trim() };
  }
  return merged;
}

async function enrichGuestResumePayload(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const sessionId = payload.session_id as string | undefined;
  const guestEmail = payload.guest_email as string | null | undefined;
  const currentBorrowerId = payload.borrower_id as string | null | undefined;
  if (!sessionId) return payload;

  const borrowerId = await resolveGuestSessionBorrowerId(
    supabase,
    sessionId,
    guestEmail,
    currentBorrowerId,
  );
  const borrowerProfile = borrowerId
    ? await loadBorrowerProfileSnapshot(supabase, borrowerId)
    : null;
  const normalizedGuestEmail = String(guestEmail ?? "").trim().toLowerCase();
  const priorPhone =
    normalizedGuestEmail && !borrowerProfile?.phone
      ? await findLatestGuestPhoneForEmail(supabase, normalizedGuestEmail)
      : null;
  const mergedProfile = mergeKnownGuestIdentity(
    (payload.profile ?? {}) as PrequalProfile,
    borrowerProfile,
    {
      name: payload.guest_name as string | null | undefined,
      email: normalizedGuestEmail || undefined,
      phone: priorPhone ?? (payload.guest_phone as string | null | undefined),
    },
  );
  return {
    ...payload,
    profile: mergedProfile,
    borrower_id: borrowerId,
    ...(borrowerProfile ? { borrower_profile: borrowerProfile } : {}),
  };
}

type GuestSessionSummary = {
  id: string;
  title: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  guest_name: string | null;
  message_count: number;
  preview: string | null;
};

function guestResumeResponse(
  loaded: Awaited<ReturnType<typeof loadGuestSessionState>>,
) {
  if ("error" in loaded) return loaded;
  const {
    session,
    messages: storedMessages,
    profile,
    loanMatch,
    letterData,
    documentGaps,
    assignedOfficer,
    assignedOfficerProfile,
  } = loaded;
  return {
    resumed: true,
    session_id: session.id,
    session_token: session.session_token,
    messages: storedMessages,
    profile,
    loan_match: loanMatch,
    letter_data: letterData,
    document_gaps: documentGaps,
    assigned_officer: assignedOfficer,
    assigned_officer_profile: assignedOfficerProfile,
    guest_name: session.guest_name,
    guest_email: session.guest_email,
    guest_phone: session.guest_phone,
    borrower_id: session.borrower_id ?? null,
  };
}

async function lookupGuestSessionsByEmail(
  supabase: ReturnType<typeof createClient>,
  email: string,
): Promise<{ sessions: GuestSessionSummary[] } | { error: string }> {
  const guestEmail = email.trim().toLowerCase();
  if (!guestEmail || !isValidEmail(guestEmail)) {
    return { error: "Valid email is required" };
  }

  const { data: sessions, error } = await supabase
    .from("prequal_sessions")
    .select("id, title, status, created_at, updated_at, guest_name")
    .is("user_id", null)
    .eq("guest_email", guestEmail)
    .order("updated_at", { ascending: false })
    .limit(10);

  if (error) throw error;
  if (!sessions?.length) return { sessions: [] };

  const sessionIds = sessions.map((s) => s.id as string);
  const { data: messages, error: msgError } = await supabase
    .from("prequal_messages")
    .select("session_id, role, content, created_at")
    .in("session_id", sessionIds)
    .order("created_at", { ascending: false });

  if (msgError) throw msgError;

  const countBySession = new Map<string, number>();
  const previewBySession = new Map<string, string>();

  for (const msg of messages ?? []) {
    const sid = msg.session_id as string;
    countBySession.set(sid, (countBySession.get(sid) ?? 0) + 1);
  }

  for (const msg of messages ?? []) {
    const sid = msg.session_id as string;
    if (previewBySession.has(sid) || msg.role !== "user") continue;
    const trimmed = String(msg.content).trim();
    if (!trimmed) continue;
    previewBySession.set(sid, trimmed.length > 80 ? `${trimmed.slice(0, 77)}…` : trimmed);
  }

  for (const msg of messages ?? []) {
    const sid = msg.session_id as string;
    if (previewBySession.has(sid)) continue;
    const trimmed = String(msg.content).trim();
    if (!trimmed) continue;
    previewBySession.set(sid, trimmed.length > 80 ? `${trimmed.slice(0, 77)}…` : trimmed);
  }

  return {
    sessions: limitGuestResumeSessions(
      sessions.map((s) => ({
        id: s.id as string,
        title: (s.title as string | null) ?? null,
        status: s.status as string,
        created_at: s.created_at as string,
        updated_at: s.updated_at as string,
        guest_name: s.guest_name as string | null,
        message_count: countBySession.get(s.id as string) ?? 0,
        preview: previewBySession.get(s.id as string) ?? null,
      })),
    ),
  };
}

async function resumeGuestSessionByEmail(
  supabase: ReturnType<typeof createClient>,
  sessionId: string,
  email: string,
) {
  const guestEmail = email.trim().toLowerCase();
  if (!sessionId || !guestEmail || !isValidEmail(guestEmail)) {
    return { error: "session_id and valid email are required" as const };
  }

  const { data: session, error: sessionError } = await supabase
    .from("prequal_sessions")
    .select("id, session_token, guest_email, user_id")
    .eq("id", sessionId)
    .single();

  if (
    sessionError ||
    !session ||
    session.user_id ||
    (session.guest_email ?? "").toLowerCase() !== guestEmail
  ) {
    return { error: "Invalid guest session" as const };
  }

  return loadGuestSessionState(supabase, sessionId, session.session_token as string);
}

/** When a guest resumes a chat, retire other intake-only sessions for the same email. */
async function abandonOtherGuestSessions(
  supabase: ReturnType<typeof createClient>,
  guestEmail: string,
  keepSessionId: string,
) {
  const email = guestEmail.trim().toLowerCase();
  if (!email) return;

  const { data: others, error } = await supabase
    .from("prequal_sessions")
    .select("id")
    .is("user_id", null)
    .eq("guest_email", email)
    .eq("status", "active")
    .neq("id", keepSessionId);

  if (error || !others?.length) return;

  for (const row of others) {
    const otherId = row.id as string;
    const { count, error: countError } = await supabase
      .from("prequal_messages")
      .select("id", { count: "exact", head: true })
      .eq("session_id", otherId)
      .eq("role", "user");
    if (countError) continue;
    if ((count ?? 0) > 0) continue;

    const { error: abandonError } = await supabase
      .from("prequal_sessions")
      .update({ status: "abandoned" })
      .eq("id", otherId);
    if (abandonError) console.error("Abandon stale guest session:", abandonError.message);
  }
}

async function resolveOfficerUserId(
  supabase: ReturnType<typeof createClient>,
  officerName: string | null | undefined,
): Promise<string | null> {
  if (!officerName) return null;
  const officers = await fetchLoanOfficers(supabase);
  const match = officers.find(
    (o) => o.name === officerName || o.name.toLowerCase() === officerName.toLowerCase(),
  );
  if (match?.user_id) return match.user_id;
  return officers[0]?.user_id ?? null;
}

type CreateBorrowerPayload = {
  session_id: string;
  session_token: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  street_address?: string;
  postal_code?: string;
};

async function upsertPrequalBorrower(
  supabase: ReturnType<typeof createClient>,
  session: {
    id: string;
    guest_name?: string | null;
    guest_email?: string | null;
    guest_phone?: string | null;
    borrower_id?: string | null;
  },
  profile: PrequalProfile,
  assignedOfficer: string | null,
  letterData: LetterData | null,
  overrides: Partial<CreateBorrowerPayload> = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const sessionId = session.id;

  let firstName = String(overrides.first_name ?? "").trim().slice(0, 100);
  let lastName = String(overrides.last_name ?? "").trim().slice(0, 100);
  if (!firstName || !lastName) {
    const split = splitBorrowerName(String(profile.borrower_name ?? session.guest_name ?? ""));
    firstName = firstName || split.first_name;
    lastName = lastName || split.last_name;
  }
  const cityRaw = String(overrides.city ?? profile.city ?? "").trim().slice(0, 100);
  const stateRaw = String(overrides.state ?? profile.state ?? "").trim().toUpperCase().slice(0, 2);
  const city = cityRaw || null;
  const state = stateRaw.length === 2 ? stateRaw : null;
  const emailRaw = String(
    overrides.email ?? profile.borrower_email ?? session.guest_email ?? "",
  )
    .trim()
    .toLowerCase()
    .slice(0, 254);
  const phoneRaw = String(
    overrides.phone ?? profile.borrower_phone ?? session.guest_phone ?? "",
  )
    .trim()
    .slice(0, 50);
  const street =
    String(overrides.street_address ?? profile.street_address ?? "").trim().slice(0, 255) || null;
  const postal =
    String(overrides.postal_code ?? profile.postal_code ?? "").trim().slice(0, 20) || null;

  if (!firstName || !lastName) {
    return { status: 400, body: { error: "First and last name are required" } };
  }
  if (emailRaw && !isValidEmail(emailRaw)) {
    return { status: 400, body: { error: "Invalid email address" } };
  }
  const phoneStored = phoneRaw ? coerceStoredPhone(phoneRaw) : undefined;
  if (phoneRaw && !phoneStored) {
    return { status: 400, body: { error: "Invalid phone number" } };
  }

  if (!letterData || !assignedOfficer) {
    return {
      status: 400,
      body: { error: "Complete pre-qualification before saving your profile" },
    };
  }

  const guestEmail = String(session.guest_email ?? profile.borrower_email ?? "").trim().toLowerCase();
  let borrowerIdToUpdate =
    (session.borrower_id as string | null | undefined) ??
    (guestEmail ? await findExistingGuestBorrowerId(supabase, guestEmail, sessionId) : null);

  const apiPayload = {
    prequal_session_id: sessionId,
    assigned_officer: assignedOfficer,
    profile,
    letter_data: letterData,
  };

  if (borrowerIdToUpdate) {
    const { data: existingBorrower, error: fetchError } = await supabase
      .from("borrowers")
      .select("api_payload")
      .eq("id", borrowerIdToUpdate)
      .maybeSingle();
    if (fetchError) {
      console.error("Borrower fetch error:", fetchError.message);
      return { status: 500, body: { error: "Could not save your profile. Please try again." } };
    }
    if (!existingBorrower) {
      borrowerIdToUpdate = null;
    } else {
      const priorPayload =
        existingBorrower.api_payload && typeof existingBorrower.api_payload === "object"
          ? (existingBorrower.api_payload as Record<string, unknown>)
          : {};
      const { error: updateError } = await supabase
        .from("borrowers")
        .update({
          first_name: firstName,
          last_name: lastName,
          email: emailRaw || null,
          phone: phoneStored ?? null,
          street_address: street,
          city,
          state,
          postal_code: postal,
          api_payload: { ...priorPayload, ...apiPayload },
        })
        .eq("id", borrowerIdToUpdate);

      if (updateError) {
        console.error("Borrower update error:", updateError.message);
        return { status: 500, body: { error: "Could not save your profile. Please try again." } };
      }

      await supabase
        .from("prequal_sessions")
        .update({ borrower_id: borrowerIdToUpdate })
        .eq("id", sessionId)
        .is("borrower_id", null);

      return {
        status: 200,
        body: { success: true, borrower_id: borrowerIdToUpdate, updated: true },
      };
    }
  }

  const createdBy = await resolveOfficerUserId(supabase, assignedOfficer);

  const { data: borrower, error: insertError } = await supabase
    .from("borrowers")
    .insert({
      first_name: firstName,
      last_name: lastName,
      email: emailRaw || null,
      phone: phoneStored ?? null,
      street_address: street,
      city,
      state,
      postal_code: postal,
      data_source: "prequal",
      api_payload: apiPayload,
      created_by: createdBy,
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("Borrower create error:", insertError.message);
    return { status: 500, body: { error: "Could not save your profile. Please try again." } };
  }

  const { error: linkError } = await supabase
    .from("prequal_sessions")
    .update({ borrower_id: borrower.id })
    .eq("id", sessionId);

  if (linkError) {
    console.error("Prequal session link error:", linkError.message);
  }

  return { status: 200, body: { success: true, borrower_id: borrower.id, created: true } };
}

/** Create or update borrower from chat profile after pre-qual letter (best-effort). */
async function ensureBorrowerFromPrequalAfterLetter(
  supabase: ReturnType<typeof createClient>,
  session: {
    id: string;
    guest_name?: string | null;
    guest_email?: string | null;
    guest_phone?: string | null;
    borrower_id?: string | null;
  },
  profile: PrequalProfile,
  assignedOfficer: string | null,
  letterData: LetterData | null,
): Promise<string | null> {
  if (!letterData || !assignedOfficer) return null;
  if (session.borrower_id) return session.borrower_id as string;

  const result = await upsertPrequalBorrower(
    supabase,
    session,
    profile,
    assignedOfficer,
    letterData,
  );
  if (result.status !== 200) {
    console.error("Auto borrower create skipped:", result.body.error ?? result.status);
    return null;
  }
  return (result.body.borrower_id as string | undefined) ?? null;
}

async function handleCreateBorrowerFromPrequal(
  supabase: ReturnType<typeof createClient>,
  payload: CreateBorrowerPayload,
) {
  const sessionId = String(payload.session_id ?? "").trim();
  const sessionToken = String(payload.session_token ?? "").trim();
  if (!sessionId || !sessionToken) {
    return { status: 400, body: { error: "session_id and session_token are required" } };
  }

  const loaded = await loadGuestSessionState(supabase, sessionId, sessionToken);
  if ("error" in loaded) {
    return { status: 401, body: { error: loaded.error } };
  }

  const { session, profile, assignedOfficer, letterData } = loaded;

  return upsertPrequalBorrower(
    supabase,
    session,
    profile,
    assignedOfficer ?? null,
    letterData,
    payload,
  );
}

function hasAskedLegalNameInChat(messages: Array<{ role: string; content: string }>): boolean {
  const patterns = [
    /full legal name/i,
    /legal name/i,
    /confirm.*(?:your )?name/i,
    /what is your (?:full )?name/i,
  ];
  return messages.some(
    (m) => m.role === "assistant" && patterns.some((p) => p.test(m.content)),
  );
}

function buildNameGuidance(
  profile: { borrower_name?: string },
  messages: Array<{ role: string; content: string }>,
  contactName?: string,
): string {
  const onScorecard = profile.borrower_name?.trim();
  const alreadyAsked = hasAskedLegalNameInChat(messages);

  if (onScorecard) {
    return `\n\n## Legal name — RESOLVED
- Full legal name on scorecard: **${onScorecard}**
- Do NOT ask for full legal name again in this conversation. Use this name for \`generate_prequal_letter\`.`;
  }
  if (alreadyAsked) {
    const fallback = contactName?.trim() || "from their earlier replies";
    return `\n\n## Legal name — already asked
- You already asked for full legal name in this chat. Do NOT ask again.
- If they gave a name in a reply, call \`extract_financials\` with borrower_name. Otherwise use ${fallback}.`;
  }
  if (contactName?.trim()) {
    return `\n\n## Legal name — pending
- Contact/intake name on file: ${contactName.trim()}
- Ask ONCE before \`generate_prequal_letter\`: "Just to confirm for your pre-qualification letter, what is your full legal name?"
- Never repeat this question in the same conversation.`;
  }
  return `\n\n## Legal name — pending
- Ask ONCE before \`generate_prequal_letter\` for their full legal name.
- Never repeat this question in the same conversation.`;
}

function buildSystemPrompt(
  contact?: { name?: string; email?: string; phone?: string; isGuest?: boolean },
  profile?: { borrower_name?: string },
  messages: Array<{ role: string; content: string }> = [],
): string {
  let extra = "";
  if (contact?.name) {
    extra += `\n\n## Contact on file\n- Name: ${contact.name} — you may greet them by first name.\n`;
  }
  if (contact?.email) {
    extra += `- Email: ${contact.email} (on file for their loan officer; do not repeat the full email unless confirming contact preferences)\n`;
  }
  if (contact?.phone) {
    extra += `- Phone: ${contact.phone} (on file for follow-up; do not repeat unless confirming contact preferences)\n`;
  }
  if (contact?.isGuest) {
    extra += `- This borrower is chatting without an account. Name, email, and optional phone were collected at intake — do NOT ask for email or phone in chat.
- Ask for their current mailing address (street, city, state, ZIP) in chat before generating the pre-qual letter. Call extract_financials with street_address, city, state, and postal_code when they provide them.
- After pre-qualification they may optionally use "Complete profile" below the chat to confirm or update contact details — mention it briefly but do not require it for follow-up.
- Do NOT suggest signing in, creating an account, or tracking their application in the app.
`;
  }
  extra += buildNameGuidance(profile ?? {}, messages, contact?.name);
  return SYSTEM_PROMPT + extra;
}

function toChatMessages(
  messages: Array<{ role: string; content: string }>,
  contact?: { name?: string; email?: string; phone?: string; isGuest?: boolean },
  profile?: { borrower_name?: string },
): ChatMessage[] {
  return [
    { role: "system", content: buildSystemPrompt(contact, profile, messages) },
    ...messages.map((m) => ({
      role: (m.role === "assistant" ? "assistant" : "user") as "assistant" | "user",
      content: m.content,
    })),
  ];
}

const SYSTEM_PROMPT = `You are Alex, a friendly and knowledgeable mortgage pre-qualification specialist at MCT Mortgage.

Your job is to help borrowers get pre-qualified through natural conversation — no forms, no jargon. You gather financial information and mailing address in chat.

The Live Eligibility Scorecard on the right updates from extract_financials. Every financial detail the borrower shares must be captured there.

## Personality
- Warm, encouraging, professional
- Celebrate milestones: "Great news — your DTI looks strong! ✅"
- Explain financial concepts simply
- Keep messages concise: 2-4 short paragraphs max

## Information to collect in chat (in rough order)
1. Target purchase price and down payment
2. Annual gross income
3. Monthly debt payments (car, student, credit cards)
4. Employment type and years at job
5. Credit score tier (excellent/good/fair/poor)
6. Veteran status
7. First-time buyer status
8. Full legal name — ask at most once if not already on the scorecard (required before generate_prequal_letter)
9. Current mailing address — street, city, state, and ZIP (required before generate_prequal_letter; call extract_financials for each field)

Do NOT ask for email or phone in chat when they were collected at guest intake.

## Flow order — STRICT
1. Collect financial information (steps 1–7 above)
2. Confirm full legal name (once, if needed) and call extract_financials with borrower_name
3. Collect current mailing address (step 9) and call extract_financials with street_address, city, state, postal_code
4. Call calculate_dti, match_loan_products, and check_document_gaps as needed
5. Call generate_prequal_letter when financial data, legal name, and mailing address are confirmed
6. Call route_to_officer immediately after the letter
7. End the conversation — congratulate them; their loan officer will follow up within 24 hours. For guest borrowers, they may optionally confirm details via "Complete profile" below the chat.

## Name confirmation — STRICT
- Follow the "Legal name" section injected at the end of this prompt — it reflects the current scorecard and chat history
- Ask for full legal name AT MOST ONCE per conversation
- If borrower_name is already on the scorecard, do NOT ask again — use it for the letter
- If you already asked in this chat, do NOT ask again — extract the name from their reply or use contact/intake name
- When they provide or confirm a name, call extract_financials with borrower_name
- Only call generate_prequal_letter after borrower_name is on the scorecard

## Extraction accuracy — STRICT
- Only pass fields the borrower explicitly stated in this conversation
- Never invent, estimate, or assume values (no default 20% down payment, no guessed income/credit)
- Parse informal amounts: "100k" → 100000, "200k a year" → annual_income 200000, "20%" of a known price → down_payment amount
- If they give a range, use the midpoint and confirm it briefly

## Tool usage rules — STRICT
- Call extract_financials IMMEDIATELY whenever ANY profile field is mentioned (including name)
- Call calculate_dti after you have income + debts + price + down payment
- Call match_loan_products after credit tier + price + down payment + income
- Call check_document_gaps after loan product is matched
- Call generate_prequal_letter ONLY after confirming financial data AND full legal name
- Call route_to_officer immediately after generate_prequal_letter
- You may chain multiple tools in one turn

## After each tool result
- extract_financials: briefly confirm what you captured, ask next question
- calculate_dti: share DTI with emoji (✅ ≤36% / ⚠️ 37-43% / ❌ >43%)
- match_loan_products: explain why this product fits them specifically
- check_document_gaps: present as a simple checklist
- generate_prequal_letter: congratulate them enthusiastically on their pre-qualification
- route_to_officer: introduce their assigned officer by name; say the officer will get back to them within 24 hours

## Closing message after route_to_officer — STRICT
- Say the assigned loan officer will get back to them (within 24 hours)
- For guest borrowers: optionally mention they can confirm details via "Complete profile" below the chat
- NEVER say "feel free to reach out", "contact them with questions", "reach out for next steps", or similar — the loan officer initiates follow-up

Start by asking about their home purchase goal and target price range.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return new Response(JSON.stringify({ error: "Missing Supabase configuration" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const {
      messages,
      session_id,
      session_token,
      profile: incomingProfile,
      user_message,
      init_guest,
      contact,
      resume_guest,
      lookup_guest_sessions,
      resume_guest_by_email,
      create_borrower,
    } = body as {
      messages?: Array<{ role: string; content: string }>;
      session_id?: string;
      session_token?: string;
      profile?: Record<string, unknown>;
      user_message?: string;
      init_guest?: { name?: string; email?: string; phone?: string };
      contact?: { name?: string; email?: string; phone?: string };
      resume_guest?: boolean;
      lookup_guest_sessions?: { email?: string };
      resume_guest_by_email?: { email?: string; session_id?: string };
      create_borrower?: CreateBorrowerPayload;
    };

    if (create_borrower) {
      const result = await handleCreateBorrowerFromPrequal(supabase, create_borrower);
      return new Response(JSON.stringify(result.body), {
        status: result.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (lookup_guest_sessions) {
      const email = String(lookup_guest_sessions.email ?? "");
      const result = await lookupGuestSessionsByEmail(supabase, email);
      if ("error" in result) {
        return new Response(JSON.stringify({ error: result.error }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (resume_guest_by_email) {
      const sessionId = String(resume_guest_by_email.session_id ?? "").trim();
      const email = String(resume_guest_by_email.email ?? "");
      const loaded = await resumeGuestSessionByEmail(supabase, sessionId, email);
      if ("error" in loaded) {
        return new Response(JSON.stringify({ error: loaded.error }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await abandonOtherGuestSessions(supabase, email, loaded.session.id as string);
      const payload = await enrichGuestResumePayload(
        supabase,
        guestResumeResponse(loaded) as Record<string, unknown>,
      );
      return new Response(JSON.stringify(payload), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (resume_guest === true) {
      if (!session_id || !session_token) {
        return new Response(JSON.stringify({ error: "session_id and session_token are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const loaded = await loadGuestSessionState(supabase, session_id, session_token);
      if ("error" in loaded) {
        return new Response(JSON.stringify({ error: loaded.error }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const guestEmail = (loaded.session.guest_email as string | null) ?? "";
      if (guestEmail) {
        await abandonOtherGuestSessions(supabase, guestEmail, loaded.session.id as string);
      }
      const payload = await enrichGuestResumePayload(
        supabase,
        guestResumeResponse(loaded) as Record<string, unknown>,
      );
      return new Response(JSON.stringify(payload), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    type GuestContext = {
      guestName: string;
      guestEmail: string;
      guestPhone?: string;
      isGuest: true;
    };
    type UserContext = {
      userId: string;
      contactName?: string;
      contactEmail?: string;
      isGuest: false;
    };

    let actor: UserContext | GuestContext | null = null;
    let sessionId = session_id as string | undefined;
    let sessionToken: string | undefined = session_token;
    let profile: Record<string, unknown> = incomingProfile ?? {};

    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const jwt = authHeader.replace(/^Bearer\s+/i, "");
      const authClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: authError } = await authClient.auth.getUser(jwt);
      const user = userData?.user;
      if (!authError && user) {
        actor = {
          userId: user.id,
          contactName: contact?.name ?? (user.user_metadata?.full_name as string | undefined) ?? (user.user_metadata?.name as string | undefined),
          contactEmail: contact?.email ?? user.email ?? undefined,
          isGuest: false,
        };
      }
    }

    if (!actor) {
      if (init_guest?.name && init_guest?.email) {
      const guestName = String(init_guest.name).trim().slice(0, 120);
      const guestEmail = String(init_guest.email).trim().toLowerCase().slice(0, 254);
      const guestPhoneRaw = init_guest.phone ? String(init_guest.phone).trim().slice(0, 50) : "";
      const guestPhone = guestPhoneRaw ? coerceStoredPhone(guestPhoneRaw) : undefined;
      if (!guestName || !isValidEmail(guestEmail)) {
        return new Response(JSON.stringify({ error: "Valid name and email are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (guestPhoneRaw && !guestPhone) {
        return new Response(JSON.stringify({ error: "Invalid phone number" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: session, error: sessionError } = await supabase
        .from("prequal_sessions")
        .insert({
          user_id: null,
          guest_name: guestName,
          guest_email: guestEmail,
          guest_phone: guestPhone ?? null,
          status: "active",
        })
        .select("id, session_token")
        .single();
      if (sessionError) throw sessionError;
      sessionId = session?.id;
      sessionToken = session?.session_token;
      profile = {
        ...profile,
        borrower_name: guestName,
        borrower_email: guestEmail,
        ...(guestPhone ? { borrower_phone: guestPhone } : {}),
      };
      await supabase.from("prequal_profiles").upsert(
        {
          session_id: sessionId,
          borrower_name: guestName,
          borrower_email: guestEmail,
          borrower_phone: guestPhone ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "session_id" },
      );
      actor = { guestName, guestEmail, guestPhone, isGuest: true };

      const linkedBorrowerId = sessionId
        ? await resolveGuestSessionBorrowerId(supabase, sessionId, guestEmail, null)
        : null;
      const borrowerProfile = linkedBorrowerId
        ? await loadBorrowerProfileSnapshot(supabase, linkedBorrowerId)
        : null;
      const priorPhone =
        !guestPhone && !borrowerProfile?.phone
          ? await findLatestGuestPhoneForEmail(supabase, guestEmail)
          : null;
      profile = mergeKnownGuestIdentity(profile as PrequalProfile, borrowerProfile, {
        name: guestName,
        email: guestEmail,
        phone: guestPhone ?? priorPhone,
      });

      return new Response(
        JSON.stringify({
          message: null,
          session_id: sessionId,
          session_token: sessionToken,
          profile,
          borrower_id: linkedBorrowerId,
          ...(borrowerProfile ? { borrower_profile: borrowerProfile } : {}),
          initialized: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
      } else if (session_id && session_token) {
      const { data: session, error: sessionError } = await supabase
        .from("prequal_sessions")
        .select("id, session_token, guest_name, guest_email, guest_phone, user_id")
        .eq("id", session_id)
        .single();
      if (sessionError || !session || session.session_token !== session_token || session.user_id) {
        return new Response(JSON.stringify({ error: "Invalid guest session" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      sessionId = session.id;
      sessionToken = session.session_token;
      actor = {
        guestName: session.guest_name ?? "Guest",
        guestEmail: session.guest_email ?? "",
        guestPhone: session.guest_phone ?? undefined,
        isGuest: true,
      };
      if (!profile.borrower_name && session.guest_name) profile.borrower_name = session.guest_name;
      if (!profile.borrower_email && session.guest_email) profile.borrower_email = session.guest_email;
      if (!profile.borrower_phone && session.guest_phone) profile.borrower_phone = session.guest_phone;
      } else {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!sessionId && actor && !actor.isGuest) {
      const contactName = actor.contactName;
      const contactEmail = actor.contactEmail;
      const { data: session, error: sessionError } = await supabase
        .from("prequal_sessions")
        .insert({
          user_id: actor.userId,
          guest_name: contactName ?? null,
          guest_email: contactEmail ?? null,
          status: "active",
        })
        .select("id, session_token")
        .single();
      if (sessionError) throw sessionError;
      sessionId = session?.id;
      sessionToken = session?.session_token;
    }

    // Always seed contact into the scorecard profile (every turn, not only session create).
    if (actor.isGuest) {
      if (actor.guestName) profile.borrower_name = profile.borrower_name ?? actor.guestName;
      if (actor.guestEmail) profile.borrower_email = profile.borrower_email ?? actor.guestEmail;
      if (actor.guestPhone) profile.borrower_phone = profile.borrower_phone ?? actor.guestPhone;
    } else {
      if (actor.contactName) profile.borrower_name = profile.borrower_name ?? actor.contactName;
      if (actor.contactEmail) profile.borrower_email = profile.borrower_email ?? actor.contactEmail;
    }

    const contactContext = actor.isGuest
      ? {
          name: actor.guestName,
          email: actor.guestEmail,
          phone: actor.guestPhone,
          isGuest: true as const,
        }
      : { name: actor.contactName, email: actor.contactEmail, isGuest: false as const };

    const apiKey = await getOpenAIApiKey();
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "OpenAI API key not configured (set OPENAI_API_KEY)" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allMessages = [...(messages ?? [])];
    let finalText = "";
    let letterData: LetterData | null = null;
    let documentGaps: string[] = [];
    let loanMatch: Record<string, unknown> | null = null;
    let assignedOfficer: string | undefined;
    let assignedOfficerProfile: OfficerProfile | null = null;
    let sessionStatus = "active";

    if (sessionId) {
      const seed = await loadSessionPersistSeed(supabase, sessionId);
      sessionStatus = seed.sessionStatus;
      profile = { ...seed.profile, ...profile };
      if (seed.letterData) letterData = seed.letterData;
      if (seed.loanMatch) loanMatch = seed.loanMatch as Record<string, unknown>;
      if (seed.assignedOfficer) assignedOfficer = seed.assignedOfficer;
    }

    const loanOfficers = await fetchLoanOfficers(supabase);
    const toolContext = { officers: loanOfficers };
    const MAX_LOOPS = 10;

    const chatMessages = toChatMessages(allMessages, contactContext, profile);

    for (let i = 0; i < MAX_LOOPS; i++) {
      let raw: Record<string, unknown>;
      try {
        raw = await chatCompletion(apiKey, chatMessages, {
          model: OPENAI_MODEL,
          max_tokens: 1024,
          temperature: 0.7,
          tools: OPENAI_TOOLS,
          tool_choice: "auto",
        });
      } catch (err) {
        const openAiMessage = err instanceof Error ? err.message : String(err);
        console.error("OpenAI API error:", openAiMessage);
        throw new Error(formatUserFacingAiError(openAiMessage));
      }

      const choice = ((raw.choices as Array<{
        finish_reason?: string;
        message?: {
          role?: string;
          content?: string | null;
          tool_calls?: Array<{
            id: string;
            type: string;
            function: { name: string; arguments: string };
          }>;
        };
      }>) ?? [])[0];

      const assistantMessage = choice?.message;
      if (assistantMessage?.content) finalText = assistantMessage.content;

      const toolCalls = assistantMessage?.tool_calls ?? [];
      if (choice?.finish_reason !== "tool_calls" || toolCalls.length === 0) break;

      chatMessages.push({
        role: "assistant",
        content: assistantMessage?.content ?? null,
        tool_calls: toolCalls,
      });

      for (const tc of toolCalls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function.arguments);
        } catch {
          // use empty args
        }

        const { result, profile: updatedProfile } = executeTool(
          tc.function.name,
          args,
          profile,
          toolContext,
        );
        profile = updatedProfile;

        if (tc.function.name === "generate_prequal_letter") {
          const purchasePrice =
            coerceNumber(args.purchase_price) ?? coerceNumber(profile.target_price) ?? 0;
          const prequalAmount = coerceNumber(args.prequal_amount) ?? purchasePrice;
          letterData = {
            borrower_name: String(args.borrower_name ?? profile.borrower_name ?? "Borrower"),
            prequal_amount: prequalAmount,
            loan_product: normalizeLoanProduct(String(args.loan_product ?? "Conventional")),
            purchase_price: purchasePrice,
          };
          profile.target_price = profile.target_price ?? purchasePrice;
          if (purchasePrice > prequalAmount) {
            profile.down_payment = profile.down_payment ?? purchasePrice - prequalAmount;
          }
        }
        if (tc.function.name === "check_document_gaps") {
          const parsed = JSON.parse(result);
          documentGaps = parsed.documents ?? [];
        }
        if (tc.function.name === "match_loan_products") loanMatch = JSON.parse(result);
        if (tc.function.name === "route_to_officer") {
          const parsed = JSON.parse(result);
          assignedOfficer = parsed.assigned_officer ?? undefined;
          if (parsed.email) {
            assignedOfficerProfile = {
              user_id: (parsed.user_id as string) ?? "",
              name: (parsed.name as string) ?? assignedOfficer ?? "",
              title: (parsed.title as string) ?? "Loan Officer",
              email: (parsed.email as string) ?? "",
              phone: (parsed.phone as string) ?? "",
              nmls_id: (parsed.nmls_id as string) ?? "",
              specialty: (parsed.specialty as string) ?? "",
            };
          }
        }

        chatMessages.push({
          role: "tool",
          content: result,
          tool_call_id: tc.id,
          name: tc.function.name,
        });
      }
    }

    if (sessionId) {
      try {
        if (user_message) {
          await supabase.from("prequal_messages").insert({
            session_id: sessionId,
            role: "user",
            content: user_message,
          });
          // Name the chat from the first user message (e.g. "condo in 45k").
          const title = formatSessionTitle(user_message);
          if (title) {
            await supabase
              .from("prequal_sessions")
              .update({ title })
              .eq("id", sessionId)
              .is("title", null);
          }
        }
        if (finalText) {
          await supabase.from("prequal_messages").insert({
            session_id: sessionId,
            role: "assistant",
            content: finalText,
          });
        }
        const profileFields = pickProfileFields(profile);
        if (letterData) {
          profileFields.letter_ready = true;
        }
        if (Object.keys(profileFields).length > 0) {
          await supabase.from("prequal_profiles").upsert(
            { session_id: sessionId, ...profileFields, updated_at: new Date().toISOString() },
            { onConflict: "session_id" },
          );
        }
        const matchToPersist = resolveLoanMatchForPersist(
          loanMatch as LoanMatch | null,
          profile,
          letterData,
        );

        const { data: existingMatch } = await supabase
          .from("prequal_loan_matches")
          .select(
            "letter_generated, prequal_amount, product_type, borrower_name, assigned_officer, status",
          )
          .eq("session_id", sessionId)
          .maybeSingle();

        if (matchToPersist) {
          const pipelineRow = buildPipelineMatchRow(
            sessionId,
            profile,
            matchToPersist,
            letterData,
            assignedOfficer ?? null,
          );
          const mergedRow =
            existingMatch?.letter_generated && !letterData
              ? {
                  ...pipelineRow,
                  letter_generated: true,
                  status:
                    pipelineRow.status === "pending" && existingMatch.letter_generated
                      ? "qualified"
                      : pipelineRow.status,
                  prequal_amount: pipelineRow.prequal_amount ?? existingMatch.prequal_amount,
                  product_type: pipelineRow.product_type ?? existingMatch.product_type,
                  borrower_name: pipelineRow.borrower_name ?? existingMatch.borrower_name,
                }
              : pipelineRow;
          if (assignedOfficer) {
            mergedRow.assigned_officer = assignedOfficer;
          } else if (!mergedRow.assigned_officer && existingMatch?.assigned_officer) {
            mergedRow.assigned_officer = existingMatch.assigned_officer as string;
          }
          const { error: matchError } = await supabase.from("prequal_loan_matches").upsert(
            {
              ...mergedRow,
              down_payment: matchToPersist.down_payment,
              ltv: matchToPersist.ltv,
            },
            { onConflict: "session_id" },
          );
          if (matchError) {
            console.error("Loan match persist error:", matchError.message);
            if (letterData) {
              throw new Error(`Could not save pre-qualification results: ${matchError.message}`);
            }
          }
        } else if (assignedOfficer && existingMatch) {
          const { error: officerError } = await supabase
            .from("prequal_loan_matches")
            .update({ assigned_officer: assignedOfficer })
            .eq("session_id", sessionId);
          if (officerError) {
            console.error("Assigned officer persist error:", officerError.message);
          }
        }
        if (documentGaps.length > 0) {
          const items = documentGaps.map((doc) => ({
            session_id: sessionId,
            document_name: doc,
            required: true,
            collected: false,
          }));
          await supabase.from("prequal_document_items").upsert(items, {
            onConflict: "session_id,document_name",
          });
        }
        if (letterData) {
          await supabase.from("prequal_sessions").update({ status: "completed" }).eq("id", sessionId);
          sessionStatus = "completed";
        }
        await repairMissingPipelineMatch(
          supabase,
          sessionId,
          sessionStatus,
          profile as PrequalProfile,
          letterData,
          (loanMatch as LoanMatch | null) ?? null,
          assignedOfficer ?? null,
        );
        if (letterData && actor?.isGuest && sessionId) {
          const { data: guestSession } = await supabase
            .from("prequal_sessions")
            .select("id, guest_name, guest_email, guest_phone, borrower_id")
            .eq("id", sessionId)
            .maybeSingle();
          if (guestSession) {
            await ensureBorrowerFromPrequalAfterLetter(
              supabase,
              guestSession,
              profile as PrequalProfile,
              assignedOfficer ?? null,
              letterData,
            );
          }
        }
      } catch (e) {
        console.error("Persist error:", e);
        if (letterData) throw e;
      }
    }

    let borrowerId: string | null = null;
    let borrowerProfile: Record<string, unknown> | null = null;
    if (actor?.isGuest && sessionId) {
      const { data: freshSession } = await supabase
        .from("prequal_sessions")
        .select("borrower_id, guest_email")
        .eq("id", sessionId)
        .maybeSingle();
      borrowerId = await resolveGuestSessionBorrowerId(
        supabase,
        sessionId,
        freshSession?.guest_email as string | null | undefined,
        freshSession?.borrower_id as string | null | undefined,
      );
      if (borrowerId) {
        borrowerProfile = await loadBorrowerProfileSnapshot(supabase, borrowerId);
      }
    }

    return new Response(
      JSON.stringify({
        message: finalText,
        session_id: sessionId,
        session_token: sessionToken,
        profile,
        letter_data: letterData,
        document_gaps: documentGaps,
        loan_match: loanMatch,
        assigned_officer: assignedOfficer,
        assigned_officer_profile: assignedOfficerProfile,
        ...(borrowerId ? { borrower_id: borrowerId } : {}),
        ...(borrowerProfile ? { borrower_profile: borrowerProfile } : {}),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("prequal-agent error:", err);
    const raw = err instanceof Error ? err.message : String(err);
    const error = formatUserFacingAiError(raw);
    return new Response(JSON.stringify({ error }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

