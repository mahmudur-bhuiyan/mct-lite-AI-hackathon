import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface UserInvite {
  id: string;
  email: string;
  role: string;
  invited_by: string | null;
  token: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

export function useUserInvites() {
  return useQuery({
    queryKey: ["user_invites"],
    queryFn: async (): Promise<UserInvite[]> => {
      const { data, error } = await supabase
        .from("user_invites")
        .select("id, email, role, invited_by, token, expires_at, used_at, created_at")
        .is("used_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });

      if (error) {
        // Table may not exist yet — return empty rather than crashing
        if (error.code === "42P01") return [];
        throw error;
      }
      return (data ?? []) as UserInvite[];
    },
    staleTime: 1000 * 60 * 2,
  });
}

export function useCreateUserInvite() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: { email: string; role: string }): Promise<UserInvite> => {
      const { data, error } = await supabase
        .from("user_invites")
        .insert({
          email: params.email.trim().toLowerCase(),
          role: params.role,
          invited_by: user?.id ?? null,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "42P01") {
          throw new Error(
            "user_invites table not yet created. Apply migration 20260512000000_user_invites_and_roles.sql first."
          );
        }
        if (error.code === "23505") {
          throw new Error(`An active invite already exists for ${params.email}.`);
        }
        throw error;
      }
      return data as UserInvite;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["user_invites"] });
      toast.success(`Invitation created for ${data.email}. Share the invite link or deploy send-borrower-email to email it.`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to send invitation");
    },
  });
}

export function useDeleteUserInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inviteId: string): Promise<void> => {
      const { error } = await supabase
        .from("user_invites")
        .delete()
        .eq("id", inviteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_invites"] });
      toast.success("Invitation revoked");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to revoke invitation");
    },
  });
}

export function useResendUserInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inviteId: string): Promise<void> => {
      // Extend expiry by 7 more days on "resend"
      const newExpiry = new Date();
      newExpiry.setDate(newExpiry.getDate() + 7);

      const { error } = await supabase
        .from("user_invites")
        .update({ expires_at: newExpiry.toISOString() })
        .eq("id", inviteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_invites"] });
      toast.success("Invite extended — expiry reset to 7 days from now");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to resend invitation");
    },
  });
}
