// modules/Context/EditorContext.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAppContext } from "./AppContext";
import { fetchTables } from "@/services/hooks";

export interface Tab {
  id: string;
  title: string;
  sql: string;
  results: any[] | null;
  error: string | undefined;
  isExecuting: boolean;
  mode: "query" | "table";
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
  createTab: (title?: string, mode?: "query" | "table") => string;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateTab: (tabId: string, updates: Partial<Tab>) => void;
  renameTab: (tabId: string, title: string) => void;
};

const EditorContext = createContext<EditorContextType | undefined>(undefined);

export const EditorProvider = ({ children }: { children: React.ReactNode }) => {
  const { database } = useAppContext();

  // Fetch list of tables
  const { tables, loading, error, refresh } = fetchTables(database);

  // Tab Management State
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  // Create initial tab
  useEffect(() => {
    if (tabs.length === 0) {
      const initialTabId = createTab("Query 1");
      setActiveTabId(initialTabId);
    }
  }, []);

  const createTab = useCallback(
    (title?: string, mode: "query" | "table" = "query"): string => {
      const newId = `tab-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 9)}`;
      const tabNumber = tabs.length + 1;

      const newTab: Tab = {
        id: newId,
        title: title || `Query ${tabNumber}`,
        sql: "",
        results: null,
        error: undefined,
        isExecuting: false,
        mode,
      };

      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(newId);
      return newId;
    },
    [tabs.length]
  );

  const closeTab = useCallback(
    (tabId: string) => {
      setTabs((prev) => {
        const filtered = prev.filter((tab) => tab.id !== tabId);

        // If closing a active tab, switch to another tab
        if (activeTabId === tabId && filtered.length > 0) {
          const currentIndex = prev.findIndex((tab) => tab.id === tabId);
          const newActiveIndex = Math.min(currentIndex, filtered.length - 1);
          setActiveTabId(filtered[newActiveIndex].id);
        } else if (filtered.length === 0) {
          const newTabId = createTab("Query 1");
          setActiveTabId(newTabId);
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

  const renameTab = useCallback(
    (tabId: string, title: string) => {
      updateTab(tabId, { title });
    },
    [updateTab]
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
      renameTab,
    }),
    [tables, loading, error, refresh]
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
