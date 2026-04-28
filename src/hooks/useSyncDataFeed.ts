// MCT Lite: hidden-module stub. Original implementation references tables not in the Lite schema.
// @ts-nocheck

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

export function useSyncDataFeed(_provider?: string) {
  return noopMutation;
}
