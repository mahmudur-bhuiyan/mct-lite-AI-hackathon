import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  computePipelineStats,
  dtiColorClass,
  buildPipelineRowFromProfileOnly,
  normalizePipelineStatus,
  type PipelineRow,
} from "@/lib/prequal-pipeline";

// The prequal_* tables aren't in the generated Supabase types yet (their
// migrations aren't applied to the linked project), so query them through an
// untyped client view. Row shapes are enforced locally via SessionRow/DocumentItem.
const prequalDb = supabase as unknown as SupabaseClient;

export interface DocumentItem {
  document_name: string;
  collected: boolean;
}

export type { PipelineRow };

type ProfileEmbed = {
  borrower_name: string | null;
  borrower_email: string | null;
  borrower_phone: string | null;
  back_dti: number | null;
  credit_tier: string | null;
  target_price?: number | null;
  down_payment?: number | null;
  annual_income?: number | null;
  is_veteran?: boolean | null;
  assigned_officer?: string | null;
};

type MatchEmbed = {
  id: string;
  session_id: string;
  borrower_name: string | null;
  borrower_email: string | null;
  borrower_phone: string | null;
  product_type: string;
  prequal_amount: number;
  loan_amount: number;
  estimated_rate: number;
  monthly_payment: number;
  back_dti: number | null;
  credit_tier: string | null;
  status: string;
  letter_generated: boolean;
  assigned_officer: string | null;
  created_at: string;
};

type SessionRow = {
  id: string;
  status: string;
  guest_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  created_at: string;
  // PostgREST returns one-to-one embeds as an object (UNIQUE session_id FK), not an array.
  prequal_profiles: ProfileEmbed | ProfileEmbed[] | null;
  prequal_loan_matches: MatchEmbed | MatchEmbed[] | null;
};

