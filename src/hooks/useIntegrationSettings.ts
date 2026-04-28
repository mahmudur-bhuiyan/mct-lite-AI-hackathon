/**
 * Integration Settings Hook
 * Manages API keys and integration configurations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { isDataFeedStubOffByDefault } from '@/lib/data-feeds';

export interface IntegrationSetting {
  id: string;
  provider_name: string;
  display_name: string;
  api_key?: string;
  api_key_masked?: string;
  config?: Record<string, any>;
  is_active: boolean;
  last_validated_at?: string;
  validation_status?: 'valid' | 'invalid' | 'not_tested' | 'error';
  validation_error?: string;
  created_at: string;
  updated_at: string;
}

export interface SaveIntegrationSettingParams {
  provider_name: string;
  api_key: string;
  config?: Record<string, any>;
}

// ============================================
// QUERY KEYS
// ============================================
export const integrationSettingsKeys = {
  all: ['integration-settings'] as const,
  byProvider: (provider: string) => [...integrationSettingsKeys.all, provider] as const,
};

// ============================================
// QUERIES
// ============================================

/**
 * Get all integration settings
 */
export function useIntegrationSettings() {
  return useQuery({
    queryKey: integrationSettingsKeys.all,
    queryFn: async (): Promise<IntegrationSetting[]> => {
      const { data, error } = await supabase
        .from('integration_settings')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching integration settings:', error);
        throw error;
      }

      return (data || []) as IntegrationSetting[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Get integration setting by provider name
 */
export function useIntegrationSetting(provider: string) {
  return useQuery({
    queryKey: integrationSettingsKeys.byProvider(provider),
    queryFn: async (): Promise<IntegrationSetting | null> => {
      const { data, error } = await supabase
        .from('integration_settings')
        .select('*')
        .eq('provider_name', provider)
        .maybeSingle();

      if (error) {
        console.error(`Error fetching ${provider} integration:`, error);
        throw error;
      }

      return data as IntegrationSetting | null;
    },
    enabled: !!provider,
    staleTime: 5 * 60 * 1000,
  });
}

// ============================================
// MUTATIONS
// ============================================

/**
 * Save or update an integration setting
 */
export function useSaveIntegrationSetting() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: SaveIntegrationSettingParams) => {
      const { provider_name, api_key, config } = params;

      // Mask the API key for display
      const maskApiKey = (key: string): string => {
        if (!key || key.length < 8) return '';
        return `${key.substring(0, 3)}...${key.substring(key.length - 4)}`;
      };

      const api_key_masked = maskApiKey(api_key);

      // Get provider display name
      const displayNames: Record<string, string> = {
        openai: 'OpenAI',
        anthropic: 'Anthropic',
        google: 'Google AI',
        perplexity: 'Perplexity',
        lendingpad: 'LendingPad',
        hubspot: 'HubSpot',
        encompass: 'Encompass',
        zoom: 'Zoom',
        sendgrid: 'SendGrid',
        'freddie-mac': 'Freddie Mac',
        'fannie-mae': 'Fannie Mae',
        'credit-bureau': 'Credit Bureau',
        'voe-provider': 'VOE / VOI Provider',
        'avm-provider': 'AVM Provider',
        'aus-fannie-du': 'AUS — Fannie Mae DU',
        'aus-freddie-lp': 'AUS — Freddie Mac LPA',
        'investor-tpo-connector': 'Investor / TPO connector (stub)',
        'hedge-data-vendor': 'Hedge data vendor (stub)',
        'appraisal-amc-stub': 'Appraisal / AMC vendor (stub)',
        'flood-cert-vendor-stub': 'Flood determination vendor (stub)',
        'title-vendor-stub': 'Title / settlement vendor (stub)',
        'homeowners-insurance-vendor-stub': 'Homeowners insurance vendor (stub)',
        'ron-provider-stub': 'Remote online notary (RON) provider (stub)',
        'eclose-platform-stub': 'eClose / eNote platform (stub)',
        'adverse-action-notice-stub': 'Adverse action notice vendor (stub)',
      };

      const display_name = displayNames[provider_name] || provider_name;

      // Check if integration already exists
      const { data: existing } = await supabase
        .from('integration_settings')
        .select('id')
        .eq('provider_name', provider_name)
        .maybeSingle();

      let result;

      const offByDefault = isDataFeedStubOffByDefault(provider_name);

      if (existing) {
        // Update existing
        const baseUpdate = {
          api_key,
          api_key_masked,
          config: config || {},
          validation_status: 'not_tested' as const,
          updated_at: new Date().toISOString(),
        };
        const { data, error } = await supabase
          .from('integration_settings')
          .update(
            offByDefault ? baseUpdate : { ...baseUpdate, is_active: true },
          )
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        result = data;
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('integration_settings')
          .insert({
            provider_name,
            display_name,
            api_key,
            api_key_masked,
            config: config || {},
            is_active: !offByDefault,
            validation_status: 'not_tested',
          })
          .select()
          .single();

        if (error) throw error;
        result = data;
      }

      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: integrationSettingsKeys.all });
      queryClient.invalidateQueries({ 
        queryKey: integrationSettingsKeys.byProvider(data.provider_name) 
      });
      toast({
        title: 'Success',
        description: 'Integration settings saved.',
      });
    },
    onError: (error: any) => {
      console.error('Error saving integration:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save API key',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Test/validate an API key
 */
export function useValidateIntegrationKey() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      provider_name,
      api_key,
      zoom_client_id,
      zoom_account_id,
      lendingpad_client_id,
      lendingpad_authorize_url,
      lendingpad_token_url,
      data_feed_base_url,
      encompass_username,
      encompass_client_id,
      encompass_token_url,
    }: {
      provider_name: string;
      api_key: string;
      zoom_client_id?: string;
      zoom_account_id?: string;
      lendingpad_client_id?: string;
      lendingpad_authorize_url?: string;
      lendingpad_token_url?: string;
      data_feed_base_url?: string;
      encompass_username?: string;
      encompass_client_id?: string;
      encompass_token_url?: string;
    }) => {
      try {
        const body: Record<string, string> = { provider: provider_name, apiKey: api_key };
        if (provider_name === 'zoom') {
          if (zoom_client_id) body.zoomClientId = zoom_client_id;
          if (zoom_account_id) body.zoomAccountId = zoom_account_id;
        }
        if (provider_name === 'lendingpad') {
          if (lendingpad_client_id) body.lendingpadClientId = lendingpad_client_id;
          if (lendingpad_authorize_url) body.lendingpadAuthorizeUrl = lendingpad_authorize_url;
          if (lendingpad_token_url) body.lendingpadTokenUrl = lendingpad_token_url;
        }
        if (provider_name === 'encompass') {
          if (encompass_username) body.encompassUsername = encompass_username;
          if (encompass_client_id) body.encompassClientId = encompass_client_id;
          if (encompass_token_url) body.encompassTokenUrl = encompass_token_url;
        }
        if (
          provider_name === 'hubspot' ||
          provider_name === 'encompass' ||
          provider_name === 'freddie-mac' ||
          provider_name === 'fannie-mae' ||
          provider_name === 'credit-bureau' ||
          provider_name === 'voe-provider' ||
          provider_name === 'avm-provider' ||
          provider_name === 'aus-fannie-du' ||
          provider_name === 'aus-freddie-lp' ||
          provider_name === 'investor-tpo-connector' ||
          provider_name === 'hedge-data-vendor' ||
          provider_name === 'appraisal-amc-stub' ||
          provider_name === 'flood-cert-vendor-stub' ||
          provider_name === 'title-vendor-stub' ||
          provider_name === 'homeowners-insurance-vendor-stub' ||
          provider_name === 'ron-provider-stub' ||
          provider_name === 'eclose-platform-stub' ||
          provider_name === 'adverse-action-notice-stub'
        ) {
          if (data_feed_base_url) body.dataFeedBaseUrl = data_feed_base_url;
        }
        const { data, error } = await supabase.functions.invoke('validate-api-key', {
          body,
        });

        if (error) throw error;

        return data;
      } catch (error: any) {
        // If function doesn't exist, show helpful message
        if (error.message?.includes('FunctionsRelayError') || 
            error.message?.includes('not found') ||
            error.message?.includes('404')) {
          throw new Error('Validation function not deployed. You can still save the key - it will be tested when used.');
        }
        throw error;
      }
    },
    onSuccess: (data, variables) => {
      const d = data as {
        valid?: boolean;
        error?: string;
        details?: { message?: string };
      };
      // Update validation status in database
      supabase
        .from('integration_settings')
        .update({
          validation_status: d.valid ? 'valid' : 'invalid',
          validation_error: d.error || null,
          last_validated_at: new Date().toISOString(),
        })
        .eq('provider_name', variables.provider_name)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: integrationSettingsKeys.all });
        });

      toast({
        title: d.valid ? 'Success' : 'Validation Failed',
        description: d.valid
          ? (d.details?.message ?? 'Validated successfully.')
          : (d.error || 'Validation failed'),
        variant: d.valid ? 'default' : 'destructive',
      });
    },
    onError: (error: any) => {
      console.error('Error validating API key:', error);
      toast({
        title: 'Validation Error',
        description: error.message || 'Failed to validate API key',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Delete an integration setting
 */
export function useDeleteIntegrationSetting() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (provider_name: string) => {
      const { error } = await supabase
        .from('integration_settings')
        .delete()
        .eq('provider_name', provider_name);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: integrationSettingsKeys.all });
      toast({
        title: 'Success',
        description: 'Integration removed successfully',
      });
    },
    onError: (error: any) => {
      console.error('Error deleting integration:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove integration',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Toggle integration active status
 */
export function useToggleIntegrationStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      provider_name,
      is_active,
    }: {
      provider_name: string;
      is_active: boolean;
    }) => {
      const { data, error } = await supabase
        .from('integration_settings')
        .update({ is_active })
        .eq('provider_name', provider_name)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: integrationSettingsKeys.all });
      toast({
        title: 'Success',
        description: `Integration ${data.is_active ? 'enabled' : 'disabled'}`,
      });
    },
    onError: (error: any) => {
      console.error('Error toggling integration:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to toggle integration',
        variant: 'destructive',
      });
    },
  });
}
