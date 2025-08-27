import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ListDatabases, ListTables } from "./clickhouse";

export function fetchDatabase() {
  return useQuery({
    queryKey: ["databases"],
    queryFn: () => ListDatabases(),
    retry: 3,
  });
}

export function fetchTables(database: string) {
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

