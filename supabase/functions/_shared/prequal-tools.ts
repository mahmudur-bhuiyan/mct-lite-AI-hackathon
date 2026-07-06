/**
 * Deterministic pre-qualification tool implementations.
 * Shared by prequal-agent edge function and frontend unit tests.
 */

export const PROFILE_COLUMNS = new Set([
  "borrower_name",
  "borrower_email",
  "borrower_phone",
  "street_address",
  "city",
  "state",
  "postal_code",
  "annual_income",
  "monthly_debts",
  "assets",
  "employment_type",
  "years_employed",
  "credit_tier",
  "is_veteran",
  "is_first_time_buyer",
  "target_price",
  "down_payment",
  "front_dti",
  "back_dti",
  "letter_ready",
]);

export interface PrequalProfile {
  borrower_name?: string;
  borrower_email?: string;
  borrower_phone?: string;
  street_address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  annual_income?: number;
  monthly_debts?: number;
  assets?: number;
  employment_type?: string;
  years_employed?: number;
  credit_tier?: string;
  is_veteran?: boolean;
  is_first_time_buyer?: boolean;
  target_price?: number;
  down_payment?: number;
  front_dti?: number;
  back_dti?: number;
  assigned_officer?: string;
  letter_ready?: boolean;
}

export const LOAN_PRODUCTS = ["Conventional", "FHA", "VA", "USDA"] as const;
export type LoanProduct = (typeof LOAN_PRODUCTS)[number];

/** Map free-text or variant product names to a valid DB enum value. */
export function normalizeLoanProduct(raw: string): LoanProduct {
  const t = raw.trim();
  if ((LOAN_PRODUCTS as readonly string[]).includes(t)) return t as LoanProduct;
  const u = t.toUpperCase();
  if (u.includes("FHA")) return "FHA";
  if (u.includes("USDA")) return "USDA";
  if (u.includes("VA") && !u.includes("CONV")) return "VA";
  return "Conventional";
}

/** Coerce tool-call / JSON values to finite numbers (OpenAI sometimes returns strings). */
export function coerceNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.trim().replace(/[,$\s]/g, "");
    if (!cleaned) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Recover letter data from a stored assistant congratulations message when the
 * DB row was never written (e.g. persist failed after a successful chat turn).
 */
export function inferLetterFromAssistantMessage(
  messages: Array<{ role: string; content: string }>,
  profile: PrequalProfile,
): LetterData | null {
  const lastCongrats = [...messages]
    .reverse()
    .find(
      (m) =>
        m.role === "assistant" &&
        /pre-qualif/i.test(m.content) &&
        /\$[\d,]+/.test(m.content),
    );
  if (!lastCongrats) return null;

  const amounts = [...lastCongrats.content.matchAll(/\$([0-9,]+)/g)]
    .map((m) => coerceNumber(m[1]))
    .filter((n): n is number => n != null && n > 0);
  if (amounts.length === 0) return null;

  const prequalAmount = Math.max(...amounts);
  const purchasePrice = profile.target_price ?? prequalAmount;
  const productMatch = lastCongrats.content.match(/\b(VA|FHA|USDA|Conventional)\b/i);
  let loanProduct = productMatch?.[1] ?? "Conventional";
  if (!productMatch && profile.is_veteran) loanProduct = "VA";

  return {
    borrower_name: profile.borrower_name ?? "Borrower",
    prequal_amount: prequalAmount,
    loan_product: normalizeLoanProduct(loanProduct),
    purchase_price: purchasePrice,
  };
}

/** Recover assigned LO name from assistant closing message when match row is missing. */
export function inferOfficerFromAssistantMessage(
  messages: Array<{ role: string; content: string }>,
): string | null {
  const last = [...messages]
    .reverse()
    .find(
      (m) => m.role === "assistant" && /loan officer/i.test(m.content),
    );
  if (!last) return null;
  const match = last.content.match(/loan officer,?\s+(?:\*\*)?([^*,\n]+)(?:\*\*)?/i);
  const name = match?.[1]?.trim();
  return name || null;
}

