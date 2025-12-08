import { AppWindowIcon, Loader2, Table, History, CheckCircle2, XCircle } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useEditorContext } from "@/modules/Context/Editor/Index";
import { useGetTableData, useGetTableSchema, useGetQueryHistory } from "@/services/hooks";
import { timeAgo } from "./utils";
import type { QueryHistoryItem } from "@/services/database";

export function EditorSidebar() {
  const {
    tables: { data, isLoading, isFetching, error },
    createTab,
    updateTab,
    activeTab,
  } = useEditorContext();

  const getTableDataMutation = useGetTableData();
  const getTableSchemaMutation = useGetTableSchema();
  const { data: queryHistory, isLoading: isHistoryLoading, refetch: refetchHistory } = useGetQueryHistory();

  const handleTableClick = async (table: string) => {
    const tab = createTab(table, "table");
    if (!tab.table || tab.limit === undefined || tab.offset === undefined) {
      return;
    }

    updateTab(tab.id, {
      isExecuting: true,
      results: null,
      error: undefined,
    });

    getTableDataMutation.mutate(
      {
        table: tab.table,
        limit: tab.limit,
        offset: tab.offset,
      },
      {
        onSuccess: (response) => {
          updateTab(tab.id, {
            results: response,
            isExecuting: false,
            pagination: true,
          });
        },
        onError: (err: unknown) => {
          const message =
            err instanceof Error
              ? err.message
              : String(err) || "Error fetching table data";
          updateTab(tab.id, {
            error: message,
            results: null,
            isExecuting: false,
            pagination: false,
          });
        },
      }
    );
  };

  const handleOpenTableSchema = async (table: string) => {
    const tab = createTab(table, "table");
    if (!tab.table) {
      return;
    }

    updateTab(tab.id, {
      isExecuting: true,
      results: null,
      error: undefined,
    });

    getTableSchemaMutation.mutate(tab.table, {
      onSuccess: (response) => {
        updateTab(tab.id, {
          results: response,
          isExecuting: false,
          pagination: false,
        });
      },
      onError: (err: unknown) => {
        const message =
          err instanceof Error
            ? err.message
            : String(err) || "Error fetching table schema";
        updateTab(tab.id, {
          error: message,
          results: null,
          isExecuting: false,
          pagination: false,
        });
      },
    });
  };

  const handleHistoryClick = (sql: string) => {
    if (activeTab) {
      updateTab(activeTab.id, { sql });
    } else {
      const tab = createTab("Query", "query");
      updateTab(tab.id, { sql });
    }
  };

  return (
    <div className="h-full min-h-0 w-full flex flex-col select-none cursor-default pt-12 bg-sidebar">
      <Tabs defaultValue="tables" className="flex flex-1 min-h-0 flex-col">
        <div className="sticky top-0 z-10 border-b border-sidebar-border bg-sidebar px-2 py-1">
          <TabsList className="grid w-full grid-cols-2 bg-transparent p-0">
            <TabsTrigger
              value="tables"
              className="flex items-center gap-2 px-3 py-1.5 text-xs data-[state=active]:bg-sidebar-accent"
            >
              <AppWindowIcon className="h-4 w-4" />
              <span>Tables</span>
            </TabsTrigger>
            <TabsTrigger
              value="queries"
              className="flex items-center gap-2 px-3 py-1.5 text-xs data-[state=active]:bg-sidebar-accent"
              onClick={() => refetchHistory()}
            >
              <History className="h-4 w-4" />
              <span>History</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent
          value="tables"
          className="flex flex-1 min-h-0 flex-col pl-2 focus-visible:outline-none focus-visible:ring-0"
        >
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="space-y-1">
              {isLoading || isFetching ? (
                <div className="px-2 py-1.5 text-xs text-muted-foreground bg-muted rounded-md cursor-default select-none flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading...</span>
                </div>
              ) : data.length === 0 ? (
                error ? (
                  <div className="px-2 py-1.5 text-xs text-red-500 bg-transparent cursor-default select-none">
                    {error.message}
                  </div>
                ) : (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground bg-muted rounded-md cursor-default select-none">
                    No tables found
                  </div>
                )
              ) : (
                data.map((t: string) => (
                  <ContextMenu key={t}>
                    <ContextMenuTrigger asChild>
                      <button
                        className="flex w-full items-center gap-2 rounded-md px-2 py-[1px] text-xs hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors duration-200"
                        title={t}
                        onClick={() => handleTableClick(t)}
                      >
                        <Table className="h-3 w-3 opacity-60" />
                        <span className="truncate">{t}</span>
                      </button>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuItem
                        className="text-xs"
                        onClick={() => handleTableClick(t)}
                      >
                        View Data
                      </ContextMenuItem>
                      <ContextMenuItem
                        className="text-xs"
                        onClick={() => handleOpenTableSchema(t)}
                      >
                        View Schema
                      </ContextMenuItem>
                      <ContextMenuItem
                        className="text-xs"
                        onClick={() => navigator.clipboard.writeText(t)}
                      >
                        Copy name
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                ))
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent
          value="queries"
          className="flex flex-1 min-h-0 flex-col px-0 py-0 focus-visible:outline-none focus-visible:ring-0"
        >
          <div className="flex-1 min-h-0 overflow-y-auto">
            {isHistoryLoading ? (
              <div className="px-4 py-2 text-xs text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading history...</span>
              </div>
            ) : !queryHistory || queryHistory.length === 0 ? (
              <div className="px-4 py-2 text-xs text-muted-foreground">
                No query history found
              </div>
            ) : (
              <div className="space-y-0.5 px-1">
                {queryHistory.map((item: QueryHistoryItem) => (
                  <button
                    key={item.id}
                    className="w-full text-left px-3 py-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group transition-colors duration-200 cursor-pointer rounded-md"
                    onClick={() => handleHistoryClick(item.query)}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5">
                        {item.status === "success" ? (
                          <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                        ) : (
                          <XCircle className="h-3 w-3 text-red-500 shrink-0" />
                        )}
                        <span className="text-[10px] text-muted-foreground font-medium group-hover:text-sidebar-accent-foreground/70 transition-colors">
                          {timeAgo(item.timestamp)}
                        </span>
                        {item.count > 1 && (
                          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-sidebar-accent text-[9px] font-bold text-sidebar-accent-foreground">
                            x{item.count}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground tabular-nums group-hover:text-sidebar-accent-foreground/70 transition-colors">
                        {item.duration_ms}ms
                      </span>
                    </div>
                    <div className="text-xs font-mono text-foreground/90 line-clamp-2 break-all group-hover:text-sidebar-accent-foreground transition-colors">
                      {item.query}
                    </div>
                    {item.error_message && (
                      <div className="mt-1 text-[10px] text-red-400 line-clamp-1">
                        {item.error_message}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
