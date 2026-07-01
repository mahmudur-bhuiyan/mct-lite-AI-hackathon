import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface PipelineRow {
  id: string;
  session_id: string;
  borrower_name: string | null;
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
}

interface DocumentItem {
  document_name: string;
  collected: boolean;
}

async function fetchPipeline(): Promise<PipelineRow[]> {
  const { data, error } = await supabase
    .from("prequal_loan_matches")
    .select("*")
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

export default function PrequalDashboard() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<PipelineRow | null>(null);

  const { data: pipeline = [], isLoading } = useQuery({
    queryKey: ["prequal-pipeline"],
    queryFn: fetchPipeline,
    refetchInterval: 30000,
  });

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
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const stats = {
    total: pipeline.length,
    qualified: pipeline.filter((r) => r.status === "qualified").length,
    pending: pipeline.filter((r) => r.status === "pending").length,
    avgPrequal: pipeline.length
      ? Math.round(pipeline.reduce((s, r) => s + r.prequal_amount, 0) / pipeline.length)
      : 0,
  };

  const statusBadge = (status: string) => {
    const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      qualified: "default",
      pending: "secondary",
      referred: "outline",
      declined: "destructive",
    };
    return (
      <Badge variant={map[status] ?? "outline"} className="capitalize">
        {status}
      </Badge>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pre-Qualification Pipeline</h1>
        <p className="text-muted-foreground text-sm mt-1">
          AI-generated borrower profiles · Live updates
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Pipeline", value: stats.total, color: "" },
          { label: "Qualified", value: stats.qualified, color: "text-green-600" },
          { label: "Pending Review", value: stats.pending, color: "text-amber-600" },
          {
            label: "Avg Pre-Qual",
            value: stats.avgPrequal ? `$${stats.avgPrequal.toLocaleString()}` : "—",
            color: "text-primary",
          },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                {s.label}
              </p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <Card className="flex-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              Pipeline
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse ml-1" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                Loading pipeline...
              </div>
            ) : pipeline.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-1">
                <p className="text-sm">No borrowers yet.</p>
                <p className="text-xs">Pre-qualifications appear here in real time.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Borrower</TableHead>
                    <TableHead>Loan</TableHead>
                    <TableHead>Pre-Qual</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>DTI</TableHead>
                    <TableHead>Credit</TableHead>
                    <TableHead>Officer</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pipeline.map((row) => (
                    <TableRow
                      key={row.id}
                      className={`cursor-pointer ${selected?.id === row.id ? "bg-muted/50" : ""}`}
                      onClick={() => setSelected(selected?.id === row.id ? null : row)}
                    >
                      <TableCell className="font-medium">
                        {row.borrower_name ?? "Anonymous"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{row.product_type}</Badge>
                      </TableCell>
                      <TableCell className="font-bold">
                        ${row.prequal_amount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        ${row.monthly_payment.toLocaleString()}/mo
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            row.back_dti && row.back_dti > 43
                              ? "text-red-500 font-semibold"
                              : row.back_dti && row.back_dti > 36
                                ? "text-amber-500 font-semibold"
                                : "text-green-600 font-semibold"
                          }
                        >
                          {row.back_dti ? `${row.back_dti.toFixed(1)}%` : "—"}
                        </span>
                      </TableCell>
                      <TableCell className="capitalize">{row.credit_tier ?? "—"}</TableCell>
                      <TableCell className="text-xs">{row.assigned_officer ?? "—"}</TableCell>
                      <TableCell>{statusBadge(row.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {selected && (
          <Card className="w-full lg:w-72 flex-shrink-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">AI Briefing Packet</CardTitle>
              <p className="text-xs text-muted-foreground">
                {selected.borrower_name ?? "Anonymous Borrower"}
              </p>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="space-y-2">
                {[
                  ["Loan Product", selected.product_type],
                  ["Pre-Qual Amount", `$${selected.prequal_amount.toLocaleString()}`],
                  ["Est. Rate", `${selected.estimated_rate}%`],
                  ["Monthly Payment", `$${selected.monthly_payment.toLocaleString()}/mo`],
                  ["Back-end DTI", selected.back_dti ? `${selected.back_dti.toFixed(1)}%` : "—"],
                  ["Credit Tier", selected.credit_tier ?? "—"],
                  ["Assigned LO", selected.assigned_officer ?? "Unassigned"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b pb-1 last:border-0">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="font-semibold capitalize">{v}</span>
                  </div>
                ))}
              </div>

              {documents.length > 0 && (
                <div>
                  <p className="font-semibold text-muted-foreground uppercase tracking-wide text-[10px] mb-2">
                    Documents Needed
                  </p>
                  <ul className="space-y-1">
                    {documents.map((doc, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className={doc.collected ? "text-green-500" : "text-amber-500"}>
                          {doc.collected ? "✓" : "○"}
                        </span>
                        {doc.document_name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div
                className={`text-center py-2 rounded-lg font-bold capitalize text-xs ${
                  selected.status === "qualified"
                    ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                }`}
              >
                {selected.status === "qualified" ? "✅" : "⏳"} {selected.status}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
