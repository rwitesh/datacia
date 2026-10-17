import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  useTables,
  useCancelQuery,
  useRunQuery,
  useGetTableData,
} from "@/services/database";
import { v4 as uuidv4 } from "uuid";
import { errorMessage } from "@/lib/utils";
import { EditorContext, type Tab, type TableDataParams } from "./Context";

export const EditorProvider = ({ children }: { children: React.ReactNode }) => {
  const { data = [], isLoading, isFetching, error, refetch } = useTables();
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  /* Each call below uses mutateAsync: a shared mutation only calls the
     onSuccess/onError passed to its latest mutate(), so with mutate() a
     query running in one tab never finished once another tab ran one. */
  const { mutateAsync: runQueryAsync } = useRunQuery();
  const { mutateAsync: cancelQueryAsync } = useCancelQuery();
  const { mutateAsync: getTableDataAsync } = useGetTableData();

  const createTab = useCallback(
    (title?: string, type: "query" | "table" = "query"): Tab => {
      const newId = `tab-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 9)}`;
      const tabNumber = tabs.length + 1;

      const newTab: Tab = {
        id: newId,
        title: title || `Query ${tabNumber}`,
        table: type === "table" ? title : undefined,
        sql: "",
        results: null,
        error: undefined,
        isExecuting: false,
        type,
        mode: "data",
        limit: type === "table" ? 50 : undefined,
        offset: type === "table" ? 0 : undefined,
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

      try {
        await cancelQueryAsync(targetTab.queryID);
        updateTab(targetTabId, {
          error: "Query execution cancelled",
          results: null,
          isExecuting: false,
          queryID: undefined,
        });
      } catch {
        updateTab(targetTabId, {
          error: "Error cancelling query",
          isExecuting: false,
        });
      }
    },
    [activeTabId, tabs, updateTab, cancelQueryAsync]
  );

  const closeTab = useCallback(
    (tabId: string) => {
      stopQuery(tabId).catch((err) => {
        console.error("Error cancelling query for closed tab:", err);
      });

      if (activeTabId === tabId) {
        const index = tabs.findIndex((tab) => tab.id === tabId);
        const remaining = tabs.filter((tab) => tab.id !== tabId);
        const next = remaining[Math.min(index, remaining.length - 1)];
        setActiveTabId(next?.id ?? null);
      }
      setTabs((prev) => prev.filter((tab) => tab.id !== tabId));
    },
    [activeTabId, tabs, stopQuery]
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

      // Only the run that is still the tab's current query may write to it,
      // so a cancelled run can't overwrite the "cancelled" message.
      const finishRun = (updates: Partial<Tab>) =>
        setTabs((prev) =>
          prev.map((tab) =>
            tab.id === targetTabId && tab.queryID === queryId
              ? { ...tab, ...updates, isExecuting: false }
              : tab
          )
        );

      try {
        const response = await runQueryAsync({ sql: querySQL, queryId });
        finishRun({ results: response, pagination });
      } catch (err) {
        finishRun({ error: errorMessage(err), results: null });
      }
    },
    [activeTabId, tabs, updateTab, runQueryAsync]
  );

  // The latest table load per tab: paging or sorting quickly can finish
  // requests out of order, and only the newest may write to the tab.
  const latestTableLoad = useRef(new Map<string, TableDataParams>());

  const loadTableData = useCallback(
    async (tabId: string, params: TableDataParams) => {
      latestTableLoad.current.set(tabId, params);
      const isLatest = () => latestTableLoad.current.get(tabId) === params;

      updateTab(tabId, { ...params, isExecuting: true, error: undefined });
      try {
        const results = await getTableDataAsync(params);
        if (isLatest()) {
          updateTab(tabId, { results, isExecuting: false, pagination: true });
        }
      } catch (err) {
        if (isLatest()) {
          updateTab(tabId, {
            error: errorMessage(err),
            results: null,
            isExecuting: false,
            pagination: false,
          });
        }
      }
    },
    [updateTab, getTableDataAsync]
  );

  const activeTab = tabs.find((tab) => tab.id === activeTabId);

  const value = useMemo(
    () => ({
      tables: { data, isLoading, isFetching, error, refetch },
      tabs,
      activeTab,
      createTab,
      closeTab,
      setActiveTab,
      updateTab,
      runQuery,
      stopQuery,
      loadTableData,
      tableRef,
    }),
    [
      data,
      isLoading,
      isFetching,
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
      loadTableData,
    ]
  );

  return (
    <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
  );
};
