import { useEditorContext } from "@/context/editor/Index";
import { useGetTableData, useGetDDL } from "@/services/database";
import { DataTable } from "./DataTable/DataTable";
import { ResultBar, type ViewMode } from "./ResultBar/ResultBar";
import { ErrorView } from "./ErrorView/ErrorView";
import { DDLView } from "./DDLView/DDLView";
import type { QueryResult as QueryResultType } from "@/services/bindings/database";
import html2canvaspro from "html2canvas-pro";
import React from "react";
import { useExportData } from "@/services/export";

type QueryResultProps = {
  onSelectionChange: (selected: Array<Record<string, unknown>>) => void;
  onOpenDataView?: () => void;
};

export function QueryResult({ onSelectionChange, onOpenDataView }: QueryResultProps) {
  const { activeTab, updateTab } = useEditorContext();
  const getTableDataMutation = useGetTableData();
  const getDDLMutation = useGetDDL();
  const [ddlData, setDdlData] = React.useState<string>("");
  const [ddlError, setDdlError] = React.useState<string | undefined>();

  // Hoisted hooks
  const tableRef = React.useRef<HTMLDivElement>(null);
  const { mutate: exportData } = useExportData();

  const table = activeTab?.table;
  const limit = activeTab?.limit;
  const offset = activeTab?.offset;

  if (!activeTab) return null;

  const { id, isExecuting, error, results, type, mode, orderBy, orderDir } = activeTab;
  const isReadQuery = results && results.type === "read";
  const isCommandQuery = results && results.type === "command";
  const isTableViewMode = type === "table";
  const viewMode = mode ?? "data";

  // Fetch DDL when switching to DDL mode
  const handleViewModeChange = (newMode: ViewMode) => {
    updateTab(id, { mode: newMode });
    if (newMode === "ddl" && table && !ddlData) {
      getDDLMutation.mutate(table, {
        onSuccess: (ddl) => {
          setDdlData(ddl);
          setDdlError(undefined);
        },
        onError: (err) => {
          setDdlError(err instanceof Error ? err.message : String(err));
        },
      });
    }
  };

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

  const handleScrollChange = (scroll: { left: number; top: number }) => {
    updateTab(id, { scroll });
  };

  // Show DataTable if we have results, even while loading new sorted data
  const showDataTable = isReadQuery || (isExecuting && results?.type === "read");

  // Export Logic for Full Result Set

  const handleExportPng = async () => {
    if (!tableRef.current || !results?.data) return;

    try {
      const canvas = await html2canvaspro(tableRef.current, {
        backgroundColor: "#ffffff", // Ensure white background
        scale: 2, // Higher resolution
      });

      const base64 = canvas.toDataURL("image/png");
      const filename = `${table || 'query'}-${results.data.length}-rows.png`;

      exportData({
        format: "png",
        suggestedFilename: filename,
        imageData: base64
      });
    } catch (err) {
      console.error("Export failed:", err);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-card">
      <div className="flex-1 overflow-hidden relative">
        {isTableViewMode && viewMode === "ddl" ? (
          <DDLView
            ddl={ddlData}
            isLoading={getDDLMutation.isPending}
            error={ddlError}
          />
        ) : error ? (
          <ErrorView error={error} />
        ) : showDataTable ? (
          <DataTable
            ref={tableRef}
            columns={results.columns}
            data={results.data ?? []}
            onSelectionChange={onSelectionChange}
            isTableViewMode={isTableViewMode}
            currentOrderBy={orderBy}
            currentOrderDir={orderDir}
            onServerSort={isTableViewMode ? handleServerSort : undefined}
            isLoading={isExecuting}
            onOpenDataView={onOpenDataView}
            scrollPosition={activeTab.scroll}
            onScrollChange={handleScrollChange}
            offset={offset ?? 0}
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

      <ResultBar
        data={results?.data ?? []}
        onExportPng={handleExportPng}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
      />
    </div>
  );
}
