import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { computePipelineStats, dtiColorClass, type PipelineRow } from "@/lib/prequal-pipeline";

export interface DocumentItem {
  document_name: string;
  collected: boolean;
}

export type { PipelineRow };

type SessionRow = {
  id: string;
  guest_name: string | null;
  guest_email: string | null;
  created_at: string;
  prequal_profiles: Array<{
    borrower_name: string | null;
    borrower_email: string | null;
    back_dti: number | null;
    credit_tier: string | null;
  }> | null;
  prequal_loan_matches: Array<{
    id: string;
    session_id: string;
    borrower_name: string | null;
    borrower_email: string | null;
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
  }> | null;
};

function mapSessionToPipelineRow(session: SessionRow): PipelineRow {
  const profile = session.prequal_profiles?.[0];
  const match = session.prequal_loan_matches?.[0];
  const borrowerName = profile?.borrower_name ?? match?.borrower_name ?? session.guest_name;
  const borrowerEmail = profile?.borrower_email ?? match?.borrower_email ?? session.guest_email;

  if (match) {
    return {
      id: match.id,
      session_id: session.id,
      borrower_name: borrowerName,
      borrower_email: borrowerEmail,
      product_type: match.product_type,
      prequal_amount: match.prequal_amount,
      loan_amount: match.loan_amount,
      estimated_rate: match.estimated_rate,
      monthly_payment: match.monthly_payment,
      back_dti: match.back_dti ?? profile?.back_dti ?? null,
      credit_tier: match.credit_tier ?? profile?.credit_tier ?? null,
      status: match.status as PipelineRow["status"],
      letter_generated: match.letter_generated,
      assigned_officer: match.assigned_officer,
      created_at: match.created_at ?? session.created_at,
    };
  }

  return {
    session_id: session.id,
    borrower_name: borrowerName,
    borrower_email: borrowerEmail,
    product_type: null,
    prequal_amount: null,
    loan_amount: null,
    estimated_rate: null,
    monthly_payment: null,
    back_dti: profile?.back_dti ?? null,
    credit_tier: profile?.credit_tier ?? null,
    status: "inquiry",
    letter_generated: false,
    assigned_officer: null,
    created_at: session.created_at,
  };
}

async function fetchPipeline(): Promise<PipelineRow[]> {
  const { data, error } = await supabase
    .from("prequal_sessions")
    .select(
      `
      id,
      guest_name,
      guest_email,
      created_at,
      prequal_profiles (
        borrower_name,
        borrower_email,
        back_dti,
        credit_tier
      ),
      prequal_loan_matches (
        id,
        session_id,
        borrower_name,
        borrower_email,
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
  return ((data ?? []) as SessionRow[]).map(mapSessionToPipelineRow);
}

async function fetchDocuments(sessionId: string): Promise<DocumentItem[]> {
  const { data } = await supabase
    .from("prequal_document_items")
    .select("document_name, collected")
    .eq("session_id", sessionId);
  return (data ?? []) as DocumentItem[];
}

export function usePrequalPipeline() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: pipeline = [], isLoading } = useQuery({
    queryKey: ["prequal-pipeline"],
    queryFn: fetchPipeline,
    refetchInterval: 30_000,
  });

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
  };
}
