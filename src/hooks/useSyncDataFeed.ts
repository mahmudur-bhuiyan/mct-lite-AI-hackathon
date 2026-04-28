import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { integrationSettingsKeys } from '@/hooks/useIntegrationSettings';
import type { DataFeedProviderId } from '@/lib/data-feeds';
import { FunctionsHttpError } from '@supabase/supabase-js';

/** Providers that have a dedicated LOS-sync function writing into the loans table. */
const LOS_SYNC_FUNCTIONS: Partial<Record<DataFeedProviderId, string>> = {
  encompass: 'los-sync-encompass',
  lendingpad: 'los-sync-lendingpad',
};

export function useSyncDataFeed(provider: DataFeedProviderId) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      const fnName = LOS_SYNC_FUNCTIONS[provider] ?? 'sync-data-feed';
      const body = fnName === 'sync-data-feed' ? { provider } : {};
      const invoke = async (name: string, payload: unknown) => {
        const { data, error } = await supabase.functions.invoke(name, { body: payload });
        if (error) throw error;
        return data;
      };

      let data: unknown;
      try {
        data = await invoke(fnName, body);
      } catch (e) {
        const isJwtAlgMismatch =
          e instanceof FunctionsHttpError &&
          e.context.status === 401 &&
          e.message.toLowerCase().includes('unsupported jwt algorithm');
        const isMissingLosFunction =
          provider === 'encompass' &&
          fnName !== 'sync-data-feed' &&
          e instanceof FunctionsHttpError &&
          (e.context.status === 404 || e.context.status === 405);

        if (isMissingLosFunction || (provider === 'encompass' && fnName !== 'sync-data-feed' && isJwtAlgMismatch)) {
          data = await invoke('sync-data-feed', { provider });
        } else {
          throw e;
        }
      }

      return data as {
        success?: boolean;
        error?: string;
        message?: string;
        http_status?: number;
        loans_fetched?: number;
        loans_upserted?: number;
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: integrationSettingsKeys.all });
      queryClient.invalidateQueries({ queryKey: integrationSettingsKeys.byProvider(provider) });
      // Invalidate loans list so the Pipeline page refreshes automatically
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      const isLos = provider in LOS_SYNC_FUNCTIONS;
      const description =
        isLos && data?.loans_upserted !== undefined
          ? `${data.loans_upserted} loan(s) synced to pipeline`
          : data?.message || data?.error || 'Done';
      toast({
        title: data?.success ? 'Sync complete' : 'Sync finished',
        description,
        variant: data?.success ? 'default' : 'destructive',
      });
    },
    onError: async (e: Error) => {
      let message = e.message;

      if (e instanceof FunctionsHttpError) {
        try {
          const body = await e.context.json();
          message =
            body?.error ||
            body?.message ||
            (typeof body === 'string' ? body : message);
        } catch {
          // Keep default message when error body is not parseable JSON.
        }
      }

      toast({
        title: 'Sync failed',
        description: message,
        variant: 'destructive',
      });
    },
  });
}
