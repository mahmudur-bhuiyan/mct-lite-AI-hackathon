import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FunctionsHttpError } from "@supabase/functions-js";
import { supabase } from "@/lib/supabase";
import { queryKeys, invalidateKeys } from "@/lib/cache";
import { useAuth } from "@/contexts/AuthContext";
import type { Json } from "@/integrations/supabase/types";
import { toast } from "sonner";

/** Surface JSON `{ error }` from edge function responses (default message is opaque). */
async function messageFromFunctionInvokeError(err: unknown): Promise<string> {
  if (err instanceof FunctionsHttpError && err.context instanceof Response) {
    try {
      const j = (await err.context.clone().json()) as { error?: string };
      if (typeof j?.error === "string" && j.error.length > 0) return j.error;
    } catch {
      /* ignore */
    }
  }
  return err instanceof Error ? err.message : "Request failed";
}

export type BorrowerCommStatus =
  | "draft"
  | "approved"
  | "sent"
  | "rejected"
  | "needs_revision";

export type BorrowerCommLifecycleAction =
  | "approve"
  | "reject"
  | "needs_revision"
  | "mark_sent";

export interface BorrowerCommunicationListRow {
  id: string;
  loan_id: string;
  created_by_user_id: string;
  agent_id: string | null;
  doc_type: string;
  channel: string;
  audience: string;
  tone: string | null;
  length_pref: string | null;
  prompt_context: Json;
  draft_content: string;
  missing_data_notes: Json;
  confidence: string | null;
  draft_version: number;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  sent_at: string | null;
  rejected_at: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
  loans?: {
    loan_number: string;
    borrowers: { first_name: string | null; last_name: string | null } | null;
  } | null;
}

export interface GenerateBorrowerCommInput {
  loan_id: string;
  doc_type: string;
  channel?: string;
  audience?: string;
  tone?: string;
  length_pref?: string;
  extra_instructions?: string;
}

export function useBorrowerCommunicationsList(statusFilter?: BorrowerCommStatus | "all") {
  const { user } = useAuth();

  return useQuery({
    queryKey: [...queryKeys.borrowerCommunications.list(user?.id ?? ""), statusFilter ?? "all"],
    queryFn: async (): Promise<BorrowerCommunicationListRow[]> => {
      let q = supabase
        .from("borrower_communications")
        .select(
          `
          *,
          loans (
            loan_number,
            borrowers ( first_name, last_name )
          )
        `,
        )
        .order("created_at", { ascending: false });

      if (statusFilter === "draft") {
        q = q.in("status", ["draft", "needs_revision"]);
      } else if (statusFilter && statusFilter !== "all") {
        q = q.eq("status", statusFilter);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as BorrowerCommunicationListRow[];
    },
    enabled: !!user?.id,
  });
}

export function useGenerateBorrowerCommunication() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: GenerateBorrowerCommInput) => {
      const { data, error } = await supabase.functions.invoke("generate-borrower-update", {
        body: input,
      });
      if (error) throw new Error(await messageFromFunctionInvokeError(error));
      if (data?.error) throw new Error(typeof data.error === "string" ? data.error : "Generation failed");
      return data as {
        id: string;
        draft_content: string;
        missing_data_notes: string[];
        confidence: string;
        status: string;
      };
    },
    onSuccess: () => {
      if (user?.id) {
        invalidateKeys.borrowerCommunications(queryClient);
      }
      toast.success("Draft generated");
    },
    onError: (e: Error) => {
      toast.error(e.message || "Failed to generate draft");
    },
  });
}

export function useBorrowerCommunicationLifecycle() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: {
      communication_id: string;
      action: BorrowerCommLifecycleAction;
      draft_content?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("approve-borrower-communication", {
        body: params,
      });
      if (error) throw new Error(await messageFromFunctionInvokeError(error));
      if (data?.error) throw new Error(typeof data.error === "string" ? data.error : "Update failed");
      return data as { communication: BorrowerCommunicationListRow };
    },
    onSuccess: (_, variables) => {
      invalidateKeys.borrowerCommunications(queryClient);
      const labels: Record<BorrowerCommLifecycleAction, string> = {
        approve: "Marked approved",
        reject: "Rejected",
        needs_revision: "Marked needs revision",
        mark_sent: "Marked sent (copy and send externally if needed)",
      };
      toast.success(labels[variables.action] ?? "Updated");
    },
    onError: (e: Error) => {
      toast.error(e.message || "Failed to update");
    },
  });
}

export function useSendBorrowerEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (communication_id: string) => {
      const { data, error } = await supabase.functions.invoke("send-borrower-email", {
        body: { communication_id },
      });
      if (error) throw new Error(await messageFromFunctionInvokeError(error));
      if (data?.error) throw new Error(typeof data.error === "string" ? data.error : "Send failed");
      return data as { ok: boolean; communication_id: string; sent_to: string; sent_at: string };
    },
    onSuccess: (data) => {
      invalidateKeys.borrowerCommunications(queryClient);
      toast.success(`Email sent to ${data.sent_to}`);
    },
    onError: (e: Error) => {
      toast.error(e.message || "Failed to send email");
    },
  });
}

export function useUpdateBorrowerCommunicationDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { id: string; draft_content: string }) => {
      const { error } = await supabase
        .from("borrower_communications")
        .update({
          draft_content: params.draft_content,
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateKeys.borrowerCommunications(queryClient);
      toast.success("Draft saved");
    },
    onError: (e: Error) => {
      toast.error(e.message || "Failed to save draft");
    },
  });
}

export function useBorrowerCommunicationsByLoan(loanId: string | undefined) {
  return useQuery({
    queryKey: [...queryKeys.borrowerCommunications.all, "byLoan", loanId ?? ""],
    queryFn: async (): Promise<BorrowerCommunicationListRow[]> => {
      if (!loanId) return [];
      const { data, error } = await supabase
        .from("borrower_communications")
        .select(
          `*, loans ( loan_number, borrowers ( first_name, last_name ) )`,
        )
        .eq("loan_id", loanId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BorrowerCommunicationListRow[];
    },
    enabled: !!loanId,
  });
}

export function useBorrowerCommunicationsByBorrower(borrowerId: string | undefined) {
  return useQuery({
    queryKey: [...queryKeys.borrowerCommunications.all, "byBorrower", borrowerId ?? ""],
    queryFn: async (): Promise<BorrowerCommunicationListRow[]> => {
      if (!borrowerId) return [];
      const { data: loanIds, error: loansErr } = await supabase
        .from("loans")
        .select("id")
        .eq("borrower_id", borrowerId);
      if (loansErr) throw loansErr;
      if (!loanIds?.length) return [];

      const ids = loanIds.map((l) => l.id);
      const { data, error } = await supabase
        .from("borrower_communications")
        .select(
          `*, loans ( loan_number, borrowers ( first_name, last_name ) )`,
        )
        .in("loan_id", ids)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BorrowerCommunicationListRow[];
    },
    enabled: !!borrowerId,
  });
}
