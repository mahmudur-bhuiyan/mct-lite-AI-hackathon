import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/integrations/supabase/types";
import { riskKeys } from "@/hooks/useLoanRiskScore";

type UploadRow = Database["public"]["Tables"]["loan_borrower_uploads"]["Row"];

export function useCreatePortalInvite() {
  return useMutation({
    mutationFn: async (loanId: string) => {
      const { data, error } = await supabase.functions.invoke("portal-create-invite", {
        body: { loan_id: loanId },
      });
      if (error) throw new Error(error.message);
      const body = data as {
        error?: string;
        invite_link?: string;
        token?: string;
        expires_at?: string;
        borrower_email?: string;
      };
      if (body?.error) throw new Error(body.error);
      return body;
    },
  });
}

export function useLoanBorrowerUploads(loanId: string | undefined) {
  return useQuery({
    queryKey: ["loan_borrower_uploads", loanId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_borrower_uploads")
        .select("*")
        .eq("loan_id", loanId!)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return data as UploadRow[];
    },
    enabled: !!loanId,
  });
}

export function useReviewBorrowerUpload(loanId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      uploadId: string;
      action: "accepted" | "rejected";
      notes?: string;
      markConditionReceived: boolean;
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const { data: upload, error: upErr } = await supabase
        .from("loan_borrower_uploads")
        .select("id, loan_condition_id, loan_id")
        .eq("id", args.uploadId)
        .maybeSingle();

      if (upErr || !upload) throw new Error("Upload not found");

      const review_status = args.action === "accepted" ? "accepted" : "rejected";
      const { error: updErr } = await supabase
        .from("loan_borrower_uploads")
        .update({
          review_status,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
          review_notes: args.notes?.trim() || null,
        })
        .eq("id", args.uploadId);

      if (updErr) throw updErr;

      if (
        args.action === "accepted" &&
        args.markConditionReceived &&
        upload.loan_condition_id
      ) {
        const { error: cErr } = await supabase
          .from("loan_conditions")
          .update({
            status: "received",
            received_at: new Date().toISOString(),
          })
          .eq("id", upload.loan_condition_id)
          .eq("loan_id", loanId);
        if (cErr) throw cErr;
      }

      if (args.action === "accepted") {
        try {
          await supabase.functions.invoke("calculate-loan-risk", {
            body: { loan_id: loanId },
          });
        } catch {
          /* non-fatal */
        }
      }

      return { ok: true as const };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loan_borrower_uploads", loanId] });
      queryClient.invalidateQueries({ queryKey: ["loan_conditions", loanId] });
      queryClient.invalidateQueries({ queryKey: riskKeys.byLoan(loanId) });
    },
  });
}

export async function getBorrowerUploadSignedUrl(uploadId: string): Promise<{
  signed_url: string;
  file_name: string;
}> {
  const { data, error } = await supabase.functions.invoke("portal-staff-upload-url", {
    body: { upload_id: uploadId },
  });
  if (error) throw new Error(error.message);
  const body = data as { error?: string; signed_url?: string; file_name?: string };
  if (body?.error) throw new Error(body.error);
  if (!body.signed_url) throw new Error("No download URL");
  return { signed_url: body.signed_url, file_name: body.file_name ?? "file" };
}
