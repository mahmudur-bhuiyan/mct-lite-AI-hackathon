/**
 * Mortgage pipeline export: loan-level CSV/TSV and manager summary CSV.
 * Dates use ISO 8601 for machine-friendly re-import and sorting.
 */

import type { Loan } from "@/hooks/useLoans";
import { downloadTextFile } from "@/lib/export-utils";

export type PipelineExportLoan = Loan & {
  risk_level?: string | null;
  /** Latest saved pricing snapshot winner investor (loan_pricing_snapshots), if any. */
  pricing_investor_code?: string | null;
};

/** Base name for downloaded files, e.g. mct-pipeline-loans-2026-03-29 */
export function pipelineExportFilename(prefix: string): string {
  const d = new Date().toISOString().split("T")[0];
  return `mct-${prefix}-${d}`;
}

export interface ManagerDashboardSummaryInput {
  metrics: {
    activeLoans: number;
    atRiskLoans: number;
    lockExpiringSoon: number;
    onTimeRate: number;
  };
  pipeline: { status: string; count: number }[];
  bottlenecks: { id: string; label: string; loanCount: number }[];
  generatedAt: string;
  locksExpiring?: {
    loanNumber: string;
    lockExpiration: string;
    loanStatus: string;
    investorStatus: string | null;
  }[];
}

const LOAN_CSV_HEADERS = [
  "loan_id",
  "loan_number",
  "external_id",
  "data_source",
  "status",
  "risk_level",
  "borrower_id",
  "borrower_first_name",
  "borrower_last_name",
  "borrower_email",
  "loan_officer_id",
  "branch_id",
  "loan_amount",
  "appraised_value",
  "ltv",
  "credit_score",
  "dti",
  "purpose",
  "occupancy_type",
  "property_address",
  "property_city",
  "property_state",
  "property_postal_code",
  "lock_date",
  "lock_expiration_date",
  "pricing_investor_code",
  "created_at",
  "updated_at",
] as const;

/** Exposed for unit tests */
export function escapeCsvCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

function isoOrEmpty(d: string | null | undefined): string {
  if (!d) return "";
  const t = Date.parse(d);
  if (Number.isNaN(t)) return d;
  return new Date(t).toISOString();
}

function loanToRow(loan: PipelineExportLoan): string[] {
  const b = loan.borrowers;
  return [
    loan.id,
    loan.loan_number,
    loan.external_id ?? "",
    loan.data_source ?? "",
    loan.status,
    loan.risk_level ?? "",
    loan.borrower_id,
    b?.first_name ?? "",
    b?.last_name ?? "",
    b?.email ?? "",
    loan.loan_officer_id,
    loan.branch_id ?? "",
    loan.loan_amount != null ? String(loan.loan_amount) : "",
    loan.appraised_value != null ? String(loan.appraised_value) : "",
    loan.ltv != null ? String(loan.ltv) : "",
    loan.credit_score != null ? String(loan.credit_score) : "",
    loan.dti != null ? String(loan.dti) : "",
    loan.purpose ?? "",
    loan.occupancy_type ?? "",
    loan.property_address ?? "",
    loan.property_city ?? "",
    loan.property_state ?? "",
    loan.property_postal_code ?? "",
    isoOrEmpty(loan.lock_date ?? undefined),
    isoOrEmpty(loan.lock_expiration_date ?? undefined),
    loan.pricing_investor_code ?? "",
    isoOrEmpty(loan.created_at),
    isoOrEmpty(loan.updated_at),
  ];
}

export function exportLoanPipelineToCSV(loans: PipelineExportLoan[], filenameBase: string): void {
  if (!loans.length) {
    throw new Error("No loans to export");
  }
  const lines = [
    LOAN_CSV_HEADERS.join(","),
    ...loans.map((loan) => loanToRow(loan).map(escapeCsvCell).join(",")),
  ];
  downloadTextFile(lines.join("\n"), `${filenameBase}.csv`, "text/csv;charset=utf-8;");
}

function escapeTsvCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return s.replace(/\r?\n/g, " ").replace(/\t/g, " ");
}

export function exportLoanPipelineToExcel(loans: PipelineExportLoan[], filenameBase: string): void {
  if (!loans.length) {
    throw new Error("No loans to export");
  }
  const lines = [
    [...LOAN_CSV_HEADERS].join("\t"),
    ...loans.map((loan) => loanToRow(loan).map(escapeTsvCell).join("\t")),
  ];
  downloadTextFile(
    lines.join("\n"),
    `${filenameBase}.xls`,
    "application/vnd.ms-excel;charset=utf-8;",
  );
}

export function exportManagerDashboardSummaryToCSV(
  input: ManagerDashboardSummaryInput,
  filenameBase: string,
): void {
  const rows: string[][] = [
    ["type", "name", "value"],
    ["metric", "generated_at", input.generatedAt],
    ["metric", "active_loans", String(input.metrics.activeLoans)],
    ["metric", "at_risk_loans", String(input.metrics.atRiskLoans)],
    ["metric", "lock_expiring_7d", String(input.metrics.lockExpiringSoon)],
    ["metric", "on_time_rate_pct", String(input.metrics.onTimeRate)],
  ];
  for (const p of input.pipeline) {
    rows.push(["pipeline_status", p.status, String(p.count)]);
  }
  for (const b of input.bottlenecks) {
    rows.push(["bottleneck", `${b.id}:${b.label}`, String(b.loanCount)]);
  }
  for (const row of input.locksExpiring ?? []) {
    rows.push([
      "lock_expiring",
      row.loanNumber,
      `${row.lockExpiration}|${row.loanStatus}|${row.investorStatus ?? ""}`,
    ]);
  }
  const csvContent = rows.map((r) => r.map(escapeCsvCell).join(",")).join("\n");
  downloadTextFile(csvContent, `${filenameBase}.csv`, "text/csv;charset=utf-8;");
}
