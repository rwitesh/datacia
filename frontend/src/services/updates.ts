import { useQuery, useMutation } from "@tanstack/react-query";
import { CheckForUpdates, PerformUpdate } from "./bindings/updates";

export function useCheckForUpdates() {
  return useQuery({
    queryKey: ["check-for-updates"],
    queryFn: () => CheckForUpdates(),
    retry: 3,
  });
}

export function useUpdateApp() {
  return useMutation({
    mutationFn: async () => {
      return PerformUpdate();
    },
  })
}