export interface LoanMatch {
  product_type: string;
  prequal_amount: number;
  loan_amount: number;
  down_payment: number;
  ltv: number;
  estimated_rate: number;
  monthly_payment: number;
}

export interface DtiResult {
  front_dti: number;
  back_dti: number;
  status: "excellent" | "acceptable" | "high";
  monthly_pi: number;
}

export interface LetterData {
  borrower_name: string;
  prequal_amount: number;
  loan_product: string;
  purchase_price: number;
}

export interface PipelineRow {
  id?: string;
  session_id: string;
  borrower_name: string | null;
  borrower_email?: string | null;
  borrower_phone?: string | null;
  product_type?: string | null;
  prequal_amount?: number | null;
  loan_amount?: number | null;
  estimated_rate?: number | null;
  monthly_payment?: number | null;
  back_dti: number | null;
  credit_tier: string | null;
  status: "inquiry" | "pending" | "qualified" | "referred" | "declined";
  letter_generated: boolean;
  assigned_officer: string | null;
  created_at?: string;
}

export function pickProfileFields(profile: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(profile)) {
    if (PROFILE_COLUMNS.has(key) && value !== undefined) {
      out[key] = value;
    }
  }
  return out;
}

/** Build a short chat-history title from the borrower's first message (max 20 chars). */
export function formatSessionTitle(message: string, maxLen = 20): string | null {
  const cleaned = message.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  if (cleaned.length <= maxLen) return cleaned;
  const budget = Math.max(1, maxLen - 1); // reserve one char for ellipsis
  const cut = cleaned.slice(0, budget);
  const lastSpace = cut.lastIndexOf(" ");
  const base = (lastSpace > Math.floor(budget / 2) ? cut.slice(0, lastSpace) : cut).trim();
  return `${base}…`;
}

export const GUEST_RESUME_MAX_SESSIONS = 3;
export const GUEST_RESUME_MAX_ACTIVE = 2;
export const GUEST_RESUME_MAX_COMPLETED = 1;

/** Guest welcome-back list: up to 3 chats (2 active + 1 completed max), most recent first. */
export function limitGuestResumeSessions<T extends { status: string; updated_at: string }>(
  sessions: T[],
): T[] {
  const byUpdatedDesc = (a: T, b: T) => b.updated_at.localeCompare(a.updated_at);

  const active = sessions
    .filter((s) => s.status === "active")
    .sort(byUpdatedDesc)
    .slice(0, GUEST_RESUME_MAX_ACTIVE);

  const completed = sessions
    .filter((s) => s.status === "completed")
    .sort(byUpdatedDesc)
    .slice(0, GUEST_RESUME_MAX_COMPLETED);

  return [...active, ...completed].sort(byUpdatedDesc).slice(0, GUEST_RESUME_MAX_SESSIONS);
}

type BorrowerSnapshot = {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  street_address?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
};

/** Fill identity fields on the scorecard from a linked borrowers row when missing. */
export function mergeBorrowerSnapshotIntoProfile(
  profile: PrequalProfile,
  borrower: BorrowerSnapshot | Record<string, unknown> | null | undefined,
): PrequalProfile {
  if (!borrower) return profile;

  const first = String(borrower.first_name ?? "").trim();
  const last = String(borrower.last_name ?? "").trim();
  const snapshotName = [first, last].filter(Boolean).join(" ");
  const snapshotEmail = String(borrower.email ?? "").trim();
  const snapshotPhone = String(borrower.phone ?? "").trim();
  const snapshotStreet = String(borrower.street_address ?? "").trim();
  const snapshotCity = String(borrower.city ?? "").trim();
  const snapshotState = String(borrower.state ?? "").trim().toUpperCase();
  const snapshotPostal = String(borrower.postal_code ?? "").trim();

  return {
    ...profile,
    borrower_name: profile.borrower_name?.trim() || snapshotName || undefined,
    borrower_email: profile.borrower_email?.trim() || snapshotEmail || undefined,
    borrower_phone: profile.borrower_phone?.trim() || snapshotPhone || undefined,
    street_address: profile.street_address?.trim() || snapshotStreet || undefined,
    city: profile.city?.trim() || snapshotCity || undefined,
    state: profile.state?.trim() || snapshotState || undefined,
    postal_code: profile.postal_code?.trim() || snapshotPostal || undefined,
  };
}

