import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { FetchTableData, ListDatabases, ListTables } from "./clickhouse";

export function fetchDatabase() {
  const { data: databases = [] } = useQuery({
    queryKey: ["databases"],
    queryFn: () => ListDatabases(),
    retry: 3,
  });
  return { databases };
}

export function fetchTables(database: string) {
  const {
    data: tables = [],
    isLoading,
    error,
    refetch,
  } = useQuery<string[], Error>({
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

  return {
    tables,
    loading: isLoading,
    error,
    refresh: () => {
      void refetch();
    },
  };
}

export function fetchTableData(table: string) {
  const {
    data: tableData = [],
    error,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["tableData", table],
    queryFn: () => FetchTableData(table),
    enabled: !!table,
    placeholderData: keepPreviousData,
  });

  return {
    tables: tableData,
    loading: isLoading,
    error: error?.message,
    refresh: () => {
      void refetch();
    },
  };
}
