import React, { useCallback, useMemo, useState } from "react";
import { useAppContext } from "../App/Index";
import { useTables, useCancelQuery, useRunQuery } from "@/services/hooks";
import { v4 as uuidv4 } from "uuid";
import { EditorContext, type Tab } from "./Context";

export const EditorProvider = ({ children }: { children: React.ReactNode }) => {
  const { metadata } = useAppContext();
  const { data = [], isLoading, error, refetch } = useTables(metadata?.database);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const runQueryMutation = useRunQuery();
  const cancelQueryMutation = useCancelQuery();

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
        limit: mode === "table" ? 250 : undefined,
        offset: mode === "table" ? 0 : undefined,
        pagination: false,
      };

      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(newId);
      return newTab;
    },
    [tabs.length]
  );

  const updateTab = useCallback((tabId: string, updates: Partial<Tab>) => {
    setTabs((prev) =>
      prev.map((tab) => (tab.id === tabId ? { ...tab, ...updates } : tab))
    );
  }, []);

  const stopQuery = useCallback(
    async (tabId?: string) => {
      const targetTabId = tabId || activeTabId;
      if (!targetTabId) return;

      const targetTab = tabs.find((tab) => tab.id === targetTabId);
      if (!targetTab?.queryID) return;

      cancelQueryMutation.mutate(targetTab.queryID, {
        onSuccess: () => {
          updateTab(targetTabId, {
            error: "Query execution cancelled",
            results: null,
            isExecuting: false,
            queryID: undefined,
          });
        },
        onError: () => {
          updateTab(targetTabId, {
            error: "Error cancelling query",
            isExecuting: false,
          });
        },
      });
    },
    [activeTabId, tabs, updateTab, cancelQueryMutation]
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
    [activeTabId, stopQuery]
  );

  const setActiveTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);
  }, []);

  const runQuery = useCallback(
    async (tabId?: string, sql?: string, pagination: boolean = false) => {
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

      const queryId = uuidv4();

      updateTab(targetTabId, {
        isExecuting: true,
        sql: querySQL,
        queryID: queryId,
        results: null,
        error: undefined,
      });

      runQueryMutation.mutate(
        { sql: querySQL, queryId },
        {
          onSuccess: (response) => {
            updateTab(targetTabId, {
              results: response,
              isExecuting: false,
              pagination,
            });
          },
          onError: (err: unknown) => {
            const message =
              err instanceof Error
                ? err.message
                : String(err) || "Error executing query";

            updateTab(targetTabId, {
              error: message,
              results: null,
              isExecuting: false,
            });
          },
        }
      );
    },
    [activeTabId, tabs, updateTab, runQueryMutation]
  );

  const activeTab = tabs.find((tab) => tab.id === activeTabId);

  const value = useMemo(
    () => ({
      tables: { data, isLoading, error, refetch },
      tabs,
      activeTab,
      createTab,
      closeTab,
      setActiveTab,
      updateTab,
      runQuery,
      stopQuery,
    }),
    [
      data,
      isLoading,
      error,
      refetch,
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
