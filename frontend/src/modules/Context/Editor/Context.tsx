import { createContext } from "react";
import type { QueryResult } from "@/services/clickhouse";

export interface Tab {
  id: string;
  title: string;
  table?: string;
  sql: string;
  results: QueryResult | null;
  error?: string;
  isExecuting: boolean;
  mode: "query" | "table";
  queryID?: string;
  limit?: number;
  offset?: number;
  pagination: boolean;
}

export type EditorContextType = {
  // List of tables
  tables: {
    data: string[];
    isLoading: boolean;
    error?: Error | null;
    refetch: () => void;
  };

  // Tab management
  tabs: Tab[];
  activeTab: Tab | undefined;
  createTab: (title?: string, mode?: "query" | "table") => Tab;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateTab: (tabId: string, updates: Partial<Tab>) => void;

  // Query execution
  runQuery: (
    tabId?: string,
    sql?: string,
    pagination?: boolean
  ) => Promise<void>;
  stopQuery: (tabId?: string) => Promise<void>;
};

export const EditorContext = createContext<EditorContextType | undefined>(
  undefined
);
