import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/cache";
import type { LetterData, LoanMatch, PrequalProfile } from "@/hooks/usePrequalAgent";

export interface PrequalSession {
  id: string;
  status: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface PrequalMessageRow {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface PrequalSessionDetails {
  profile: PrequalProfile;
  loanMatch: LoanMatch | null;
  letterData: LetterData | null;
  documentGaps: string[];
  assignedOfficer: string | null;
}

interface PrequalProfileRow {
  borrower_name?: string | null;
  borrower_email?: string | null;
  borrower_phone?: string | null;
  annual_income?: number | null;
  monthly_debts?: number | null;
  assets?: number | null;
  employment_type?: string | null;
  years_employed?: number | null;
  credit_tier?: string | null;
  is_veteran?: boolean | null;
  is_first_time_buyer?: boolean | null;
  target_price?: number | null;
  down_payment?: number | null;
  front_dti?: number | null;
  back_dti?: number | null;
}

interface PrequalLoanMatchRow {
  borrower_name?: string | null;
  product_type: string;
  prequal_amount: number;
  loan_amount: number;
  down_payment: number;
  ltv: number;
  estimated_rate: number;
  monthly_payment: number;
  letter_generated?: boolean | null;
  assigned_officer?: string | null;
}

interface PrequalDocumentRow {
  document_name: string;
  collected: boolean;
}

function mapProfile(row: PrequalProfileRow | null): PrequalProfile {
  if (!row) return {};
  return {
    borrower_name: row.borrower_name ?? undefined,
    borrower_email: row.borrower_email ?? undefined,
    borrower_phone: row.borrower_phone ?? undefined,
    annual_income: row.annual_income ?? undefined,
    monthly_debts: row.monthly_debts ?? undefined,
    assets: row.assets ?? undefined,
    employment_type: row.employment_type ?? undefined,
    years_employed: row.years_employed ?? undefined,
    credit_tier: row.credit_tier ?? undefined,
    is_veteran: row.is_veteran ?? undefined,
    is_first_time_buyer: row.is_first_time_buyer ?? undefined,
    target_price: row.target_price ?? undefined,
    down_payment: row.down_payment ?? undefined,
    front_dti: row.front_dti ?? undefined,
    back_dti: row.back_dti ?? undefined,
  };
}

function mapLoanMatch(row: PrequalLoanMatchRow | null): LoanMatch | null {
  if (!row) return null;
  return {
    product_type: row.product_type,
    prequal_amount: row.prequal_amount,
    loan_amount: row.loan_amount,
    down_payment: row.down_payment,
    ltv: row.ltv,
    estimated_rate: row.estimated_rate,
    monthly_payment: row.monthly_payment,
  };
}

function mapLetterData(
  match: PrequalLoanMatchRow | null,
  profile: PrequalProfile,
): LetterData | null {
  if (!match?.letter_generated) return null;
  const borrowerName = match.borrower_name ?? profile.borrower_name ?? "Borrower";
  return {
    borrower_name: borrowerName,
    prequal_amount: match.prequal_amount,
    loan_product: match.product_type,
    purchase_price: profile.target_price ?? match.prequal_amount,
  };
}

export async function fetchPrequalSessionDetails(
  sessionId: string,
): Promise<PrequalSessionDetails> {
  const [profileRes, matchRes, docsRes] = await Promise.all([
    supabase.from("prequal_profiles").select("*").eq("session_id", sessionId).maybeSingle(),
    supabase.from("prequal_loan_matches").select("*").eq("session_id", sessionId).maybeSingle(),
    supabase
      .from("prequal_document_items")
      .select("document_name, collected")
      .eq("session_id", sessionId),
  ]);

  if (profileRes.error) throw profileRes.error;
  if (matchRes.error) throw matchRes.error;
  if (docsRes.error) throw docsRes.error;

  const profile = mapProfile((profileRes.data as PrequalProfileRow | null) ?? null);
  const matchRow = (matchRes.data as PrequalLoanMatchRow | null) ?? null;
  const docs = (docsRes.data ?? []) as PrequalDocumentRow[];

  const assignedOfficer = matchRow?.assigned_officer ?? profile.assigned_officer ?? null;
  if (assignedOfficer) profile.assigned_officer = assignedOfficer;

  return {
    profile,
    loanMatch: mapLoanMatch(matchRow),
    letterData: mapLetterData(matchRow, profile),
    documentGaps: docs.filter((d) => !d.collected).map((d) => d.document_name),
    assignedOfficer,
  };
}

export function usePrequalSessions(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.prequal.sessions(userId ?? ""),
    queryFn: async (): Promise<PrequalSession[]> => {
      // Only sessions where the user actually replied — greeting-only drafts stay out of history.
      const { data, error } = await supabase
        .from("prequal_sessions")
        .select("id, status, title, created_at, updated_at, prequal_messages!inner(id)")
        .eq("user_id", userId!)
        .eq("prequal_messages.role", "user")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(({ id, status, title, created_at, updated_at }) => ({
        id,
        status,
        title: title ?? null,
        created_at,
        updated_at,
      }));
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
}

export function usePrequalMessages(sessionId: string | null) {
  return useQuery({
    queryKey: queryKeys.prequal.messages(sessionId ?? ""),
    queryFn: async (): Promise<PrequalMessageRow[]> => {
      const { data, error } = await supabase
        .from("prequal_messages")
        .select("id, session_id, role, content, created_at")
        .eq("session_id", sessionId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PrequalMessageRow[];
    },
    enabled: !!sessionId,
    staleTime: 10_000,
  });
}

export function usePrequalSessionDetails(sessionId: string | null) {
  return useQuery({
    queryKey: queryKeys.prequal.session(sessionId ?? ""),
    queryFn: () => fetchPrequalSessionDetails(sessionId!),
    enabled: !!sessionId,
    staleTime: 30_000,
  });
}
