import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { usePrequalPipeline } from "@/hooks/usePrequalPipeline";
import { useAuth } from "@/contexts/AuthContext";
import { hasAnyRole } from "@/lib/agentRoles";
import { computePipelineStats } from "@/lib/prequal-pipeline";
import { formatPhoneDisplay } from "@/lib/validation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const PAGE_SIZE = 25;

type PipelineView = "my_list" | "all_pipeline";

function buildPageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "ellipsis")[] = [1];
  if (current > 3) pages.push("ellipsis");
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p);
  if (current < total - 2) pages.push("ellipsis");
  pages.push(total);
  return pages;
}
type StatusFilter = "all" | "qualified" | "pending";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "qualified", label: "Qualified" },
  { value: "pending", label: "Pending" },
];

function filterMyListPipeline(
  rows: ReturnType<typeof usePrequalPipeline>["pipeline"],
  matchers: Set<string>,
) {
  if (matchers.size === 0) return [];
  return rows.filter((r) => {
    const assigned = r.assigned_officer?.toLowerCase();
    return !!assigned && matchers.has(assigned);
  });
}

export default function PrequalDashboard() {
  const { pipeline, isLoading, selected, documents, toggleSelect, dtiColorClass, officerDisplayName } =
    usePrequalPipeline();
  const { profile } = useAuth();

  const isLoanOfficerUser = useMemo(() => {
    const isAdmin = profile?.role === "admin" || profile?.role === "moderator";
    return !isAdmin && hasAnyRole(profile, ["loan_officer"]);
  }, [profile]);

  const officerMatchers = useMemo(() => {
    const matchers = new Set<string>();
    const name = profile?.full_name?.trim();
    const email = profile?.email?.trim();
    if (name) matchers.add(name.toLowerCase());
    if (email) matchers.add(email.toLowerCase());
    return matchers;
  }, [profile]);

  const [pipelineView, setPipelineView] = useState<PipelineView>("all_pipeline");
  const [defaultViewApplied, setDefaultViewApplied] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Default loan officers to "My List" tab once profile is available.
  useEffect(() => {
    if (!defaultViewApplied && profile) {
      if (isLoanOfficerUser) setPipelineView("my_list");
      setDefaultViewApplied(true);
    }
  }, [profile, isLoanOfficerUser, defaultViewApplied]);

  const myListPipeline = useMemo(
    () => filterMyListPipeline(pipeline, officerMatchers),
    [pipeline, officerMatchers],
  );

  const scopedPipeline = pipelineView === "my_list" ? myListPipeline : pipeline;
  const displayStats = useMemo(() => computePipelineStats(scopedPipeline), [scopedPipeline]);

  const [page, setPage] = useState(1);

  const filteredPipeline = useMemo(() => {
    if (statusFilter === "qualified") {
      return scopedPipeline.filter((r) => r.status === "qualified");
    }
    if (statusFilter === "pending") {
      return scopedPipeline.filter((r) => r.status === "pending" || r.status === "inquiry");
    }
    return scopedPipeline;
  }, [scopedPipeline, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredPipeline.length / PAGE_SIZE));

  // Reset to the first page whenever the filter or tab changes.
  useEffect(() => {
    setPage(1);
  }, [statusFilter, pipelineView]);

  // Clamp the page if the list shrinks (e.g. realtime update).
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const startIndex = (page - 1) * PAGE_SIZE;
  const pagedPipeline = useMemo(
    () => filteredPipeline.slice(startIndex, startIndex + PAGE_SIZE),
    [filteredPipeline, startIndex],
  );

  const statusBadge = (status: string) => {
    const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      qualified: "default",
      pending: "secondary",
      inquiry: "outline",
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">LO Pipeline</h1>
          <p className="text-muted-foreground text-sm mt-1">
            AI pre-qualification leads · Updates when borrowers chat with Alex
          </p>
        </div>
        {isLoanOfficerUser && (
          <Tabs
            value={pipelineView}
            onValueChange={(value) => setPipelineView(value as PipelineView)}
          >
            <TabsList>
              <TabsTrigger value="my_list">My List</TabsTrigger>
              <TabsTrigger value="all_pipeline">All Pipeline</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: pipelineView === "my_list" ? "My Pipeline" : "Total Pipeline",
            value: displayStats.total,
            color: "",
          },
          { label: "Qualified", value: displayStats.qualified, color: "text-green-600" },
          { label: "Pending Review", value: displayStats.pending, color: "text-amber-600" },
          {
            label: "Avg Pre-Qual",
            value: displayStats.avgPrequal ? `$${displayStats.avgPrequal.toLocaleString()}` : "—",
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                Pipeline
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse ml-1" />
              </CardTitle>
              <div className="flex items-center gap-1">
                {STATUS_FILTERS.map((f) => (
                  <Button
                    key={f.value}
                    size="sm"
                    variant={statusFilter === f.value ? "default" : "ghost"}
                    className="h-7 px-3 text-xs"
                    onClick={() => setStatusFilter(f.value)}
                  >
                    {f.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                Loading pipeline...
              </div>
            ) : pipeline.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2">
                <p className="text-sm">No borrowers yet.</p>
                <p className="text-xs">
                  Borrowers pre-qualify with Alex at{" "}
                  <a href="/prequal-public" className="text-primary underline underline-offset-2">
                    /prequal-public
                  </a>
                  .
                </p>
              </div>
            ) : scopedPipeline.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2">
                <p className="text-sm">
                  {pipelineView === "my_list"
                    ? "No borrowers assigned to you in the pipeline."
                    : "No borrowers in the pipeline."}
                </p>
                {pipelineView === "my_list" && (
                  <Button size="sm" variant="ghost" onClick={() => setPipelineView("all_pipeline")}>
                    View all pipeline
                  </Button>
                )}
              </div>
            ) : filteredPipeline.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2">
                <p className="text-sm">No {statusFilter} borrowers in the pipeline.</p>
                <Button size="sm" variant="ghost" onClick={() => setStatusFilter("all")}>
                  Clear filter
                </Button>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-center">Borrower</TableHead>
                      <TableHead className="text-center">Email</TableHead>
                      <TableHead className="text-center">Loan</TableHead>
                      <TableHead className="text-center">Pre-Qual</TableHead>
                      <TableHead className="text-center">Payment</TableHead>
                      <TableHead className="text-center">DTI</TableHead>
                      <TableHead className="text-center">Credit</TableHead>
                      <TableHead className="text-center">Officer</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedPipeline.map((row) => (
                      <TableRow
                        key={row.id ?? row.session_id}
                        className={`cursor-pointer ${selected?.session_id === row.session_id ? "bg-muted/50" : ""}`}
                        onClick={() => toggleSelect(row)}
                      >
                        <TableCell className="text-center font-medium">
                          {row.borrower_name ?? "Anonymous"}
                        </TableCell>
                        <TableCell className="text-center text-xs text-muted-foreground">
                          <span className="inline-block max-w-[140px] truncate">
                            {row.borrower_email ?? "—"}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {row.product_type ? (
                            <Badge variant="outline">{row.product_type}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center font-bold">
                          {row.prequal_amount != null
                            ? `$${row.prequal_amount.toLocaleString()}`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground">
                          {row.monthly_payment != null
                            ? `$${row.monthly_payment.toLocaleString()}/mo`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={dtiColorClass(row.back_dti)}>
                            {row.back_dti ? `${row.back_dti.toFixed(1)}%` : "—"}
                          </span>
                        </TableCell>
                        <TableCell className="text-center capitalize">{row.credit_tier ?? "—"}</TableCell>
                        <TableCell className="text-center text-xs">
                          {officerDisplayName(row.assigned_officer) ?? "—"}
                        </TableCell>
                        <TableCell className="text-center">{statusBadge(row.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t px-4 py-3">
                    <p className="text-xs text-muted-foreground">
                      Showing {startIndex + 1}–
                      {Math.min(startIndex + PAGE_SIZE, filteredPipeline.length)} of{" "}
                      {filteredPipeline.length}
                    </p>
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            aria-disabled={page === 1}
                            className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                        {buildPageNumbers(page, totalPages).map((p, idx) =>
                          p === "ellipsis" ? (
                            <PaginationItem key={`e-${idx}`}>
                              <PaginationEllipsis />
                            </PaginationItem>
                          ) : (
                            <PaginationItem key={p}>
                              <PaginationLink
                                isActive={p === page}
                                onClick={() => setPage(p)}
                                className="cursor-pointer"
                              >
                                {p}
                              </PaginationLink>
                            </PaginationItem>
                          ),
                        )}
                        <PaginationItem>
                          <PaginationNext
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            aria-disabled={page === totalPages}
                            className={
                              page === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"
                            }
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </>
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
                  ["Loan Product", selected.product_type ?? "—"],
                  ["Email", selected.borrower_email ?? "—"],
                  ["Phone", formatPhoneDisplay(selected.borrower_phone)],
                  ["Pre-Qual Amount", selected.prequal_amount != null ? `$${selected.prequal_amount.toLocaleString()}` : "—"],
                  ["Est. Rate", selected.estimated_rate != null ? `${selected.estimated_rate}%` : "—"],
                  ["Monthly Payment", selected.monthly_payment != null ? `$${selected.monthly_payment.toLocaleString()}/mo` : "—"],
                  ["Back-end DTI", selected.back_dti ? `${selected.back_dti.toFixed(1)}%` : "—"],
                  ["Credit Tier", selected.credit_tier ?? "—"],
                  ["Assigned LO", officerDisplayName(selected.assigned_officer) ?? "Unassigned"],
                  ["Letter", selected.letter_generated ? "Generated" : "Pending"],
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