/** Split a full display name into first / last for borrower records. */
export function splitBorrowerName(fullName: string): { first_name: string; last_name: string } {
  const cleaned = fullName.replace(/\s+/g, " ").trim();
  if (!cleaned) return { first_name: "", last_name: "" };
  const space = cleaned.indexOf(" ");
  if (space < 0) return { first_name: cleaned, last_name: "" };
  return {
    first_name: cleaned.slice(0, space).trim(),
    last_name: cleaned.slice(space + 1).trim(),
  };
}

export function extractFinancials(
  input: Record<string, unknown>,
  profile: PrequalProfile,
): { profile: PrequalProfile; extracted: Record<string, unknown> } {
  const extracted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!PROFILE_COLUMNS.has(key)) continue;
    if (value === undefined || value === null || value === "") continue;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) continue;
      if (key === "state") {
        extracted[key] = trimmed.toUpperCase().slice(0, 2);
        continue;
      }
      extracted[key] = trimmed;
      continue;
    }
    extracted[key] = value;
  }
  return { profile: { ...profile, ...extracted }, extracted };
}

export function calculateDti(
  input: Record<string, unknown>,
  profile: PrequalProfile,
): { profile: PrequalProfile; result: DtiResult } {
  const income = (input.annual_income as number) || 0;
  const debts = (input.monthly_debts as number) || 0;
  const price = (input.target_price as number) || 0;
  const down = (input.down_payment as number) || 0;
  const rate = ((input.estimated_rate as number) || 7.0) / 100 / 12;
  const loanAmt = price - down;
  const n = 360;
  const pi =
    rate > 0
      ? (loanAmt * rate * Math.pow(1 + rate, n)) / (Math.pow(1 + rate, n) - 1)
      : loanAmt / n;
  const monthlyIncome = income / 12;
  const frontDti = monthlyIncome > 0 ? Math.round((pi / monthlyIncome) * 1000) / 10 : 0;
  const backDti =
    monthlyIncome > 0 ? Math.round(((pi + debts) / monthlyIncome) * 1000) / 10 : 0;
  const status: DtiResult["status"] =
    backDti <= 36 ? "excellent" : backDti <= 43 ? "acceptable" : "high";

  return {
    result: {
      front_dti: frontDti,
      back_dti: backDti,
      status,
      monthly_pi: Math.round(pi),
    },
    profile: { ...profile, front_dti: frontDti, back_dti: backDti },
  };
}

export function matchLoanProducts(
  input: Record<string, unknown>,
  profile: PrequalProfile,
): { profile: PrequalProfile; match: LoanMatch } {
  const price = (input.target_price as number) || 0;
  const down = (input.down_payment as number) || 0;
  const income = (input.annual_income as number) || 0;
  const credit = (input.credit_tier as string) || "good";
  const isVet = (input.is_veteran as boolean) || false;
  const debts = (input.monthly_debts as number) || 0;
  const ltv = price > 0 ? Math.round(((price - down) / price) * 100) : 0;
  const downPct = price > 0 ? (down / price) * 100 : 0;

  let product = "Conventional";
  let rate = 7.1;
  if (isVet) {
    product = "VA";
    rate = 6.75;
  } else if (credit === "fair" || credit === "poor" || downPct < 10) {
    product = "FHA";
    rate = 7.85;
  } else if (credit === "excellent") {
    rate = 6.85;
  }

  const rateAdj = { excellent: -0.25, good: 0, fair: 0.5, poor: 1.0 }[credit] ?? 0;
  if (product === "Conventional") rate += rateAdj;

  const loanAmt = price - down;
  const r = rate / 100 / 12;
  const n = 360;
  const payment =
    r > 0
      ? Math.round((loanAmt * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1))
      : Math.round(loanAmt / n);
  const maxBack = 0.43;
  const monthlyIncome = income / 12;
  const maxPayment = monthlyIncome * maxBack - debts;
  const maxLoan =
    r > 0
      ? (maxPayment * (Math.pow(1 + r, n) - 1)) / (r * Math.pow(1 + r, n))
      : maxPayment * n;
  const prequalAmt = Math.round(Math.min(maxLoan + down, price) / 1000) * 1000;

  const match: LoanMatch = {
    product_type: product,
    prequal_amount: prequalAmt,
    loan_amount: loanAmt,
    down_payment: down,
    ltv,
    estimated_rate: rate,
    monthly_payment: payment,
  };

  return { match, profile: { ...profile, ...match } };
}

