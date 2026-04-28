import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export interface PipelineStageStat {
  status: string;
  count: number;
}

export interface RiskHeatmapRow {
  loanOfficerId: string;
  loanOfficerName: string;
  totalLoans: number;
  low: number;
  medium: number;
  high: number;
  critical: number;
}

export interface BottleneckStat {
  id: string;
  label: string;
  description: string;
  loanCount: number;
}

export interface ManagerMetrics {
  activeLoans: number;
  atRiskLoans: number;
  lockExpiringSoon: number;
  onTimeRate: number;
}

export interface LocksExpiringRow {
  loanId: string;
  loanNumber: string;
  lockExpiration: string;
  loanStatus: string;
  investorStatus: string | null;
}

export interface LoanDetailRow {
  loanId: string;
  loanNumber: string;
  loanStatus: string;
  loanOfficerName: string;
  riskLevel: string;
  updatedAt: string;
}

export interface ManagerDashboardData {
  pipeline: PipelineStageStat[];
  riskByOfficer: RiskHeatmapRow[];
  bottlenecks: BottleneckStat[];
  metrics: ManagerMetrics;
  locksExpiring: LocksExpiringRow[];
  activeLoansDetail: LoanDetailRow[];
  atRiskLoansDetail: LoanDetailRow[];
  onTimeLoansDetail: LoanDetailRow[];
  untouchedSummary: {
    over7Days: number;
    over21Days: number;
  };
  untouchedLoans: Array<{
    loanId: string;
    loanNumber: string;
    loanStatus: string;
    untouchedDays: number;
    loanOfficerId: string | null;
    loanOfficerName: string;
    loanOfficerEmail: string | null;
  }>;
  teamActivity: Array<{
    loanOfficerId: string;
    loanOfficerName: string;
    loanOfficerEmail: string | null;
    totalLoans: number;
    untouched7Plus: number;
    untouched21Plus: number;
  }>;
}

interface LoanRow {
  id: string;
  loan_number: string;
  status: string;
  loan_officer_id: string;
  created_at: string;
  updated_at: string;
  lock_expiration_date: string | null;
}

interface RiskScoreRow {
  loan_id: string;
  risk_level: string;
}

interface ProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
}

