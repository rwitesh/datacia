import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Events, Updater } from "@wailsio/runtime";
import { toast } from "sonner";
import { errorMessage } from "@/lib/utils";
import { PendingUpdateVersion, RestartApp } from "./bindings/updates";
import { queryKeys } from "./queryKeys";

// Version of the update downloaded in the background and waiting for a restart
// ("" when there is none). Refreshed when the updater reports a staged update.
export function usePendingUpdate() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = Events.On(Updater.Events.UpdateReady, () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pendingUpdate });
    });
    return () => unsubscribe();
  }, [queryClient]);

  return useQuery({
    queryKey: queryKeys.pendingUpdate,
    queryFn: () => PendingUpdateVersion(),
  });
}

export function useRestartApp() {
  return useMutation({
    mutationFn: () => RestartApp(),
    onError: (err) => toast.error(errorMessage(err)),
  });
}
