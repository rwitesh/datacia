import { createContext } from "react";
import type { QueryResult } from "@/services/bindings/database";
import type { SelectionGeometry } from "@/windows/editor/QueryResult/DataTable/utils/cellSelection";

export interface Tab {
  id: string;
  title: string;
  table?: string;
  sql: string;
  results: QueryResult | null;
  error?: string;
  isExecuting: boolean;
  type: "query" | "table";
  mode?: "data" | "ddl";
  queryID?: string;
  limit?: number;
  offset?: number;
  pagination: boolean;
  orderBy?: string;
  orderDir?: "asc" | "desc";
  savedPath?: string;
  scroll?: { left: number; top: number };
  selection?: SelectionGeometry | null;
}

export type EditorContextType = {
  // List of tables
  tables: {
    data: string[];
    isLoading: boolean;
    isFetching: boolean;
    error?: Error | null;
    refetch: () => void;
  };

  // Tab management
  tabs: Tab[];
  activeTab: Tab | undefined;
  createTab: (title?: string, type?: "query" | "table") => Tab;
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
