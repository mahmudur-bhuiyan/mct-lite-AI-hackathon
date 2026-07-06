import { describe, it, expect } from "vitest";
import {
  runPrequalScenario,
  computePipelineStats,
  buildPipelineMatchRow,
  calculateDti,
  matchLoanProducts,
  checkDocumentGaps,
  dtiColorClass,
  resolveLoanMatchForPersist,
  extractLoanMatchFromProfile,
  extractFinancials,
  formatSessionTitle,
  getOfficerProfile,
  limitGuestResumeSessions,
  inferLetterFromAssistantMessage,
  inferOfficerFromAssistantMessage,
  mergeBorrowerSnapshotIntoProfile,
  normalizePipelineStatus,
  buildPipelineRowFromProfileOnly,
  TEST_OFFICERS,
} from "../../supabase/functions/_shared/prequal-tools";

describe("prequal-agent deterministic tools", () => {
  it("full borrower scenario: extract → DTI → match → docs → letter → LO pipeline row", () => {
    const result = runPrequalScenario({
      annual_income: 120_000,
      monthly_debts: 800,
      target_price: 450_000,
      down_payment: 45_000,
      credit_tier: "good",
      employment_type: "w2",
      is_veteran: false,
      borrower_name: "John Smith",
      session_id: "sess-abc-123",
    });

    expect(result.profile.borrower_name).toBe("John Smith");
    expect(result.profile.annual_income).toBe(120_000);
    expect(result.profile.target_price).toBe(450_000);
    expect(result.profile.credit_tier).toBe("good");

    expect(result.dti.back_dti).toBeGreaterThan(0);
    expect(result.dti.back_dti).toBeLessThanOrEqual(43);
    expect(result.dti.status).toMatch(/excellent|acceptable/);

    expect(result.loanMatch.product_type).toBe("Conventional");
    expect(result.loanMatch.ltv).toBe(90);
    expect(result.loanMatch.prequal_amount).toBeGreaterThan(0);
    expect(result.loanMatch.monthly_payment).toBeGreaterThan(0);

    expect(result.documents).toContain("W-2 forms (last 2 years)");
    expect(result.documents).toContain("Pay stubs (last 30 days)");

    expect(result.letter.borrower_name).toBe("John Smith");
    expect(result.letter.prequal_amount).toBe(result.loanMatch.prequal_amount);
    expect(result.letter.loan_product).toBe("Conventional");

    expect(result.assignedOfficer).toBe("Cristiano Ronaldo");
    expect(getOfficerProfile(result.assignedOfficer, TEST_OFFICERS)).toMatchObject({
      name: "Cristiano Ronaldo",
      title: "Loan Officer",
      email: "cristiano.ronaldo@gmail.com",
    });

    expect(result.pipelineRow).toMatchObject({
      session_id: "sess-abc-123",
      borrower_name: "John Smith",
      product_type: "Conventional",
      status: "qualified",
      letter_generated: true,
      assigned_officer: "Cristiano Ronaldo",
    });

    expect(result.pipelineStats).toEqual({
      total: 1,
      qualified: 1,
      pending: 0,
      avgPrequal: result.loanMatch.prequal_amount,
    });
  });

  it("routes veterans to VA product", () => {
    const { loanMatch, assignedOfficer } = runPrequalScenario({
      annual_income: 95_000,
      monthly_debts: 500,
      target_price: 380_000,
      down_payment: 0,
      credit_tier: "good",
      employment_type: "w2",
      is_veteran: true,
      borrower_name: "Maria Garcia",
    });

    expect(loanMatch.product_type).toBe("VA");
    expect(["Cristiano Ronaldo", "Neymar Jr"]).toContain(assignedOfficer);
    expect(checkDocumentGaps({ employment_type: "w2", loan_product: "VA" })).toContain(
      "Certificate of Eligibility (VA Form 26-1880)",
    );
  });

  it("computePipelineStats aggregates mixed statuses", () => {
    const rows = [
      buildPipelineMatchRow(
        "a",
        { borrower_name: "A" },
        {
          product_type: "Conventional",
          prequal_amount: 400_000,
          loan_amount: 360_000,
          down_payment: 40_000,
          ltv: 90,
          estimated_rate: 7,
          monthly_payment: 2400,
        },
        { borrower_name: "A", prequal_amount: 400_000, loan_product: "Conventional", purchase_price: 400_000 },
        "Cristiano Ronaldo",
      ),
      buildPipelineMatchRow(
        "b",
        { credit_tier: "fair" },
        {
          product_type: "FHA",
          prequal_amount: 300_000,
          loan_amount: 285_000,
          down_payment: 15_000,
          ltv: 95,
          estimated_rate: 7.85,
          monthly_payment: 2100,
        },
        null,
        null,
      ),
    ];

    expect(computePipelineStats(rows)).toEqual({
      total: 2,
      qualified: 1,
      pending: 1,
      avgPrequal: 350_000,
    });
  });

  it("calculateDti flags high back-end ratio", () => {
    const { result } = calculateDti(
      {
        annual_income: 60_000,
        monthly_debts: 2_500,
        target_price: 400_000,
        down_payment: 20_000,
      },
      {},
    );
    expect(result.status).toBe("high");
    expect(result.back_dti).toBeGreaterThan(43);
    expect(dtiColorClass(result.back_dti)).toBe("text-red-500 font-semibold");
  });

  it("matchLoanProducts selects FHA for low down payment", () => {
    const { match } = matchLoanProducts(
      {
        target_price: 350_000,
        down_payment: 10_000,
        annual_income: 80_000,
        credit_tier: "good",
        monthly_debts: 600,
      },
      {},
    );
    expect(match.product_type).toBe("FHA");
  });

  it("resolveLoanMatchForPersist builds from letter when match tool was skipped", () => {
    const letter = {
      borrower_name: "Mahmudur Bhuiyan",
      prequal_amount: 80_000,
      loan_product: "Conventional",
      purchase_price: 100_000,
    };
    const profile = {
      borrower_name: "Mahmudur Bhuiyan",
      annual_income: 200_000,
      monthly_debts: 0,
      target_price: 100_000,
      down_payment: 20_000,
      credit_tier: "excellent",
    };

    const resolved = resolveLoanMatchForPersist(null, profile, letter);
    expect(resolved).not.toBeNull();
    expect(resolved!.product_type).toBe("Conventional");
    expect(resolved!.prequal_amount).toBe(80_000);
    expect(resolved!.loan_amount).toBe(80_000);
  });

  it("resolveLoanMatchForPersist reuses match fields on profile from prior turn", () => {
    const carried = {
      product_type: "Conventional",
      prequal_amount: 450_000,
      loan_amount: 405_000,
      down_payment: 45_000,
      ltv: 90,
      estimated_rate: 7.1,
      monthly_payment: 2720,
    };
    expect(extractLoanMatchFromProfile(carried)).toEqual(carried);
    expect(resolveLoanMatchForPersist(null, carried, null)).toEqual(carried);
  });

  it("inferLetterFromAssistantMessage recovers letter data from congratulations text", () => {
    const messages = [
      {
        role: "assistant",
        content:
          "Congratulations, Lana! You've been pre-qualified for a VA loan up to $450,000. Purchase Price: $450,000",
      },
    ];
    const letter = inferLetterFromAssistantMessage(messages, {
      borrower_name: "Lana Kennedy",
      is_veteran: true,
    });
    expect(letter?.prequal_amount).toBe(450_000);
    expect(letter?.loan_product).toBe("VA");
  });

  it("inferOfficerFromAssistantMessage recovers LO name from closing message", () => {
    const messages = [
      {
        role: "assistant",
        content:
          "Your assigned loan officer, **Neymar Jr**, will reach out within 24 hours.",
      },
    ];
    expect(inferOfficerFromAssistantMessage(messages)).toBe("Neymar Jr");
  });

  it("mergeBorrowerSnapshotIntoProfile fills missing identity from borrowers row", () => {
    const merged = mergeBorrowerSnapshotIntoProfile(
      { borrower_name: "Lana Kennedy", borrower_email: "lana@example.com" },
      {
        first_name: "Lana",
        last_name: "Kennedy",
        email: "lana@example.com",
        phone: "+1 (555) 123-4567",
      },
    );
    expect(merged.borrower_phone).toBe("+1 (555) 123-4567");
    expect(merged.borrower_name).toBe("Lana Kennedy");
  });

  it("formatSessionTitle uses the borrower's message as the chat name", () => {
    expect(formatSessionTitle("condo in 45 k")).toBe("condo in 45 k");
    expect(formatSessionTitle("  duplex 100k  ")).toBe("duplex 100k");
    expect(formatSessionTitle("")).toBeNull();
    const long = formatSessionTitle("looking for a condo around 450k");
    expect(long?.endsWith("…")).toBe(true);
    expect(long!.length).toBeLessThanOrEqual(20);
  });

  it("limitGuestResumeSessions caps welcome-back list at 2 active + 1 completed", () => {
    const sessions = [
      { id: "a1", status: "active", updated_at: "2026-07-06T10:00:00Z" },
      { id: "a2", status: "active", updated_at: "2026-07-06T09:00:00Z" },
      { id: "a3", status: "active", updated_at: "2026-07-06T08:00:00Z" },
      { id: "c1", status: "completed", updated_at: "2026-07-06T07:00:00Z" },
      { id: "c2", status: "completed", updated_at: "2026-07-06T06:00:00Z" },
      { id: "x1", status: "abandoned", updated_at: "2026-07-06T11:00:00Z" },
    ];

    const limited = limitGuestResumeSessions(sessions);
    expect(limited.map((s) => s.id)).toEqual(["a1", "a2", "c1"]);
    expect(limited).toHaveLength(3);
  });

  it("limitGuestResumeSessions returns fewer when only one active and one completed exist", () => {
    const sessions = [
      { id: "a1", status: "active", updated_at: "2026-07-06T10:00:00Z" },
      { id: "c1", status: "completed", updated_at: "2026-07-06T09:00:00Z" },
    ];

    expect(limitGuestResumeSessions(sessions).map((s) => s.id)).toEqual(["a1", "c1"]);
  });

  it("extractFinancials stores name/email and ignores empty/unknown fields", () => {
    const { profile, extracted } = extractFinancials(
      {
        borrower_name: "  Jane Doe  ",
        borrower_email: "jane@example.com",
        target_price: 100_000,
        annual_income: null,
        monthly_debts: "",
        not_a_field: "ignore me",
      },
      { annual_income: 200_000 },
    );

    expect(extracted).toEqual({
      borrower_name: "Jane Doe",
      borrower_email: "jane@example.com",
      target_price: 100_000,
    });
    expect(profile).toEqual({
      annual_income: 200_000,
      borrower_name: "Jane Doe",
      borrower_email: "jane@example.com",
      target_price: 100_000,
    });
  });

  it("normalizePipelineStatus promotes letter holders to qualified", () => {
    expect(normalizePipelineStatus("pending", true)).toBe("qualified");
    expect(normalizePipelineStatus("inquiry", false, true)).toBe("qualified");
    expect(normalizePipelineStatus("pending", false)).toBe("pending");
  });

  it("buildPipelineRowFromProfileOnly marks completed sessions as qualified", () => {
    const row = buildPipelineRowFromProfileOnly(
      "sess-1",
      "completed",
      {
        borrower_name: "Josh Inglis",
        target_price: 350_000,
        back_dti: 28.5,
        credit_tier: "excellent",
        letter_ready: true,
      },
      { email: "josh@example.com" },
      "2026-07-06T00:00:00Z",
    );
    expect(row?.status).toBe("qualified");
    expect(row?.letter_generated).toBe(true);
  });

  it("extractFinancials stores mailing address fields", () => {
    const { profile } = extractFinancials(
      {
        street_address: "123 Main St",
        city: "Austin",
        state: "tx",
        postal_code: "78701",
      },
      {},
    );
    expect(profile).toMatchObject({
      street_address: "123 Main St",
      city: "Austin",
      state: "TX",
      postal_code: "78701",
    });
  });
});
