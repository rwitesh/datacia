import { useQuery, useMutation, type UseQueryResult } from "@tanstack/react-query";
import {
  ListConnections,
  LoadConnection,
  GetCurrentConnectionInfo,
} from "./bindings";
import type { ConnectionInfo } from "./bindings";
import { CloseCurrentConnection, EstablishConnection } from "./bindings/connection";
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
    mutationFn: async (id: string) => {
      // Close the current connection first (quietly)
      // Pass false to not close editor - we're just switching connections
      try {
        await CloseCurrentConnection(false);
      } catch {
        // Ignore close errors - connection might already be closed
      }
      // Establish the new connection
      await EstablishConnection(id);
    },
  });
}

const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
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
    retryOnMount: false,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    networkMode: 'always'
  });
}
