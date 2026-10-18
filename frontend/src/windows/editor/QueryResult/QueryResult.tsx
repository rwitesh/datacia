import { useEditorContext } from "@/context/editor/Index";
import { useGetDDL } from "@/services/database";
import { DataTable } from "./DataTable/DataTable";
import { ErrorView } from "./ErrorView/ErrorView";
import { DDLView } from "./DDLView/DDLView";
import type { CellSelection } from "@/context/editor/Context";
import { useCallback } from "react";

type QueryResultProps = {
  onOpenDataView: () => void;
};

export function QueryResult({ onOpenDataView }: QueryResultProps) {
  const { activeTab, updateTab, tableRef, setReadSelection, loadTableData } = useEditorContext();

  const table = activeTab?.table;
  const limit = activeTab?.limit;
  const offset = activeTab?.offset;
  const isDDLMode = activeTab?.type === "table" && activeTab?.mode === "ddl";

  const ddlQuery = useGetDDL(table, isDDLMode);

  const tabId = activeTab?.id;

  const handleSelectionSave = useCallback(
    (range: CellSelection | null, sorted: boolean) => {
      if (tabId) {
        updateTab(tabId, { selection: range ? { range, sorted } : undefined });
      }
    },
    [tabId, updateTab]
  );

  if (!activeTab) {
    return (
      <div className="h-full flex flex-col overflow-hidden bg-card">
        <div className="flex-1 overflow-hidden relative min-h-0">
          <div className="flex justify-center items-center h-full cursor-default select-none">
            <span className="text-muted-foreground text-sm">
              No active tab
            </span>
          </div>
        </div>
      </div>
    );
  }

  const { id, isExecuting, error, results, type, mode, orderBy, orderDir } = activeTab;
  const isCommandQuery = results && results.type === "command";
  const isTableViewMode = type === "table";
  const viewMode = mode ?? "data";

  const handleServerSort = (column: string, direction: "asc" | "desc") => {
    if (!table || limit === undefined || offset === undefined) return;
    loadTableData(id, {
      table,
      limit,
      offset,
      orderBy: column || undefined,
      orderDir: column ? direction : undefined,
    });
  };

  const handleScrollChange = (scroll: { left: number; top: number }) => {
    updateTab(id, { scroll });
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-card">
      <div className="flex-1 overflow-hidden relative min-h-0">
        {isTableViewMode && viewMode === "ddl" ? (
          <DDLView
            ddl={ddlQuery.data ?? ""}
            isLoading={ddlQuery.isLoading}
            error={ddlQuery.error?.message}
          />
        ) : error ? (
          <ErrorView error={error} />
        ) : results?.type === "read" ? (
          <DataTable
            key={id}
            ref={tableRef}
            columns={results.columns}
            data={results.data}
            onSelectedDataChange={setReadSelection}
            onSelectionSave={handleSelectionSave}
            currentOrderBy={orderBy}
            currentOrderDir={orderDir}
            onServerSort={isTableViewMode ? handleServerSort : undefined}
            isLoading={isExecuting}
            onOpenDataView={onOpenDataView}
            scrollPosition={activeTab.scroll}
            onScrollChange={handleScrollChange}
            offset={offset ?? 0}
            initialSelection={
              activeTab.selection?.sorted ? undefined : activeTab.selection?.range
            }
          />
        ) : isExecuting ? (
          <div className="flex justify-center items-center h-full">
            <div className="animate-spin h-8 w-8 border-b-2 border-primary rounded-full"></div>
          </div>
        ) : isCommandQuery ? (
          <div className="flex justify-center items-center h-full cursor-default select-none">
            <span className="text-green-600 text-sm">Query executed successfully</span>
          </div>
        ) : (
          <div className="flex justify-center items-center h-full cursor-default select-none">
            <span className="text-muted-foreground text-sm">
              Run a query to see results
            </span>
          </div>
        )}
      </div>
    </div>
  );
}