import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import {
  ListConnections,
  LoadConnection,
  ListDatabases,
  ListTables,
  CancelQuery,
} from "../../bindings/layerbits/pkg/remote/engine";
import type { ConnectionInfo } from "../../bindings/layerbits/pkg/common";
import { RunQuery } from "./database";

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
