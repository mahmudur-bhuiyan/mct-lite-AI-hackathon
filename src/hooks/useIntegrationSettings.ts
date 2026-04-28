// MCT Lite: hidden-module stub. Original implementation references tables not in the Lite schema.
// Provides no-op exports so imports resolve at build time. Hidden modules are gated at runtime.
// @ts-nocheck
import { useQuery } from "@tanstack/react-query";

const noopResult = { data: null, isLoading: false, isError: false, error: null, refetch: async () => ({ data: null }) };
const noopListResult = { data: [], isLoading: false, isError: false, error: null, refetch: async () => ({ data: [] }) };
const noopMutation = {
  mutate: () => {},
  mutateAsync: async () => null,
  isPending: false,
  isLoading: false,
  isError: false,
  isSuccess: false,
  error: null,
  reset: () => {},
};

export const integrationSettingsKeys = {
  all: ["integration-settings-stub"] as const,
  lists: () => ["integration-settings-stub", "list"] as const,
  detail: (id?: string) => ["integration-settings-stub", "detail", id ?? ""] as const,
  byProvider: (provider?: string) => ["integration-settings-stub", "provider", provider ?? ""] as const,
};

export function useIntegrationSetting(_provider?: string) {
  return useQuery({ queryKey: ["integration-setting-stub", _provider], queryFn: async () => null, enabled: false, initialData: null });
}

export function useIntegrationSettings() {
  return useQuery({ queryKey: ["integration-settings-stub"], queryFn: async () => [], enabled: false, initialData: [] });
}

export function useUpdateIntegrationSetting() { return noopMutation; }
export function useDeleteIntegrationSetting() { return noopMutation; }
export function useTestIntegrationConnection() { return noopMutation; }
export function useToggleIntegrationActive() { return noopMutation; }
export function useToggleIntegrationStatus() { return noopMutation; }
export function useSaveIntegrationSetting() { return noopMutation; }
export function useCreateIntegrationSetting() { return noopMutation; }
export function useValidateIntegrationKey() { return noopMutation; }

export type IntegrationSetting = {
  id: string;
  provider_name: string;
  display_name: string;
  is_active: boolean;
  api_key?: string | null;
  api_key_masked?: string | null;
  config?: Record<string, any>;
  validation_status?: string | null;
  updated_at?: string;
};

export default useIntegrationSettings;
