import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Download,
  FileJson,
  FileType,
  Image as ImageIcon,
} from "lucide-react";
import { useEditorContext } from "@/context/editor/Index";
import { useExportActions } from "@/services/useExportActions";

function formatExecutionTime(ms: number): string {
  if (ms < 1000) {
    return `${ms} ms`;
  }
  const seconds = (ms / 1000).toFixed(2);
  return `${seconds} s`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export type ViewMode = "data" | "ddl";

export function ResultBar() {
  const { activeTab, updateTab, tableRef, loadTableData } = useEditorContext();

  const data = activeTab?.results?.data ?? [];
  const tableName = activeTab?.table;

  const { exportJSON, exportCSV, exportPNG, isExporting } = useExportActions({
    tableRef,
    data,
    columns: activeTab?.results?.columns ?? [],
    tableName,
  });

  if (!activeTab) return null;

  const {
    id,
    table,
    limit,
    offset,
    isExecuting,
    orderBy,
    orderDir,
    type,
    results,
    error,
    mode,
  } = activeTab;
  const viewMode = mode ?? "data";
  const timeElapsed = results?.timeElapsed;

  const logs = results?.logs;
  const hasLogs =
    logs != null &&
    (logs.rowsReturned != null ||
      logs.rowsRead != null ||
      logs.bytesRead != null);
  const isTableMode = type === "table";

  // Pagination Logic
  const fetchData = (newLimit: number, newOffset: number) => {
    if (!table || newLimit === undefined) return;
    loadTableData(id, {
      table,
      limit: newLimit,
      offset: newOffset,
      orderBy,
      orderDir,
    });
  };

  const handlePrev = () => {
    if (typeof limit === "number" && typeof offset === "number") {
      const newOffset = Math.max(0, offset - limit);
      fetchData(limit, newOffset);
    }
  };

  const handleNext = () => {
    if (typeof limit === "number" && typeof offset === "number") {
      const newOffset = offset + limit;
      fetchData(limit, newOffset);
    }
  };

  const handleRefresh = () => {
    if (typeof limit === "number" && typeof offset === "number") {
      fetchData(limit, offset);
    }
  };

  const hasData = data && data.length > 0;

  return (
    <div className="flex items-center justify-between bg-card border-t border-border px-4 py-1.5 select-none h-10">
      {/* Left Side: Pagination or Info */}
      <div className="flex items-center gap-4 flex-1">
        {isTableMode ? (
          <div className="flex items-center gap-3">
            {/* Data/DDL Toggle */}
            <ToggleGroup
              type="single"
              value={viewMode}
              onValueChange={(value) =>
                value && updateTab(id, { mode: value as ViewMode })
              }
              size="sm"
              variant="outline"
            >
              <ToggleGroupItem value="data" className="h-6 px-2 text-xs">
                Data
              </ToggleGroupItem>
              <ToggleGroupItem value="ddl" className="h-6 px-2 text-xs">
                DDL
              </ToggleGroupItem>
            </ToggleGroup>

            {viewMode === "data" && (
              <>
                <div className="h-4 w-[1px] bg-border" />
                <div className="flex items-center">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handlePrev}
                    disabled={isExecuting || offset === 0}
                    className="h-7 w-7"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleNext}
                    disabled={isExecuting}
                    className="h-7 w-7"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center gap-3 text-xs text-muted-foreground border-l border-border pl-3">
                  <label className="flex items-center gap-1">
                    Limit:
                    <input
                      type="number"
                      className="w-14 border rounded px-1 text-xs bg-background h-6"
                      value={limit ?? ""}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val) && val > 0)
                          updateTab(id, { limit: val });
                      }}
                      disabled={isExecuting}
                    />
                  </label>
                  <label className="flex items-center gap-1">
                    Offset:
                    <input
                      type="number"
                      className="w-16 border rounded px-1 text-xs bg-background h-6"
                      value={offset ?? ""}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val) && val >= 0)
                          updateTab(id, { offset: val });
                      }}
                      disabled={isExecuting}
                    />
                  </label>
                </div>
              </>
            )}
          </div>
        ) : (
          !error &&
          (timeElapsed != null || hasLogs) && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {timeElapsed != null && (
                <span>
                  <span className="font-medium">Time:</span>{" "}
                  {formatExecutionTime(timeElapsed)}
                </span>
              )}
              {hasLogs && logs != null && (
                <>
                  {logs.rowsReturned != null && (
                    <span>
                      <span className="font-medium">Rows:</span>{" "}
                      {Number(logs.rowsReturned).toLocaleString()}
                    </span>
                  )}
                  {logs.rowsRead != null && (
                    <span>
                      <span className="font-medium">Rows read:</span>{" "}
                      {Number(logs.rowsRead).toLocaleString()}
                    </span>
                  )}
                  {logs.bytesRead != null && (
                    <span>
                      <span className="font-medium">Bytes read:</span>{" "}
                      {formatBytes(Number(logs.bytesRead))}
                    </span>
                  )}
                </>
              )}
            </div>
          )
        )}
      </div>

      {/* Right Side: Actions (Refresh, Export) */}
      <div className="flex items-center gap-2">
        {isTableMode && viewMode === "data" && (
          <Button
            size="icon"
            variant="ghost"
            onClick={handleRefresh}
            disabled={isExecuting}
            className="h-7 w-7 text-muted-foreground"
            title="Refresh Data"
          >
            <RefreshCw
              className={`h-4 w-4 ${isExecuting ? "animate-spin" : ""}`}
            />
          </Button>
        )}

        {viewMode === "data" && (
          <>
            <div className="h-4 w-[1px] bg-border mx-1" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isExecuting || isExporting || !hasData}
                  className="h-7 px-2 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                >
                  <Download
                    className={`h-3.5 w-3.5 ${
                      isExporting ? "animate-pulse" : ""
                    }`}
                  />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                  onSelect={exportJSON}
                  className="gap-2 text-xs"
                >
                  <FileJson className="h-3.5 w-3.5" />
                  <span>Export JSON</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={exportCSV}
                  className="gap-2 text-xs"
                >
                  <FileType className="h-3.5 w-3.5" />
                  <span>Export CSV</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={exportPNG}
                  className="gap-2 text-xs"
                >
                  <ImageIcon className="h-3.5 w-3.5" />
                  <span>Export PNG</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
    </div>
  );
}
