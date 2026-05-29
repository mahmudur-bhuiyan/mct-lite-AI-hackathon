
## Context

`/loans/:id` (`src/pages/LoanDetail.tsx`) renders ~30 cards/tabs across:

- Header actions (Edit, File Risk, Generate Document, Loan Coach, AI Chat)
- Underwriter Assignment
- Data Foundation tabs (Credit, Employment, Property Valuation)
- Application Data tabs (Assets, Liabilities, REO, Declarations)
- Documents (Checklist + Documents panel)
- Eligibility
- Phase 3 grid: Closing Costs, Compliance Run, QC Checklist, AUS, HMDA, Best Execution, Rate Lock, Investor Submission
- Phase 5 grid: Settlement Orders, Appraisal, RON, Digital Closing, Adverse Action
- Workflow: SLA, Borrower Portal, Milestones, Conditions, UW Scorecard, Compliance Checklist, Timeline, Communications
- Borrower Portal: Messages, DocuSign disclosures

## Root cause of the errors

The page itself renders fine. The errors fire when a card mounts or a button is clicked because the corresponding edge function / hook queries a Postgres table that does not exist in the project's database. Confirmed runtime errors so far:

- `calculate-closing-costs` → missing `public.loan_fee_estimates`
- `rate-locks` → missing `public.rate_locks` (and `rate_lock_history`)
- `run-compliance-rules` → missing `public.compliance_rule_runs`

Doing a `from(...)` audit across `src/` and `supabase/functions/` shows ~80 distinct tables referenced. The database currently has only **23 tables**. The complete list of missing tables that the LoanDetail page touches (directly or transitively) includes:

```
action_items, aus_submissions, badge_definitions, borrower_communications,
borrower_consents, borrower_portal_audit, borrower_portal_invites, branches,
compliance_rule_runs, compliance_rules, compliance_screenings,
condition_workflow_rules, credit_reports, document_types, email_attachments,
email_messages, employment_verifications, fee_template_versions,
hmda_lar_entries, hmda_report_runs, investor_submissions, loan_adverse_actions,
loan_appraisal_orders, loan_assets, loan_borrower_uploads, loan_conditions,
loan_declarations, loan_digital_closing, loan_disclosures, loan_documents,
loan_fee_estimates, loan_liabilities, loan_milestones, loan_pricing_calculations,
loan_pricing_snapshots, loan_products, loan_programs, loan_qc_results,
loan_reo, loan_risk_alerts, loan_risk_scores, loan_ron_sessions,
loan_settlement_orders, loan_stage_transitions, loan_timeline_events,
lock_alerts, nmls_licenses, pipeline_priority_scores, portal_messages,
program_document_requirements, property_valuations, qc_checklist_templates,
rate_alert_analyses, rate_lock_history, rate_locks, rate_sheet_datastores,
rate_sheet_products, rate_sheets, rate_tier_config, sla_configurations,
underwriting_prechecks, zoom_files
```

That is ~60 tables with foreign keys, indexes, RLS policies, GRANTs, and seed/lookup data — multiple days of focused backend work, and a high-risk change that won't have any test data behind it.

## Recommended approaches — pick one

### Option A — Resilience pass (small, safe, ~1 short loop)

Make every loan-detail card detect a "table missing" / `PGRST205` / 500 error and render a friendly "Not configured yet — backend module not enabled" empty state instead of throwing/red toasts. No DB changes. Errors stop, page stays usable, nothing pretends to work.

Pros: small, deterministic, no migration risk. Cons: features remain non-functional until backend is built.

### Option B — Targeted build-out (medium, scoped to a few sections you actually use)

You pick which sections of the page must actually work end-to-end (e.g. "Rate Lock + Closing Costs + Conditions + Milestones") and I build only those tables, RLS, GRANTs, and verify the edge functions / cards. Everything else gets Option A treatment.

Pros: real working features where you need them. Cons: still meaningful migration work; needs your prioritization.

### Option C — Full schema build-out (large, multi-loop)

Recreate every missing table with sensible columns inferred from the edge functions, plus RLS, GRANTs, and minimal seed data. This is the right end-state but is realistically several iterations and will need round-trips to fix mismatched column shapes vs. what each edge function expects.

## What I'll do once you pick

In all options I will also:

1. Fix the three already-confirmed 500s (`loan_fee_estimates`, `rate_locks`, `compliance_rule_runs`) per the chosen option (graceful empty state in A, real table in B/C).
2. Update each phase card to wrap its data fetch in a single shared `useGracefulModule` style helper so future missing-table errors are caught consistently and never toast a raw 500.
3. Verify in the browser by visiting `/loans/fc43567c-…` and clicking through each card.

## Question for you

Which option do you want — **A (quiet the errors), B (tell me which sections to actually build), or C (build the whole backend)?** If B, list the section names from the bullet list at the top.
