/**
 * Deterministic pre-qualification tool implementations.
 * Shared by prequal-agent edge function and frontend unit tests.
 */

export const PROFILE_COLUMNS = new Set([
  "borrower_name",
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
  product_type: string;
  prequal_amount: number;
  loan_amount: number;
  estimated_rate: number;
  monthly_payment: number;
  back_dti: number | null;
  credit_tier: string | null;
  status: "pending" | "qualified" | "referred" | "declined";
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

export function extractFinancials(
  input: Record<string, unknown>,
  profile: PrequalProfile,
): { profile: PrequalProfile; extracted: Record<string, unknown> } {
  const extracted = { ...input };
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

const OFFICERS: Record<string, string[]> = {
  VA: ["James Rodriguez", "Patricia Chen"],
  FHA: ["David Thompson", "Maria Santos"],
  Conventional: ["Sarah Mitchell", "Robert Kim"],
  USDA: ["Linda Foster", "Mark Williams"],
};

export function routeToOfficer(
  input: Record<string, unknown>,
  profile: PrequalProfile,
  rng: () => number = Math.random,
): { profile: PrequalProfile; assigned_officer: string } {
  const list = OFFICERS[input.loan_product as string] ?? ["Sarah Mitchell"];
  const assigned = list[Math.floor(rng() * list.length)];
  return { assigned_officer: assigned, profile: { ...profile, assigned_officer: assigned } };
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
  const pending = rows.filter((r) => r.status === "pending").length;
  const avgPrequal = total
    ? Math.round(rows.reduce((s, r) => s + r.prequal_amount, 0) / total)
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
    const { profile: updated, assigned_officer } = routeToOfficer(input, p);
    return {
      result: JSON.stringify({ assigned_officer, followup_hours: 24 }),
      profile: updated as Record<string, unknown>,
    };
  }

  return { result: JSON.stringify({ error: "Unknown tool" }), profile };
}
