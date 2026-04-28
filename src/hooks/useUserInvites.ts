import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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

// NOTE: user_invites table needs to be created via database migration
// These hooks return empty data until the table is created

export function useUserInvites() {
  return useQuery({
    queryKey: ["user_invites"],
    queryFn: async (): Promise<UserInvite[]> => {
      // Table not yet created
      return [];
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useCreateUserInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { email: string; role: string }): Promise<UserInvite> => {
      toast.error("User invites feature requires database migration");
      throw new Error("user_invites table not yet created");
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["user_invites"] });
      toast.success(`Invitation sent to ${data.email}`);
    },
    onError: (error: any) => {
      console.error("Error creating invite:", error);
      toast.error(error.message || "Failed to send invitation");
    },
  });
}

export function useDeleteUserInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inviteId: string): Promise<void> => {
      toast.error("User invites feature requires database migration");
      throw new Error("user_invites table not yet created");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_invites"] });
      toast.success("Invitation revoked");
    },
    onError: (error: any) => {
      console.error("Error deleting invite:", error);
      toast.error("Failed to revoke invitation");
    },
  });
}

export function useResendUserInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inviteId: string): Promise<void> => {
      toast.error("User invites feature requires database migration");
      throw new Error("user_invites table not yet created");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_invites"] });
      toast.success("Invitation resent");
    },
    onError: (error: any) => {
      console.error("Error resending invite:", error);
      toast.error("Failed to resend invitation");
    },
  });
}
