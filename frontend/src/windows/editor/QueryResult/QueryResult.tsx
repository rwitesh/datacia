import { useEditorContext } from "@/context/editor/Index";
import { useGetDDL } from "@/services/database";
import { DataTable } from "./DataTable/DataTable";
import { ErrorView } from "./ErrorView/ErrorView";
import { DDLView } from "./DDLView/DDLView";
import type { SelectionGeometry } from "./DataTable/utils/cellSelection";
import type { DataRow } from "./DataTable/types";
import { useCallback } from "react";

// Stable fallbacks: DataTable re-reports the selection whenever its rows
// change identity, so a fresh [] on each render would loop.
const NO_COLUMNS: string[] = [];
const NO_ROWS: DataRow[] = [];

type QueryResultProps = {
  onOpenDataView?: () => void;
};

export function QueryResult({ onOpenDataView }: QueryResultProps) {
  const { activeTab, updateTab, tableRef, loadTableData } = useEditorContext();

  const table = activeTab?.table;
  const limit = activeTab?.limit;
  const offset = activeTab?.offset;
  const isDDLMode = activeTab?.type === "table" && activeTab?.mode === "ddl";

  const ddlQuery = useGetDDL(table, isDDLMode);

  const tabId = activeTab?.id;
  const showDataTable = Boolean(
    activeTab &&
      (String(activeTab.results?.type) === "read" ||
        (activeTab.isExecuting && String(activeTab.results?.type) === "read"))
  );

  const handleSelectionChange = useCallback(
    (selection: SelectionGeometry | null, selectedRows: DataRow[]) => {
      if (tabId) {
        updateTab(tabId, { selection, selectedRows });
      }
    },
    [tabId, updateTab]
  );

  // Show empty state if no active tab instead of returning null
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
        ) : showDataTable ? (
          <DataTable
            key={id}
            ref={tableRef}
            columns={results?.columns ?? NO_COLUMNS}
            data={results?.data ?? NO_ROWS}
            onSelectionChange={handleSelectionChange}
            isTableViewMode={isTableViewMode}
            currentOrderBy={orderBy}
            currentOrderDir={orderDir}
            onServerSort={isTableViewMode ? handleServerSort : undefined}
            isLoading={isExecuting}
            onOpenDataView={onOpenDataView}
            scrollPosition={activeTab.scroll}
            onScrollChange={handleScrollChange}
            offset={offset ?? 0}
            initialSelection={activeTab.selection}
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