export function checkDocumentGaps(input: Record<string, unknown>): string[] {
  const emp = input.employment_type as string;
  const loan = input.loan_product as string;
  const docs: string[] = [
    "Government-issued photo ID",
    "Social Security number",
    "Bank statements (last 2 months)",
  ];
  if (emp === "w2") docs.push("W-2 forms (last 2 years)", "Pay stubs (last 30 days)");
  if (emp === "self_employed") {
    docs.push(
      "Tax returns (last 2 years)",
      "Year-to-date P&L statement",
      "Business bank statements (last 3 months)",
    );
  }
  if (emp === "contractor") docs.push("1099 forms (last 2 years)", "Signed contracts showing income");
  if (emp === "retired") docs.push("Pension/Social Security award letters", "Retirement account statements");
  if (loan === "FHA") docs.push("FHA case number (assigned by lender)");
  if (loan === "VA") docs.push("Certificate of Eligibility (VA Form 26-1880)", "DD-214 discharge papers");
  if (loan === "USDA") docs.push("Property address for USDA eligibility check");
  return docs;
}

export function generatePrequalLetter(
  input: Record<string, unknown>,
  profile: PrequalProfile,
): { profile: PrequalProfile; letter: LetterData } {
  const purchasePrice =
    coerceNumber(input.purchase_price) ?? profile.target_price ?? 0;
  const prequalAmount =
    coerceNumber(input.prequal_amount) ?? purchasePrice;
  const letter: LetterData = {
    borrower_name: String(input.borrower_name ?? profile.borrower_name ?? "Borrower"),
    prequal_amount: prequalAmount,
    loan_product: normalizeLoanProduct(String(input.loan_product ?? "Conventional")),
    purchase_price: purchasePrice,
  };
  const down =
    profile.down_payment ??
    (purchasePrice > prequalAmount ? purchasePrice - prequalAmount : undefined);
  return {
    letter,
    profile: {
      ...profile,
      borrower_name: letter.borrower_name,
      target_price: purchasePrice || profile.target_price,
      ...(down != null ? { down_payment: down } : {}),
      letter_ready: true,
    },
  };
}

export interface OfficerProfile {
  user_id: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  nmls_id: string;
  specialty: string;
}

export interface PrequalToolContext {
  officers?: OfficerProfile[];
  rng?: () => number;
}

/** Deterministic roster for unit tests only. */
export const TEST_OFFICERS: OfficerProfile[] = [
  {
    user_id: "test-lo-1",
    name: "Cristiano Ronaldo",
    title: "Loan Officer",
    email: "cristiano.ronaldo@gmail.com",
    phone: "",
    nmls_id: "",
    specialty: "Mortgage loans",
  },
  {
    user_id: "test-lo-2",
    name: "Neymar Jr",
    title: "Loan Officer",
    email: "neymar.jr@gmail.com",
    phone: "",
    nmls_id: "",
    specialty: "Mortgage loans",
  },
];

