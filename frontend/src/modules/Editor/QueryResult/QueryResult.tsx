// QueryResult.tsx
import { useEditorContext } from "@/modules/Context/Editor/Index";
import { useGetTableData } from "@/services/hooks";
import { DataTable } from "./DataTable/DataTable";
import { PaginationBar } from "./PaginationBar/PaginationBar";
import { QueryInfoBar } from "./QueryInfoBar/QueryInfoBar";
import { ErrorView } from "./ErrorView/ErrorView";
import type { QueryResult as QueryResultType } from "@/services/database";

type QueryResultProps = {
  onSelectionChange: (selected: Array<Record<string, unknown>>) => void;
  onOpenDataView?: () => void;
};

export function QueryResult({ onSelectionChange, onOpenDataView }: QueryResultProps) {
  const { activeTab, updateTab } = useEditorContext();
  const getTableDataMutation = useGetTableData();

  if (!activeTab) return null;

  const { id, isExecuting, error, results, mode, table, limit, offset, orderBy, orderDir } = activeTab;
  const isReadQuery = results && results.type === "read";
  const isCommandQuery = results && results.type === "command";
  const isTableViewMode = mode === "table";

  const handleServerSort = (column: string, direction: "asc" | "desc") => {
    if (!table || limit === undefined || offset === undefined) return;

    // Update the tab with new sort state and set executing
    updateTab(id, {
      isExecuting: true,
      error: undefined,
      orderBy: column || undefined,
      orderDir: column ? direction : undefined,
    });

    getTableDataMutation.mutate(
      {
        table,
        limit,
        offset,
        orderBy: column || undefined,
        orderDir: column ? direction : undefined,
      },
      {
        onSuccess: (response: QueryResultType) => {
          updateTab(id, {
            results: response,
            isExecuting: false,
            pagination: true,
          });
        },
        onError: (err: unknown) => {
          const message =
            err instanceof Error
              ? err.message
              : String(err) || "Error fetching sorted data";
          updateTab(id, {
            error: message,
            results: null,
            isExecuting: false,
          });
        },
      }
    );
  };

  // Show DataTable if we have results, even while loading new sorted data
  const showDataTable = isReadQuery || (isExecuting && results?.type === "read");

  return (
    <div className="h-full flex flex-col overflow-hidden bg-card">
      <div className="flex-1 overflow-hidden">
        {error ? (
          <ErrorView error={error} />
        ) : showDataTable ? (
          <DataTable
            columns={results.columns}
            data={results.data ?? []}
            onSelectionChange={onSelectionChange}
            isTableViewMode={isTableViewMode}
            currentOrderBy={orderBy}
            currentOrderDir={orderDir}
            onServerSort={isTableViewMode ? handleServerSort : undefined}
            isLoading={isExecuting}
            onOpenDataView={onOpenDataView}
          />
        ) : isExecuting ? (
          <div className="flex justify-center items-center h-full">
            <div className="animate-spin h-8 w-8 border-b-2 border-primary rounded-full"></div>
          </div>
        ) : isCommandQuery ? (
          <div className="flex justify-center items-center h-full cursor-default select-none">
            <span className="text-green-600">Query executed successfully</span>
          </div>
        ) : (
          <div className="flex justify-center items-center h-full cursor-default select-none">
            <span className="text-muted-foreground">
              Run a query to see results
            </span>
          </div>
        )}
      </div>

      {activeTab.mode === "table" && <PaginationBar />}
      {activeTab.mode === "query" && <QueryInfoBar />}
    </div>
  );
}

