import { useQuery, useMutation, type UseQueryResult } from "@tanstack/react-query";
import {
  ListConnections,
  LoadConnection,
  GetCurrentConnectionInfo,
} from "./bindings";
import type { ConnectionInfo } from "./bindings";
import { EstablishConnection } from "./bindings/connection";
import { CheckConnectionHealth } from "./bindings/connection";

export type ConnectionHealth = number | null;

export function useCurrentConnection() {
  return useQuery({
    queryKey: ["current-connection"],
    queryFn: () => GetCurrentConnectionInfo(),
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useFetchConnections() {
  return useQuery<Record<string, ConnectionInfo>, Error>({
    queryKey: ["connections"],
    queryFn: async () => {
      const connections = await ListConnections();
      return Object.fromEntries(
        Object.entries(connections).filter(
          (entry): entry is [string, ConnectionInfo] => entry[1] !== undefined
        )
      );
    },
    retry: 3,
  });
}

export function useFetchConnectionById(id: string) {
  return useQuery({
    queryKey: ["connection", id],
    queryFn: () => LoadConnection(id),
    enabled: !!id,
    retry: 3,
  });
}

export function useSwitchConnectionMutation() {
  return useMutation({
    // The backend closes the current connection only once the new one is
    // up, so a failed switch leaves the editor connected.
    mutationFn: (id: string) => EstablishConnection(id),
  });
}

const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
const RETRY_INTERVAL = 5000; // 5 seconds on failure

export function useConnectionHealth(): UseQueryResult<ConnectionHealth, Error> {
  return useQuery<ConnectionHealth, Error>({
    queryKey: ["connection-health"],
    queryFn: () => CheckConnectionHealth(),
    refetchInterval: (query) => {
      if (query.state.error) return RETRY_INTERVAL;
      return HEALTH_CHECK_INTERVAL;
    },
    refetchOnWindowFocus: true,
    retryOnMount: false,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    networkMode: 'always'
  });
}
