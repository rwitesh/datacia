import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { useAppContext } from "./AppContext";
import { fetchTables } from "@/services/hooks";
import { Cancel, RunQuery } from "@/services/clickhouse";

export interface Tab {
  id: string;
  title: string;
  table?: string;
  sql: string;
  results: any[] | null;
  error?: string;
  isExecuting: boolean;
  mode: "query" | "table";
  limit?: number;
  offset?: number;
}

type EditorContextType = {
  // List of tables
  tables: {
    data: string[];
    loading: boolean;
    error?: Error | null;
    refresh: () => void;
  };

  // Tab management
  tabs: Tab[];
  activeTab: Tab | undefined;
  createTab: (title?: string, mode?: "query" | "table") => Tab;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateTab: (tabId: string, updates: Partial<Tab>) => void;

  // Query execution
  runQuery: (tabId?: string, sql?: string) => Promise<void>;
  stopQuery: (tabId?: string) => Promise<void>;
};

const EditorContext = createContext<EditorContextType | undefined>(undefined);

export const EditorProvider = ({ children }: { children: React.ReactNode }) => {
  const { database } = useAppContext();
  const { tables, loading, error, refresh } = fetchTables(database);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const createTab = useCallback(
    (title?: string, mode: "query" | "table" = "query"): Tab => {
      const newId = `tab-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 9)}`;
      const tabNumber = tabs.length + 1;

      const newTab: Tab = {
        id: newId,
        title: title || `Query ${tabNumber}`,
        table: mode === "table" ? title : undefined,
        sql: "",
        results: null,
        error: undefined,
        isExecuting: false,
        mode,
        limit: mode === "table" ? 100 : undefined,
        offset: mode === "table" ? 0 : undefined,
      };

      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(newId);
      return newTab;
    },
    [tabs.length]
  );

  const closeTab = useCallback(
    (tabId: string) => {
      stopQuery(tabId).catch((err) => {
        console.error("Error cancelling query for closed tab:", err);
      });

      setTabs((prev) => {
        const filtered = prev.filter((tab) => tab.id !== tabId);

        // If closing an active tab, switch to another tab
        if (activeTabId === tabId && filtered.length > 0) {
          const currentIndex = prev.findIndex((tab) => tab.id === tabId);
          const newActiveIndex = Math.min(currentIndex, filtered.length - 1);
          setActiveTabId(filtered[newActiveIndex].id);
        }
        return filtered;
      });
    },
    [activeTabId, createTab]
  );

  const setActiveTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);
  }, []);

  const updateTab = useCallback((tabId: string, updates: Partial<Tab>) => {
    setTabs((prev) =>
      prev.map((tab) => (tab.id === tabId ? { ...tab, ...updates } : tab))
    );
  }, []);

  // Query execution functions
  const runQuery = useCallback(
    async (tabId?: string, sql?: string) => {
      const targetTabId = tabId || activeTabId;
      if (!targetTabId) return;

      let querySQL = sql;
      if (!querySQL) {
        const currentTab = tabs.find((tab) => tab.id === targetTabId);
        if (!currentTab || !currentTab.sql.trim()) {
          return;
        }
        querySQL = currentTab.sql;
      }

      updateTab(targetTabId, {
        isExecuting: true,
        results: null,
        error: undefined,
      });

      try {
        const response = await RunQuery(querySQL);
        updateTab(targetTabId, {
          results: response,
          isExecuting: false,
        });
      } catch (err: any) {
        updateTab(targetTabId, {
          error: err?.message || String(err) || "Error executing query",
          results: null,
          isExecuting: false,
        });
      }
    },
    [activeTabId, tabs, updateTab]
  );

  const stopQuery = useCallback(
    async (tabId?: string) => {
      const targetTabId = tabId || activeTabId;
      if (!targetTabId) return;

      try {
        await Cancel();
        updateTab(targetTabId, {
          error: "Query execution cancelled",
          results: null,
          isExecuting: false,
        });
      } catch (err) {
        console.error("Error cancelling query:", err);
        updateTab(targetTabId, {
          error: "Error cancelling query",
          isExecuting: false,
        });
      }
    },
    [activeTabId, updateTab]
  );

  const activeTab = tabs.find((tab) => tab.id === activeTabId);

  const value = useMemo<EditorContextType>(
    () => ({
      // Table list
      tables: {
        data: tables,
        loading,
        error,
        refresh,
      },

      // Tab Management
      tabs,
      activeTab,
      createTab,
      closeTab,
      setActiveTab,
      updateTab,

      // Query execution
      runQuery,
      stopQuery,
    }),
    [
      tables,
      loading,
      error,
      refresh,
      tabs,
      activeTab,
      createTab,
      closeTab,
      setActiveTab,
      updateTab,
      runQuery,
      stopQuery,
    ]
  );

  return (
    <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
  );
};

export const useEditorContext = () => {
  const ctx = useContext(EditorContext);
  if (!ctx)
    throw new Error("useEditorContext must be used within an EditorProvider");
  return ctx;
};