export function useManagerDashboard() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["manager-dashboard"],
    queryFn: async (): Promise<ManagerDashboardData> => {
      if (!user) {
        throw new Error("User not authenticated");
      }

      const now = new Date();
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const todayStr = now.toISOString().slice(0, 10);
      const weekEndStr = sevenDaysFromNow.toISOString().slice(0, 10);

      const [loansRes, riskRes, locksRes] = await Promise.all([
        supabase
          .from("loans")
          .select(
            "id, loan_number, status, loan_officer_id, created_at, updated_at, lock_expiration_date",
          )
          .order("created_at", { ascending: false }),
        (supabase as any)
          .from("loan_risk_scores")
          .select("loan_id, risk_level"),
        supabase
          .from("rate_locks")
          .select("loan_id, lock_expiration")
          .in("status", ["active", "extended", "relocked"])
          .gte("lock_expiration", todayStr)
          .lte("lock_expiration", weekEndStr),
      ]);

      if (loansRes.error) throw loansRes.error;
      if (riskRes.error) throw riskRes.error;
      if (locksRes.error) throw locksRes.error;

      const loans = (loansRes.data ?? []) as LoanRow[];
      const riskScores = (riskRes.data ?? []) as RiskScoreRow[];

      const riskByLoanId = new Map<string, RiskScoreRow>();
      for (const r of riskScores) {
        riskByLoanId.set(r.loan_id, r);
      }

      // Pipeline funnel: counts by status within current RLS scope.
      const pipelineMap = new Map<string, number>();
      for (const loan of loans) {
        const status = loan.status || "unknown";
        pipelineMap.set(status, (pipelineMap.get(status) ?? 0) + 1);
      }

      const pipeline: PipelineStageStat[] = Array.from(pipelineMap.entries())
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => a.status.localeCompare(b.status));

      // Metrics
      const activeLoans = loans.filter((l) => l.status !== "closed").length;

      const atRiskLoansSet = new Set<string>();
      for (const loan of loans) {
        const risk = riskByLoanId.get(loan.id);
        if (risk && (risk.risk_level === "high" || risk.risk_level === "critical")) {
          atRiskLoansSet.add(loan.id);
        }
      }

      const fromLoanDates = new Set<string>();
      for (const l of loans) {
        if (l.status === "closed" || !l.lock_expiration_date) continue;
        const lockDate = new Date(l.lock_expiration_date);
        if (lockDate >= now && lockDate <= sevenDaysFromNow) fromLoanDates.add(l.id);
      }
      const fromRateLocks = new Set(
        (locksRes.data ?? []).map((r: { loan_id: string }) => r.loan_id),
      );
      const mergedExpiring = new Set<string>([...fromLoanDates, ...fromRateLocks]);
      const lockExpiringSoon = mergedExpiring.size;

      const atRiskLoans = atRiskLoansSet.size;
      const onTimeRate =
        activeLoans === 0 ? 100 : Math.max(0, Math.min(100, Math.round(((activeLoans - atRiskLoans) / activeLoans) * 100)));

      const metrics: ManagerMetrics = {
        activeLoans,
        atRiskLoans,
        lockExpiringSoon,
        onTimeRate,
      };

      // Bottlenecks: basic view using status + age.
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);

      let stuckOver30 = 0;
      let stuck15To30 = 0;
      let inFlight = 0;

      for (const loan of loans) {
        if (loan.status === "application" || loan.status === "processing") {
          const lastTouch = loan.updated_at ? new Date(loan.updated_at) : new Date(loan.created_at);
          if (lastTouch < thirtyDaysAgo) {
            stuckOver30 += 1;
          } else if (lastTouch < fifteenDaysAgo) {
            stuck15To30 += 1;
          } else {
            inFlight += 1;
          }
        }
      }

      const bottlenecks: BottleneckStat[] = [
        {
          id: "stuck_over_30",
          label: "Stuck > 30 days",
          description: "Loans in Application/Processing with no movement for more than 30 days.",
          loanCount: stuckOver30,
        },
        {
          id: "stuck_15_30",
          label: "Stuck 15–30 days",
          description: "Loans with limited movement in the last 15–30 days.",
          loanCount: stuck15To30,
        },
        {
          id: "in_flight",
          label: "In-flight this month",
          description: "Recently touched Application/Processing loans.",
          loanCount: inFlight,
        },
      ].sort((a, b) => b.loanCount - a.loanCount);

      // Risk by loan officer heatmap (rows = officer, columns = risk level).
      const officerMap = new Map<string, RiskHeatmapRow>();

      for (const loan of loans) {
        if (!loan.loan_officer_id) continue;
        const officerId = loan.loan_officer_id;
        const risk = riskByLoanId.get(loan.id);
        const level = (risk?.risk_level ?? "low") as keyof Omit<RiskHeatmapRow, "loanOfficerId" | "loanOfficerName" | "totalLoans">;

        if (!officerMap.has(officerId)) {
          officerMap.set(officerId, {
            loanOfficerId: officerId,
            loanOfficerName: "",
            totalLoans: 0,
            low: 0,
            medium: 0,
            high: 0,
            critical: 0,
          });
        }

        const row = officerMap.get(officerId)!;
        row.totalLoans += 1;
        if (level === "low" || level === "medium" || level === "high" || level === "critical") {
          (row as any)[level] = ((row as any)[level] ?? 0) + 1;
        } else {
          row.low += 1;
        }
      }

      const officerIds = Array.from(officerMap.keys());

      if (officerIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", officerIds);

        if (profilesError) throw profilesError;

        const profileMap = new Map<string, ProfileRow>();
        for (const p of (profiles ?? []) as ProfileRow[]) {
          profileMap.set(p.id, p);
        }

        for (const row of officerMap.values()) {
          const p = profileMap.get(row.loanOfficerId);
          row.loanOfficerName = p?.full_name || p?.email || "Unassigned";
        }
      }

      const riskByOfficer = Array.from(officerMap.values()).sort((a, b) =>
        a.loanOfficerName.localeCompare(b.loanOfficerName),
      );

      const officerProfileMap = new Map<string, ProfileRow>();
      if (officerIds.length > 0) {
        const { data: opRows } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", officerIds);
        for (const p of (opRows ?? []) as ProfileRow[]) {
          officerProfileMap.set(p.id, p);
        }
      }

      function toLoanDetail(loan: LoanRow): LoanDetailRow {
        const p = officerProfileMap.get(loan.loan_officer_id);
        return {
          loanId: loan.id,
          loanNumber: loan.loan_number ?? loan.id.slice(0, 8),
          loanStatus: loan.status,
          loanOfficerName: p?.full_name || p?.email || "Unassigned",
          riskLevel: riskByLoanId.get(loan.id)?.risk_level ?? "low",
          updatedAt: loan.updated_at ?? loan.created_at,
        };
      }

      const activeLoansDetail = loans
        .filter((l) => l.status !== "closed")
        .map(toLoanDetail);

      const atRiskLoansDetail = loans
        .filter((l) => atRiskLoansSet.has(l.id))
        .map(toLoanDetail);

      const onTimeLoansDetail = loans
        .filter((l) => l.status !== "closed" && !atRiskLoansSet.has(l.id))
        .map(toLoanDetail);

      const profileByOfficerId = new Map<string, ProfileRow>();
      for (const row of riskByOfficer) {
        profileByOfficerId.set(row.loanOfficerId, {
          id: row.loanOfficerId,
          full_name: row.loanOfficerName,
          email: null,
        });
      }
      for (const p of (officerIds.length > 0 ? ((await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", officerIds)).data ?? []) : []) as ProfileRow[]) {
        profileByOfficerId.set(p.id, p);
      }

      const untouchedLoans = loans
        .filter((loan) => !["closed", "denied", "withdrawn"].includes((loan.status || "").toLowerCase()))
        .map((loan) => {
          const lastTouch = loan.updated_at ? new Date(loan.updated_at) : new Date(loan.created_at);
          const untouchedDays = Math.max(
            0,
            Math.floor((now.getTime() - lastTouch.getTime()) / (1000 * 60 * 60 * 24)),
          );
          const officer = loan.loan_officer_id ? profileByOfficerId.get(loan.loan_officer_id) : null;
          return {
            loanId: loan.id,
            loanNumber: loan.loan_number ?? loan.id.slice(0, 8),
            loanStatus: loan.status,
            untouchedDays,
            loanOfficerId: loan.loan_officer_id ?? null,
            loanOfficerName: officer?.full_name || officer?.email || "Unassigned",
            loanOfficerEmail: officer?.email ?? null,
          };
        })
        .filter((loan) => loan.untouchedDays >= 7)
        .sort((a, b) => b.untouchedDays - a.untouchedDays);

      const untouchedSummary = {
        over7Days: untouchedLoans.length,
        over21Days: untouchedLoans.filter((loan) => loan.untouchedDays >= 21).length,
      };

      const teamMap = new Map<string, {
        loanOfficerId: string;
        loanOfficerName: string;
        loanOfficerEmail: string | null;
        totalLoans: number;
        untouched7Plus: number;
        untouched21Plus: number;
      }>();

      for (const loan of untouchedLoans) {
        if (!loan.loanOfficerId) continue;
        if (!teamMap.has(loan.loanOfficerId)) {
          teamMap.set(loan.loanOfficerId, {
            loanOfficerId: loan.loanOfficerId,
            loanOfficerName: loan.loanOfficerName,
            loanOfficerEmail: loan.loanOfficerEmail,
            totalLoans: 0,
            untouched7Plus: 0,
            untouched21Plus: 0,
          });
        }
        const row = teamMap.get(loan.loanOfficerId)!;
        row.untouched7Plus += 1;
        if (loan.untouchedDays >= 21) row.untouched21Plus += 1;
      }

      for (const loan of loans) {
        if (!loan.loan_officer_id) continue;
        if (!teamMap.has(loan.loan_officer_id)) {
          const officer = profileByOfficerId.get(loan.loan_officer_id);
          teamMap.set(loan.loan_officer_id, {
            loanOfficerId: loan.loan_officer_id,
            loanOfficerName: officer?.full_name || officer?.email || "Unassigned",
            loanOfficerEmail: officer?.email ?? null,
            totalLoans: 0,
            untouched7Plus: 0,
            untouched21Plus: 0,
          });
        }
        const row = teamMap.get(loan.loan_officer_id)!;
        row.totalLoans += 1;
      }

      const teamActivity = Array.from(teamMap.values()).sort((a, b) => {
        if (b.untouched21Plus !== a.untouched21Plus) return b.untouched21Plus - a.untouched21Plus;
        if (b.untouched7Plus !== a.untouched7Plus) return b.untouched7Plus - a.untouched7Plus;
        return a.loanOfficerName.localeCompare(b.loanOfficerName);
      });

      const loanById = new Map(loans.map((l) => [l.id, l]));
      const investorByLoan = new Map<string, string>();
      const expiringIds = [...mergedExpiring];
      if (expiringIds.length > 0) {
        const { data: subs } = await supabase
          .from("investor_submissions")
          .select("loan_id, status, updated_at")
          .in("loan_id", expiringIds)
          .order("updated_at", { ascending: false });
        for (const s of subs ?? []) {
          const lid = (s as { loan_id: string }).loan_id;
          if (!investorByLoan.has(lid)) {
            investorByLoan.set(lid, String((s as { status: string }).status));
          }
        }
      }

      const locksExpiring: LocksExpiringRow[] = expiringIds
        .map((id) => {
          const l = loanById.get(id);
          if (!l) return null;
          const exp =
            l.lock_expiration_date ??
            (locksRes.data ?? []).find((r: { loan_id: string }) => r.loan_id === id)?.lock_expiration ??
            "";
          return {
            loanId: id,
            loanNumber: l.loan_number ?? id.slice(0, 8),
            lockExpiration: exp ? String(exp) : "",
            loanStatus: l.status,
            investorStatus: investorByLoan.get(id) ?? null,
          };
        })
        .filter((x): x is LocksExpiringRow => x !== null)
        .sort((a, b) => a.lockExpiration.localeCompare(b.lockExpiration));

      return {
        pipeline,
        riskByOfficer,
        bottlenecks,
        metrics,
        locksExpiring,
        activeLoansDetail,
        atRiskLoansDetail,
        onTimeLoansDetail,
        untouchedSummary,
        untouchedLoans,
        teamActivity,
      };
    },
    enabled: !!user,
    staleTime: 60_000,
  });
}

