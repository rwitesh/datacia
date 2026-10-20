/** Every TanStack Query key. A bare entry (e.g. `ddl`) is the prefix for invalidating its family. */
export const queryKeys = {
  currentConnection: ["current-connection"] as const,
  connections: ["connections"] as const,
  connection: (id: string) => ["connection", id] as const,
  connectionHealth: ["connection-health"] as const,
  databases: ["databases"] as const,
  tables: ["tables"] as const,
  ddl: ["ddl"] as const,
  tableDdl: (table: string | undefined) => ["ddl", table] as const,
  queriesTree: ["queries-tree"] as const,
  queryHistory: ["query-history"] as const,
  queryHistoryFiltered: (...filters: string[]) => ["query-history", ...filters] as const,
  settings: ["settings"] as const,
  pendingUpdate: ["pending-update"] as const,
  // Every AI query starts with `ai`, so a settings change refreshes them all.
  ai: ["ai"] as const,
  aiProviders: ["ai", "providers"] as const,
  aiModels: (providerId: string) => ["ai", "models", providerId] as const,
  aiDefaultModel: ["ai", "default-model"] as const,
  aiChats: ["ai", "chats"] as const,
};
