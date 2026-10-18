import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  useTables,
  useCancelQuery,
  useRunQuery,
  useGetTableData,
} from "@/services/database";
import { v4 as uuidv4 } from "uuid";
import { errorMessage } from "@/lib/utils";
import {
  EditorContext,
  type SelectedData,
  type Tab,
  type TableDataParams,
} from "./Context";

export const EditorProvider = ({ children }: { children: React.ReactNode }) => {
  const { data = [], isLoading, error } = useTables();
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const [readSelection, setReadSelectionState] = useState<(() => SelectedData) | null>(null);
  const setReadSelection = useCallback(
    (read: (() => SelectedData) | null) => setReadSelectionState(() => read),
    []
  );
  // SQL typed in an editor but not yet committed to its tab, so typing
  // doesn't rebuild the tabs (and re-render every consumer) per keystroke.
  const drafts = useRef(new Map<string, string>());
  // Numbers "Query N" titles; unlike tabs.length it never repeats after a close.
  const queryTabCount = useRef(0);

  /* Each call below uses mutateAsync: a shared mutation only calls the
     onSuccess/onError passed to its latest mutate(), so with mutate() a
     query running in one tab never finished once another tab ran one. */
  const { mutateAsync: runQueryAsync } = useRunQuery();
  const { mutateAsync: cancelQueryAsync } = useCancelQuery();
  const { mutateAsync: getTableDataAsync } = useGetTableData();

  const createTab = useCallback(
    (title?: string, type: "query" | "table" = "query"): Tab => {
      const newId = uuidv4();

      const newTab: Tab = {
        id: newId,
        title: title || `Query ${++queryTabCount.current}`,
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
    []
  );

  const updateTab = useCallback((tabId: string, updates: Partial<Tab>) => {
    // An explicit write replaces whatever was typed since the last commit.
    if (updates.sql !== undefined) drafts.current.delete(tabId);
    setTabs((prev) =>
      prev.map((tab) => (tab.id === tabId ? { ...tab, ...updates } : tab))
    );
  }, []);

  const getSql = useCallback(
    (tabId: string) =>
      drafts.current.get(tabId) ?? tabs.find((tab) => tab.id === tabId)?.sql ?? "",
    [tabs]
  );

  const setDraftSql = useCallback((tabId: string, sql: string) => {
    drafts.current.set(tabId, sql);
  }, []);

  const commitDraftSql = useCallback(
    (tabId: string) => {
      const sql = drafts.current.get(tabId);
      if (sql !== undefined) updateTab(tabId, { sql });
    },
    [updateTab]
  );

  // The latest table load per tab: paging or sorting quickly can finish
  // requests out of order, and only the newest may write to the tab.
  const latestTableLoad = useRef(new Map<string, TableDataParams>());

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
      // Cancelled directly rather than through stopQuery, which would write
      // a "cancelled" error into the tab being closed.
      const queryID = tabs.find((tab) => tab.id === tabId)?.queryID;
      if (queryID) {
        cancelQueryAsync(queryID).catch((err) => {
          console.error("Error cancelling query for closed tab:", err);
        });
      }
      drafts.current.delete(tabId);
      latestTableLoad.current.delete(tabId);

      if (activeTabId === tabId) {
        const index = tabs.findIndex((tab) => tab.id === tabId);
        const remaining = tabs.filter((tab) => tab.id !== tabId);
        const next = remaining[Math.min(index, remaining.length - 1)];
        setActiveTabId(next?.id ?? null);
      }
      setTabs((prev) => prev.filter((tab) => tab.id !== tabId));
    },
    [activeTabId, tabs, cancelQueryAsync]
  );

  const setActiveTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);
  }, []);

  const runQuery = useCallback(
    async (tabId?: string, sql?: string, pagination: boolean = false) => {
      const targetTabId = tabId || activeTabId;
      if (!targetTabId) return;

      const querySQL = sql || getSql(targetTabId);
      if (!querySQL.trim()) return;

      const queryId = uuidv4();

      updateTab(targetTabId, {
        isExecuting: true,
        sql: querySQL,
        queryID: queryId,
        results: null,
        error: undefined,
        // The previous result's selection doesn't apply to the new one.
      });

      // Only the run that is still the tab's current query may write to it,
      // so a cancelled run can't overwrite the "cancelled" message.
      const finishRun = (updates: Partial<Tab>) =>
        setTabs((prev) =>
          prev.map((tab) =>
            tab.id === targetTabId && tab.queryID === queryId
              ? // The old grid saves its scroll and selection as it unmounts,
                // after the run starts, so the new result's are reset only here.
                { ...tab, ...updates, scroll: undefined, selection: undefined, isExecuting: false }
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
    [activeTabId, getSql, updateTab, runQueryAsync]
  );

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
      tables: { data, isLoading, error },
      tabs,
      activeTab,
      createTab,
      closeTab,
      setActiveTab,
      updateTab,
      getSql,
      setDraftSql,
      commitDraftSql,
      runQuery,
      stopQuery,
      loadTableData,
      tableRef,
      readSelection,
      setReadSelection,
    }),
    [
      data,
      isLoading,
      error,
      tabs,
      activeTab,
      createTab,
      closeTab,
      setActiveTab,
      updateTab,
      getSql,
      setDraftSql,
      commitDraftSql,
      runQuery,
      stopQuery,
      loadTableData,
      readSelection,
      setReadSelection,
    ]
  );

  return (
    <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
  );
};