export function profileToOfficer(row: {
  id: string;
  full_name: string | null;
  email: string | null;
}): OfficerProfile {
  return {
    user_id: row.id,
    name: row.full_name?.trim() || row.email || "Loan Officer",
    title: "Loan Officer",
    email: row.email || "",
    phone: "",
    nmls_id: "",
    specialty: "Mortgage loans",
  };
}

/** Look up loan-officer details by display name (pipeline stores name only). */
export function getOfficerProfile(
  name: string | null | undefined,
  officers?: OfficerProfile[],
): OfficerProfile | null {
  if (!name) return null;
  const roster = officers ?? [];
  const exact = roster.find((o) => o.name === name);
  if (exact) return exact;
  const ci = roster.find((o) => o.name.toLowerCase() === name.toLowerCase());
  if (ci) return ci;
  return {
    user_id: "",
    name,
    title: "Loan Officer",
    email: "",
    phone: "",
    nmls_id: "",
    specialty: "",
  };
}

export function routeToOfficer(
  _input: Record<string, unknown>,
  profile: PrequalProfile,
  context: PrequalToolContext = {},
): { profile: PrequalProfile; assigned_officer: string; officer: OfficerProfile | null } {
  const officers = context.officers ?? [];
  if (officers.length === 0) {
    return { assigned_officer: "", officer: null, profile: { ...profile } };
  }
  const rng = context.rng ?? Math.random;
  const officer = officers[Math.floor(rng() * officers.length)]!;
  return {
    assigned_officer: officer.name,
    officer,
    profile: { ...profile, assigned_officer: officer.name },
  };
}

/** Read loan-match fields carried on profile (in-memory / client round-trip). */
export function extractLoanMatchFromProfile(
  profile: Record<string, unknown>,
): LoanMatch | null {
  const product_type = profile.product_type as string | undefined;
  const prequal_amount = profile.prequal_amount as number | undefined;
  const loan_amount = profile.loan_amount as number | undefined;
  const down_payment = profile.down_payment as number | undefined;
  const ltv = profile.ltv as number | undefined;
  const estimated_rate = profile.estimated_rate as number | undefined;
  const monthly_payment = profile.monthly_payment as number | undefined;

  if (
    !product_type ||
    prequal_amount == null ||
    loan_amount == null ||
    down_payment == null ||
    ltv == null ||
    estimated_rate == null ||
    monthly_payment == null
  ) {
    return null;
  }

  return {
    product_type,
    prequal_amount,
    loan_amount,
    down_payment,
    ltv,
    estimated_rate,
    monthly_payment,
  };
}

/** Build loan match from letter + profile when match_loan_products was skipped. */
export function buildLoanMatchFromLetter(
  letter: LetterData,
  profile: PrequalProfile,
): LoanMatch {
  const price = letter.purchase_price || profile.target_price || letter.prequal_amount;
  const down = profile.down_payment ?? Math.max(0, price - letter.prequal_amount);
  const loan_amount = Math.max(0, price - down);

  if (profile.annual_income && profile.credit_tier) {
    const { match } = matchLoanProducts(
      {
        target_price: price,
        down_payment: down,
        annual_income: profile.annual_income,
        credit_tier: profile.credit_tier,
        is_veteran: profile.is_veteran ?? false,
        monthly_debts: profile.monthly_debts ?? 0,
      },
      profile,
    );
    return {
      ...match,
      product_type: normalizeLoanProduct(letter.loan_product),
      prequal_amount: letter.prequal_amount,
    };
  }

  const ltv = price > 0 ? Math.round((loan_amount / price) * 100) : 0;
  return {
    product_type: normalizeLoanProduct(letter.loan_product),
    prequal_amount: letter.prequal_amount,
    loan_amount,
    down_payment: down,
    ltv,
    estimated_rate: 7.0,
    monthly_payment: 0,
  };
}

/** Normalize LO pipeline status when a letter was issued. */
export function normalizePipelineStatus(
  status: PipelineRow["status"],
  letterGenerated: boolean,
  sessionCompleted = false,
): PipelineRow["status"] {
  if (letterGenerated || sessionCompleted) return "qualified";
  return status;
}

