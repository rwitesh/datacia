import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import {
  ListConnections,
  LoadConnection,
  ListDatabases,
  ListTables,
  CancelQuery,
  GetCurrentConnectionInfo,

} from "./bindings";
import type { ConnectionInfo } from "./bindings";

export type ConnectionHealth = number | null;
import { RunQuery, GetTableData, GetTableSchema, GetQueryHistory } from "./database";
import { CheckForUpdates, PerformUpdate } from "./updates";
import { CheckConnectionHealth } from "./common";

export function useCurrentConnection() {
  return useQuery({
    queryKey: ["current-connection"],
    queryFn: () => GetCurrentConnectionInfo(),
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useDatabase() {
  return useQuery({
    queryKey: ["databases"],
    queryFn: () => ListDatabases(),
    retry: 3,
  });
}

export function useTables() {
  return useQuery<string[], Error>({
    queryKey: ["tables"],
    queryFn: () => ListTables(),
    refetchOnWindowFocus: false,
    retry: 3
  });
}

export function useRunQuery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sql, queryId }: { sql: string; queryId?: string }) => {
      if (!sql?.trim()) {
        throw new Error("SQL cannot be empty");
      }
      return RunQuery(sql, queryId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["query-history"] });
    },
  });
}

export function useCancelQuery() {
  return useMutation({
    mutationFn: async (queryId: string) => {
      if (!queryId) throw new Error("Missing queryId");
      return CancelQuery(queryId);
    },
  });
}

export function useFetchConnections() {
  return useQuery<Record<string, ConnectionInfo>, Error>({
    queryKey: ["connections"],
    queryFn: () => ListConnections(),
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

export function useGetTableData() {
  return useMutation({
    mutationFn: async ({
      table,
      limit,
      offset,
      orderBy,
      orderDir,
    }: {
      table: string;
      limit: number;
      offset: number;
      orderBy?: string;
      orderDir?: string;
    }) => {
      if (!table?.trim()) {
        throw new Error("Table name cannot be empty");
      }
      return GetTableData(table, limit, offset, orderBy, orderDir);
    },
  });
}

export function useGetTableSchema() {
  return useMutation({
    mutationFn: async (table: string) => {
      if (!table?.trim()) {
        throw new Error("Table name cannot be empty");
      }
      return GetTableSchema(table);
    },
  });
}


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

export function useGetQueryHistory() {
  return useQuery({
    queryKey: ["query-history"],
    queryFn: () => GetQueryHistory(50),
    retry: 3,
    refetchOnWindowFocus: true,
  });
}

export function useSwitchConnectionMutation() {
  return useMutation({
    mutationFn: async (id: string) => {
      // Close the current connection first (quietly)
      // Pass false to not close editor - we're just switching connections
      const { CloseCurrentConnection, EstablishConnection } = await import("./common");
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

