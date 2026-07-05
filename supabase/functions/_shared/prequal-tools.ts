/**
 * Deterministic pre-qualification tool implementations.
 * Shared by prequal-agent edge function and frontend unit tests.
 */

export const PROFILE_COLUMNS = new Set([
  "borrower_name",
  "borrower_email",
  "borrower_phone",
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
]);

export interface PrequalProfile {
  borrower_name?: string;
  borrower_email?: string;
  borrower_phone?: string;
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
  const letter: LetterData = {
    borrower_name: input.borrower_name as string,
    prequal_amount: input.prequal_amount as number,
    loan_product: input.loan_product as string,
    purchase_price: input.purchase_price as number,
  };
  return {
    letter,
    profile: { ...profile, borrower_name: letter.borrower_name, letter_ready: true },
  };
}

export interface OfficerProfile {
  name: string;
  title: string;
  email: string;
  phone: string;
  nmls_id: string;
  specialty: string;
}

const OFFICER_ROSTER: OfficerProfile[] = [
  {
    name: "James Rodriguez",
    title: "VA Loan Specialist",
    email: "james.rodriguez@mctmortgage.com",
    phone: "(555) 201-4401",
    nmls_id: "1847201",
    specialty: "VA & military home loans",
  },
  {
    name: "Patricia Chen",
    title: "VA Loan Specialist",
    email: "patricia.chen@mctmortgage.com",
    phone: "(555) 201-4402",
    nmls_id: "1928340",
    specialty: "VA & military home loans",
  },
  {
    name: "David Thompson",
    title: "FHA Loan Specialist",
    email: "david.thompson@mctmortgage.com",
    phone: "(555) 201-4501",
    nmls_id: "1765092",
    specialty: "FHA & first-time buyers",
  },
  {
    name: "Maria Santos",
    title: "FHA Loan Specialist",
    email: "maria.santos@mctmortgage.com",
    phone: "(555) 201-4502",
    nmls_id: "2011847",
    specialty: "FHA & first-time buyers",
  },
  {
    name: "Sarah Mitchell",
    title: "Senior Mortgage Specialist",
    email: "sarah.mitchell@mctmortgage.com",
    phone: "(555) 201-4601",
    nmls_id: "1583921",
    specialty: "Conventional loans",
  },
  {
    name: "Robert Kim",
    title: "Senior Mortgage Specialist",
    email: "robert.kim@mctmortgage.com",
    phone: "(555) 201-4602",
    nmls_id: "1638475",
    specialty: "Conventional loans",
  },
  {
    name: "Linda Foster",
    title: "USDA Loan Specialist",
    email: "linda.foster@mctmortgage.com",
    phone: "(555) 201-4701",
    nmls_id: "1892043",
    specialty: "USDA rural development loans",
  },
  {
    name: "Mark Williams",
    title: "USDA Loan Specialist",
    email: "mark.williams@mctmortgage.com",
    phone: "(555) 201-4702",
    nmls_id: "1746298",
    specialty: "USDA rural development loans",
  },
];

const OFFICERS_BY_PRODUCT: Record<string, string[]> = {
  VA: ["James Rodriguez", "Patricia Chen"],
  FHA: ["David Thompson", "Maria Santos"],
  Conventional: ["Sarah Mitchell", "Robert Kim"],
  USDA: ["Linda Foster", "Mark Williams"],
};

const OFFICERS_BY_NAME = new Map(OFFICER_ROSTER.map((o) => [o.name, o]));

/** Look up full loan-officer details by display name (pipeline stores name only). */
export function getOfficerProfile(name: string | null | undefined): OfficerProfile | null {
  if (!name) return null;
  return OFFICERS_BY_NAME.get(name) ?? null;
}

export function routeToOfficer(
  input: Record<string, unknown>,
  profile: PrequalProfile,
  rng: () => number = Math.random,
): { profile: PrequalProfile; assigned_officer: string; officer: OfficerProfile } {
  const list = OFFICERS_BY_PRODUCT[input.loan_product as string] ?? ["Sarah Mitchell"];
  const assigned = list[Math.floor(rng() * list.length)];
  const officer = OFFICERS_BY_NAME.get(assigned)!;
  return {
    assigned_officer: assigned,
    officer,
    profile: { ...profile, assigned_officer: assigned },
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
      product_type: letter.loan_product,
      prequal_amount: letter.prequal_amount,
    };
  }

  const ltv = price > 0 ? Math.round((loan_amount / price) * 100) : 0;
  return {
    product_type: letter.loan_product,
    prequal_amount: letter.prequal_amount,
    loan_amount,
    down_payment: down,
    ltv,
    estimated_rate: 7.0,
    monthly_payment: 0,
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
    product_type: loanMatch.product_type,
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
    () => 0,
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
    const { profile: updated, assigned_officer, officer } = routeToOfficer(input, p);
    return {
      result: JSON.stringify({
        assigned_officer,
        title: officer.title,
        email: officer.email,
        phone: officer.phone,
        nmls_id: officer.nmls_id,
        specialty: officer.specialty,
        followup_hours: 24,
      }),
      profile: updated as Record<string, unknown>,
    };
  }

  return { result: JSON.stringify({ error: "Unknown tool" }), profile };
}