/**
 * has enough profile data (or is marked completed) to show in the LO dashboard.
 */
export function buildPipelineRowFromProfileOnly(
  sessionId: string,
  sessionStatus: string,
  profile: PrequalProfile,
  guest?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  },
  createdAt?: string,
): PipelineRow | null {
  const borrowerName = profile.borrower_name ?? guest?.name ?? null;
  const borrowerEmail = profile.borrower_email ?? guest?.email ?? null;
  const borrowerPhone = profile.borrower_phone ?? guest?.phone ?? null;
  const hasIdentity = !!(borrowerName || borrowerEmail);
  const hasFinancials =
    profile.target_price != null ||
    profile.back_dti != null ||
    profile.credit_tier != null;
  if (!hasIdentity && !hasFinancials) return null;

  const price = profile.target_price ?? null;
  const down = profile.down_payment ?? 0;
  const sessionCompleted = sessionStatus === "completed";
  const letterReady = sessionCompleted || profile.letter_ready === true;
  const loanAmount = price != null ? Math.max(0, price - down) : null;

  let product: string | null = null;
  let estimatedRate: number | null = null;
  let monthlyPayment: number | null = null;
  if (price != null && profile.annual_income && profile.credit_tier) {
    const { match } = matchLoanProducts(
      {
        target_price: price,
        down_payment: down,
        annual_income: profile.annual_income,
        credit_tier: profile.credit_tier,
        is_veteran: profile.is_veteran ?? false,
        monthly_debts: profile.monthly_debts ?? 0,
      },
      profile,
    );
    product = match.product_type;
    estimatedRate = match.estimated_rate;
    monthlyPayment = match.monthly_payment;
  } else if (profile.is_veteran) {
    product = "VA";
  }

  return {
    session_id: sessionId,
    borrower_name: borrowerName,
    borrower_email: borrowerEmail,
    borrower_phone: borrowerPhone,
    product_type: product,
    prequal_amount: price,
    loan_amount: loanAmount,
    estimated_rate: estimatedRate,
    monthly_payment: monthlyPayment,
    back_dti: profile.back_dti ?? null,
    credit_tier: profile.credit_tier ?? null,
    status: letterReady ? "qualified" : "inquiry",
    letter_generated: letterReady,
    assigned_officer: profile.assigned_officer ?? null,
    created_at: createdAt,
  };
}

/**
 * Resolve the loan match to persist after an agent turn.
 * Handles letter-only turns where match_loan_products ran in a prior request.
 */
export function resolveLoanMatchForPersist(
  loanMatch: LoanMatch | null | undefined,
  profile: Record<string, unknown>,
  letterData: LetterData | null,
): LoanMatch | null {
  if (loanMatch) return loanMatch;

  const fromProfile = extractLoanMatchFromProfile(profile);
  if (fromProfile) return fromProfile;

  if (letterData) {
    return buildLoanMatchFromLetter(letterData, profile as PrequalProfile);
  }

  return null;
}

/** Build the row shape persisted to prequal_loan_matches (LO pipeline). */
export function buildPipelineMatchRow(
  sessionId: string,
  profile: PrequalProfile,
  loanMatch: LoanMatch,
  letterData: LetterData | null,
  assignedOfficer: string | null,
): PipelineRow {
  return {
    session_id: sessionId,
    borrower_name: profile.borrower_name ?? null,
    borrower_email: profile.borrower_email ?? null,
    borrower_phone: profile.borrower_phone ?? null,
    product_type: normalizeLoanProduct(loanMatch.product_type),
    prequal_amount: loanMatch.prequal_amount,
    loan_amount: loanMatch.loan_amount,
    estimated_rate: loanMatch.estimated_rate,
    monthly_payment: loanMatch.monthly_payment,
    back_dti: profile.back_dti ?? null,
    credit_tier: profile.credit_tier ?? null,
    status: letterData ? "qualified" : "pending",
    letter_generated: !!letterData,
    assigned_officer: assignedOfficer,
  };
}

