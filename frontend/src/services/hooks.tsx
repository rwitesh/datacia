import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { RunQuery } from "./clickhouse";
import { ListConnections, LoadConnection } from "../../bindings/layerbit/pkg/remote/engine";
import { FetchTables, CancelQuery, FetchDatabases } from "../../bindings/layerbit/pkg/clickhouse/clickhouse";

export function useDatabase() {
  return useQuery({
    queryKey: ["databases"],
    queryFn: () => FetchDatabases(),
    retry: 3,
  });
}

export function useTables() {
  return useQuery<string[], Error>({
    queryKey: ["tables"],
    queryFn: async () => {
      const rows = await FetchTables();
      return rows ?? [];
    },
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

export function useFetchConnections() {
  return useQuery({
    queryKey: ["connections"],
    queryFn: () => ListConnections(),
    retry: 3,
  });
}

export function useFetchConnectionByName(name: string) {
  return useQuery({
    queryKey: ["connection", name],
    queryFn: () => LoadConnection(name),
    enabled: !!name,
    retry: 3,
  });
}