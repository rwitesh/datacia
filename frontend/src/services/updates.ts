import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Events, Updater } from "@wailsio/runtime";
import { PendingUpdateVersion, RestartApp } from "./bindings/updates";

const pendingUpdateKey = ["pending-update"];

// Version of the update downloaded in the background and waiting for a restart
// ("" when there is none). Refreshed when the updater reports a staged update.
export function usePendingUpdate() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = Events.On(Updater.Events.UpdateReady, () => {
      queryClient.invalidateQueries({ queryKey: pendingUpdateKey });
    });
    return () => unsubscribe();
  }, [queryClient]);

  return useQuery({
    queryKey: pendingUpdateKey,
    queryFn: () => PendingUpdateVersion(),
  });
}

export function useRestartApp() {
  return useMutation({
    mutationFn: async () => {
      return RestartApp();
    },
  })
}
