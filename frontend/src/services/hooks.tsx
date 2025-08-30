import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { CancelQuery, ListDatabases, ListTables, RunQuery } from "./clickhouse";

export function useDatabase() {
  return useQuery({
    queryKey: ["databases"],
    queryFn: () => ListDatabases(),
    retry: 3,
  });
}

export function useTables(database?: string) {
  return useQuery<string[], Error>({
    queryKey: ["tables", database ?? ""],
    queryFn: async () => {
      if (!database) return [];
      const rows = await ListTables(database);
      return rows ?? [];
    },
    enabled: !!database,

    refetchOnWindowFocus: false,
    staleTime: 10_000,
    retry: 2,
    placeholderData: keepPreviousData,
  });
}

export function useRunQuery() {
  return useMutation({
    mutationFn: async ({ sql, queryId }: { sql: string; queryId?: string }) => {
      if (!sql?.trim()) {
        throw new Error("SQL cannot be empty");
      }
      return RunQuery(sql, queryId);
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