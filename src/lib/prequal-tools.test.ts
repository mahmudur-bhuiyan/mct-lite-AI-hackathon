import { describe, it, expect } from "vitest";
import {
  runPrequalScenario,
  computePipelineStats,
  buildPipelineMatchRow,
  calculateDti,
  matchLoanProducts,
  checkDocumentGaps,
  dtiColorClass,
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

    expect(result.assignedOfficer).toBe("Sarah Mitchell");

    expect(result.pipelineRow).toMatchObject({
      session_id: "sess-abc-123",
      borrower_name: "John Smith",
      product_type: "Conventional",
      status: "qualified",
      letter_generated: true,
      assigned_officer: "Sarah Mitchell",
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
    expect(["James Rodriguez", "Patricia Chen"]).toContain(assignedOfficer);
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
        "Sarah Mitchell",
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
});
