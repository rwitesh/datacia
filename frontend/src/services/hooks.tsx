import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ListDatabases, ListTables } from "./clickhouse";

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