export interface PipelineStats {
  total: number;
  qualified: number;
  pending: number;
  avgPrequal: number;
}

/** Higher = more important when deduping multiple sessions for the same borrower email. */
export function pipelineRowPriority(row: PipelineRow): number {
  const statusRank: Record<PipelineRow["status"], number> = {
    qualified: 50,
    pending: 40,
    referred: 30,
    inquiry: 20,
    declined: 10,
  };
  let score = statusRank[row.status] ?? 0;
  if (row.prequal_amount != null && row.prequal_amount > 0) score += 15;
  if (row.product_type) score += 10;
  if (row.back_dti != null) score += 5;
  if (row.credit_tier) score += 3;
  return score;
}

/**
 * Collapse multiple pipeline rows to one per email (keeps the strongest lead).
 * Not used for the LO dashboard — each pre-qual session is its own row so multiple
 * completed chats for the same borrower are all visible.
 */
export function dedupePipelineByEmail(rows: PipelineRow[]): PipelineRow[] {
  const byEmail = new Map<string, PipelineRow>();

  for (const row of rows) {
    const email = (row.borrower_email ?? "").trim().toLowerCase();
    const key = email || `session:${row.session_id}`;
    const existing = byEmail.get(key);
    if (!existing) {
      byEmail.set(key, row);
      continue;
    }

    const existingPriority = pipelineRowPriority(existing);
    const rowPriority = pipelineRowPriority(row);
    const existingAt = existing.created_at ?? "";
    const rowAt = row.created_at ?? "";

    if (
      rowPriority > existingPriority ||
      (rowPriority === existingPriority && rowAt > existingAt)
    ) {
      byEmail.set(key, row);
    }
  }

  return Array.from(byEmail.values()).sort((a, b) =>
    (b.created_at ?? "").localeCompare(a.created_at ?? ""),
  );
}

export function computePipelineStats(rows: Pick<PipelineRow, "status" | "prequal_amount">[]): PipelineStats {
  const total = rows.length;
  const qualified = rows.filter((r) => r.status === "qualified").length;
  const pending = rows.filter((r) => r.status === "pending" || r.status === "inquiry").length;
  const withAmount = rows.filter((r) => r.prequal_amount != null && r.prequal_amount > 0);
  const avgPrequal = withAmount.length
    ? Math.round(withAmount.reduce((s, r) => s + (r.prequal_amount ?? 0), 0) / withAmount.length)
    : 0;
  return { total, qualified, pending, avgPrequal };
}

export function dtiColorClass(backDti: number | null): string {
  if (!backDti) return "text-muted-foreground";
  if (backDti > 43) return "text-red-500 font-semibold";
  if (backDti > 36) return "text-amber-500 font-semibold";
  return "text-green-600 font-semibold";
}

/**
 * Runs the full deterministic pre-qual tool chain for a borrower scenario.
 * Used by unit tests and smoke scripts (no LLM).
 */
