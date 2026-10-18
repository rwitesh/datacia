import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ListDatabases,
  ListTables,
  CancelQuery,
} from "./bindings";
import { RunQuery, GetTableData, GetTableSchema, GetDDL, GetQueryHistory } from "./bindings/database";
import { queryKeys } from "./queryKeys";

export function useDatabase() {
  return useQuery({
    queryKey: queryKeys.databases,
    queryFn: () => ListDatabases(),
    retry: 3,
  });
}

export function useTables() {
  return useQuery<string[], Error>({
    queryKey: queryKeys.tables,
    queryFn: () => ListTables(),
    refetchOnWindowFocus: false,
    retry: 3
  });
}

export function useRunQuery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sql, queryId }: { sql: string; queryId: string }) => {
      if (!sql?.trim()) {
        throw new Error("SQL cannot be empty");
      }
      return RunQuery(sql, queryId);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.queryHistory });
      // Only a command can change the schema (CREATE, DROP, ALTER, etc.).
      if (result.type !== "read") {
        queryClient.invalidateQueries({ queryKey: queryKeys.tables });
        queryClient.invalidateQueries({ queryKey: queryKeys.ddl });
      }
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

export function useGetDDL(table: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.tableDdl(table),
    queryFn: () => GetDDL(table ?? ""),
    enabled: enabled && !!table?.trim(),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export interface QueryHistoryFilters {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  engine?: string;
}

export function useGetQueryHistory(filters: QueryHistoryFilters = {}) {
  const { search = "", dateFrom = "", dateTo = "", status = "", engine = "" } = filters;
  return useQuery({
    queryKey: queryKeys.queryHistoryFiltered(search, dateFrom, dateTo, status, engine),
    queryFn: () => GetQueryHistory(50, search, dateFrom, dateTo, status, engine),
    retry: 3,
    refetchOnWindowFocus: true,
  });
}
