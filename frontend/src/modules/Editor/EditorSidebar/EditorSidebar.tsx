import { Table, Loader2 } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useEditorContext } from "@/modules/Context/Editor/Index";
import { useGetTableData, useGetTableSchema } from "@/services/hooks";

export function EditorSidebar() {
  const {
    tables: { data, isLoading, isFetching, error },
    createTab,
    updateTab,
  } = useEditorContext();

  const getTableDataMutation = useGetTableData();
  const getTableSchemaMutation = useGetTableSchema();

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
        });
      },
    });
  };

  return (
    <div className="h-full w-full flex flex-col select-none cursor-default pt-12 bg-sidebar">
      <div className="sticky top-0 z-10 flex items-center gap-2 px-3 py-2 border-b border-sidebar-border">
        <Table className="h-4 w-4" />
        <span className="text-sm font-medium ">Tables</span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2">
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
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-sidebar-accent"
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
    </div>
  );
}
