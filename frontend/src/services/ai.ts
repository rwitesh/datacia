import { useEffect } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Events } from "@wailsio/runtime";
import { toast } from "sonner";
import * as AI from "./bindings/ai";
import { errorMessage } from "@/lib/utils";
import type { ModelRef } from "./bindings/ai";
import { queryKeys } from "./queryKeys";

export type { ChatContext, ModelRef, ProviderStatus, QueryPreview, ToolUse, Usage } from "./bindings/ai";
export { Access, SignIn } from "./bindings/ai";

export function useAIProviders() {
  const queryClient = useQueryClient();
  useEffect(
    () =>
      Events.On("app:settings-changed", () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.ai });
      }),
    [queryClient],
  );
  return useQuery({ queryKey: queryKeys.aiProviders, queryFn: () => AI.Providers() });
}

/** Model lists for the given providers. The backend caches them too. */
export function useModelLists(providerIds: string[], enabled: (id: string) => boolean) {
  return useQueries({
    queries: providerIds.map((id) => ({
      queryKey: queryKeys.aiModels(id),
      queryFn: () => AI.ListModels(id),
      enabled: enabled(id),
      staleTime: 10 * 60_000,
      retry: false,
    })),
  });
}

export function useDefaultModel() {
  return useQuery({ queryKey: queryKeys.aiDefaultModel, queryFn: () => AI.DefaultModel() });
}

export function useSetDefaultModel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (model: ModelRef) => AI.SetDefaultModel(model),
    onMutate: (model) => queryClient.setQueryData(queryKeys.aiDefaultModel, model),
    // On success the settings-changed event refreshes it.
    onError: (err) => {
      toast.error(errorMessage(err));
      queryClient.invalidateQueries({ queryKey: queryKeys.aiDefaultModel });
    },
  });
}
