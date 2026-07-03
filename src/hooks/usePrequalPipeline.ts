import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { computePipelineStats, dtiColorClass, type PipelineRow } from "@/lib/prequal-pipeline";

export interface DocumentItem {
  document_name: string;
  collected: boolean;
}

export type { PipelineRow };

async function fetchPipeline(): Promise<PipelineRow[]> {
  const { data, error } = await supabase
    .from("prequal_loan_matches")
    .select(
      "session_id, borrower_name, product_type, prequal_amount, loan_amount, estimated_rate, monthly_payment, back_dti, credit_tier, status, letter_generated, assigned_officer, created_at, id",
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as PipelineRow[];
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