/** Normalize PostgREST embed: one-to-one → object, one-to-many → array[0]. */
function firstEmbed<T>(value: T | T[] | null | undefined): T | undefined {
  if (value == null) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function mapSessionToPipelineRow(session: SessionRow): PipelineRow | null {
  if (session.status === "abandoned") return null;

  const profile = firstEmbed(session.prequal_profiles);
  const match = firstEmbed(session.prequal_loan_matches);
  const borrowerName = profile?.borrower_name ?? match?.borrower_name ?? session.guest_name;
  const borrowerEmail = profile?.borrower_email ?? match?.borrower_email ?? session.guest_email;
  const borrowerPhone = profile?.borrower_phone ?? match?.borrower_phone ?? session.guest_phone;

  if (match) {
    const letterGenerated = match.letter_generated || session.status === "completed";
    const status = normalizePipelineStatus(
      match.status as PipelineRow["status"],
      letterGenerated,
      session.status === "completed",
    );
    return {
      id: match.id,
      session_id: session.id,
      borrower_name: borrowerName,
      borrower_email: borrowerEmail,
      borrower_phone: borrowerPhone,
      product_type: match.product_type,
      prequal_amount: match.prequal_amount,
      loan_amount: match.loan_amount,
      estimated_rate: match.estimated_rate,
      monthly_payment: match.monthly_payment,
      back_dti: match.back_dti ?? profile?.back_dti ?? null,
      credit_tier: match.credit_tier ?? profile?.credit_tier ?? null,
      status,
      letter_generated: letterGenerated,
      assigned_officer: match.assigned_officer,
      created_at: match.created_at ?? session.created_at,
    };
  }

  const profileFallback = buildPipelineRowFromProfileOnly(
    session.id,
    session.status,
    {
      borrower_name: profile?.borrower_name ?? undefined,
      borrower_email: profile?.borrower_email ?? undefined,
      borrower_phone: profile?.borrower_phone ?? undefined,
      target_price: profile?.target_price ?? undefined,
      down_payment: profile?.down_payment ?? undefined,
      annual_income: profile?.annual_income ?? undefined,
      credit_tier: profile?.credit_tier ?? undefined,
      back_dti: profile?.back_dti ?? undefined,
      is_veteran: profile?.is_veteran ?? undefined,
      assigned_officer: profile?.assigned_officer ?? undefined,
    },
    {
      name: session.guest_name,
      email: session.guest_email,
      phone: session.guest_phone,
    },
    session.created_at,
  );
  if (profileFallback) return profileFallback;

  return {
    session_id: session.id,
    borrower_name: borrowerName,
    borrower_email: borrowerEmail,
    borrower_phone: borrowerPhone,
    product_type: null,
    prequal_amount: null,
    loan_amount: null,
    estimated_rate: null,
    monthly_payment: null,
    back_dti: profile?.back_dti ?? null,
    credit_tier: profile?.credit_tier ?? null,
    status: session.status === "completed" ? "qualified" : "inquiry",
    letter_generated: session.status === "completed",
    assigned_officer: null,
    created_at: session.created_at,
  };
}

/**
 * A session is only a real lead if the borrower actually gave input:
 * an identity (name/email) or any extracted financial data. Empty
 * "Anonymous" shell sessions are never shown or counted.
 */
function isRealLead(row: PipelineRow): boolean {
  const hasIdentity = !!(row.borrower_name || row.borrower_email);
  const hasData =
    row.product_type != null ||
    row.prequal_amount != null ||
    row.loan_amount != null ||
    row.monthly_payment != null ||
    row.back_dti != null ||
    row.credit_tier != null;
  return hasIdentity || hasData;
}

async function fetchPipeline(): Promise<PipelineRow[]> {
  const { data, error } = await prequalDb
    .from("prequal_sessions")
    .select(
      `
      id,
      status,
      guest_name,
      guest_email,
      guest_phone,
      created_at,
      prequal_profiles (
        borrower_name,
        borrower_email,
        borrower_phone,
        back_dti,
        credit_tier,
        target_price,
        down_payment,
        annual_income,
        is_veteran
      ),
      prequal_loan_matches (
        id,
        session_id,
        borrower_name,
        borrower_email,
        borrower_phone,
        product_type,
        prequal_amount,
        loan_amount,
        estimated_rate,
        monthly_payment,
        back_dti,
        credit_tier,
        status,
        letter_generated,
        assigned_officer,
        created_at
      )
    `,
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return ((data ?? []) as SessionRow[])
    .map(mapSessionToPipelineRow)
    .filter((row): row is PipelineRow => row != null)
    .filter(isRealLead);
}

async function fetchDocuments(sessionId: string): Promise<DocumentItem[]> {
  const { data } = await prequalDb
    .from("prequal_document_items")
    .select("document_name, collected")
    .eq("session_id", sessionId);
  return (data ?? []) as DocumentItem[];
}

type LoanOfficerProfile = {
  full_name: string | null;
  email: string | null;
};

async function fetchLoanOfficers(): Promise<LoanOfficerProfile[]> {
  const { data: roles, error: rolesError } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "loan_officer");
  if (rolesError || !roles?.length) return [];

  const ids = roles.map((r) => r.user_id as string);
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("full_name, email")
    .in("id", ids);
  if (error) return [];
  return (profiles ?? []) as LoanOfficerProfile[];
}

function buildOfficerDisplayResolver(officers: LoanOfficerProfile[]) {
  const byKey = new Map<string, string>();
  for (const officer of officers) {
    const name = officer.full_name?.trim();
    if (!name) continue;
    byKey.set(name.toLowerCase(), name);
    const email = officer.email?.trim();
    if (email) byKey.set(email.toLowerCase(), name);
  }

  return (assigned: string | null | undefined): string | null => {
    if (!assigned) return null;
    const resolved = byKey.get(assigned.toLowerCase());
    if (resolved) return resolved;
    if (assigned.includes("@")) return null;
    return assigned;
  };
}

export function usePrequalPipeline() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: pipeline = [], isLoading } = useQuery({
    queryKey: ["prequal-pipeline"],
    queryFn: fetchPipeline,
    refetchInterval: 30_000,
  });

  const { data: loanOfficers = [] } = useQuery({
    queryKey: ["prequal-loan-officers"],
    queryFn: fetchLoanOfficers,
    staleTime: 5 * 60_000,
  });

  const officerDisplayName = useMemo(
    () => buildOfficerDisplayResolver(loanOfficers),
    [loanOfficers],
  );

  const selected = pipeline.find((r) => (r.id ?? r.session_id) === selectedId) ?? null;

  const { data: documents = [] } = useQuery({
    queryKey: ["prequal-docs", selected?.session_id],
    queryFn: () => (selected ? fetchDocuments(selected.session_id) : Promise.resolve([])),
    enabled: !!selected,
  });

  useEffect(() => {
    const channel = supabase
      .channel("prequal-pipeline-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "prequal_loan_matches" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["prequal-pipeline"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "prequal_sessions" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["prequal-pipeline"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "prequal_profiles" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["prequal-pipeline"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const stats = computePipelineStats(pipeline);

  const toggleSelect = (row: PipelineRow) => {
    const key = row.id ?? row.session_id;
    setSelectedId((prev) => (prev === key ? null : key));
  };

  return {
    pipeline,
    isLoading,
    stats,
    selected,
    documents,
    toggleSelect,
    dtiColorClass,
    officerDisplayName,
  };
}
