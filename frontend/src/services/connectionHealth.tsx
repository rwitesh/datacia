import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { CheckConnectionHealth } from "./common";
import type { ConnectionHealth } from "./bindings";

const HEALTH_CHECK_INTERVAL = 10000; // 10 seconds
const RETRY_INTERVAL = 5000; // 5 seconds on failure

export function useConnectionHealth(enabled: boolean = true): UseQueryResult<ConnectionHealth, Error> {
  return useQuery<ConnectionHealth, Error>({
    queryKey: ["connection-health"],
    queryFn: () => CheckConnectionHealth(),
    enabled: enabled,
    refetchInterval: (query) => {
      if (query.state.error) return RETRY_INTERVAL;
      return HEALTH_CHECK_INTERVAL;
    },
    refetchOnWindowFocus: true,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