export function runPrequalScenario(input: {
  annual_income: number;
  monthly_debts: number;
  target_price: number;
  down_payment: number;
  credit_tier: string;
  employment_type: string;
  is_veteran?: boolean;
  borrower_name: string;
  session_id?: string;
  officers?: OfficerProfile[];
}) {
  let profile: PrequalProfile = {};

  const extracted = extractFinancials(
    {
      annual_income: input.annual_income,
      monthly_debts: input.monthly_debts,
      target_price: input.target_price,
      down_payment: input.down_payment,
      credit_tier: input.credit_tier,
      employment_type: input.employment_type,
      is_veteran: input.is_veteran ?? false,
    },
    profile,
  );
  profile = extracted.profile;

  const dti = calculateDti(
    {
      annual_income: input.annual_income,
      monthly_debts: input.monthly_debts,
      target_price: input.target_price,
      down_payment: input.down_payment,
    },
    profile,
  );
  profile = dti.profile;

  const matched = matchLoanProducts(
    {
      target_price: input.target_price,
      down_payment: input.down_payment,
      annual_income: input.annual_income,
      credit_tier: input.credit_tier,
      is_veteran: input.is_veteran ?? false,
      monthly_debts: input.monthly_debts,
    },
    profile,
  );
  profile = matched.profile;

  const documents = checkDocumentGaps({
    employment_type: input.employment_type,
    loan_product: matched.match.product_type,
    is_veteran: input.is_veteran ?? false,
  });

  const letter = generatePrequalLetter(
    {
      borrower_name: input.borrower_name,
      prequal_amount: matched.match.prequal_amount,
      loan_product: matched.match.product_type,
      purchase_price: input.target_price,
    },
    profile,
  );
  profile = letter.profile;

  const routed = routeToOfficer(
    { loan_product: matched.match.product_type, credit_tier: input.credit_tier },
    profile,
    { officers: input.officers ?? TEST_OFFICERS, rng: () => 0 },
  );
  profile = routed.profile;

  const sessionId = input.session_id ?? "test-session-id";
  const pipelineRow = buildPipelineMatchRow(
    sessionId,
    profile,
    matched.match,
    letter.letter,
    routed.assigned_officer,
  );

  return {
    profile,
    dti: dti.result,
    loanMatch: matched.match,
    documents,
    letter: letter.letter,
    assignedOfficer: routed.assigned_officer,
    pipelineRow,
    pipelineStats: computePipelineStats([pipelineRow]),
  };
}

export function executeTool(
  name: string,
  input: Record<string, unknown>,
  profile: Record<string, unknown>,
  context: PrequalToolContext = {},
): { result: string; profile: Record<string, unknown> } {
  const p = profile as PrequalProfile;

  if (name === "extract_financials") {
    const { profile: updated, extracted } = extractFinancials(input, p);
    return {
      result: JSON.stringify({ success: true, extracted, profile: updated }),
      profile: updated as Record<string, unknown>,
    };
  }

  if (name === "calculate_dti") {
    const { profile: updated, result } = calculateDti(input, p);
    return { result: JSON.stringify(result), profile: updated as Record<string, unknown> };
  }

  if (name === "match_loan_products") {
    const { profile: updated, match } = matchLoanProducts(input, p);
    return { result: JSON.stringify(match), profile: updated as Record<string, unknown> };
  }

  if (name === "check_document_gaps") {
    const documents = checkDocumentGaps(input);
    return { result: JSON.stringify({ documents }), profile: profile };
  }

  if (name === "generate_prequal_letter") {
    const { profile: updated, letter } = generatePrequalLetter(input, p);
    return {
      result: JSON.stringify({
        success: true,
        ...letter,
        letter_generated: true,
        message: "Letter data ready. PDF will be generated client-side using jsPDF.",
      }),
      profile: { ...updated, letter_data: letter } as Record<string, unknown>,
    };
  }

  if (name === "route_to_officer") {
    const { profile: updated, assigned_officer, officer } = routeToOfficer(input, p, context);
    if (!officer) {
      return {
        result: JSON.stringify({
          error: "No loan officers are configured. Please contact support.",
          assigned_officer: null,
        }),
        profile: updated as Record<string, unknown>,
      };
    }
    return {
      result: JSON.stringify({
        assigned_officer,
        user_id: officer.user_id,
        name: officer.name,
        title: officer.title,
        email: officer.email,
        phone: officer.phone,
        nmls_id: officer.nmls_id,
        specialty: officer.specialty,
        followup_hours: 24,
        messaging_guidance:
          "Tell the borrower their loan officer will get back to them within 24 hours. Do NOT tell them to reach out, contact the officer, or ask the officer questions — the officer initiates follow-up.",
      }),
      profile: updated as Record<string, unknown>,
    };
  }

  return { result: JSON.stringify({ error: "Unknown tool" }), profile };
}
