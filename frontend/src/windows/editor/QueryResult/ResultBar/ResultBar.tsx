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
  Crown,
} from "lucide-react";
import { useEditorContext } from "@/context/editor/Index";
import { useAppContext } from "@/context/app/Index";
import { useGetTableData } from "@/services/database";
import { useExportData, type ExportFormat } from "@/services/export";
import type { QueryResult } from "@/services/bindings/database";

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

interface ResultBarProps {
  data?: Record<string, unknown>[];
  onExportPng?: () => void;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
}

export function ResultBar({
  data,
  onExportPng,
  viewMode = "data",
  onViewModeChange,
}: ResultBarProps) {
  const { activeTab, updateTab } = useEditorContext();
  const { isLicenseActive } = useAppContext();
  const getTableDataMutation = useGetTableData();
  const exportDataMutation = useExportData();

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
  } = activeTab;
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

    updateTab(id, {
      isExecuting: true,
      error: undefined,
      limit: newLimit,
      offset: newOffset,
    });

    getTableDataMutation.mutate(
      {
        table,
        limit: newLimit,
        offset: newOffset,
        orderBy,
        orderDir,
      },
      {
        onSuccess: (response: QueryResult) => {
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
              : String(err) || "Error fetching table data";
          updateTab(id, {
            error: message,
            results: null,
            isExecuting: false,
            pagination: false,
          });
        },
      }
    );
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

  // Export Logic
  const handleExport = (format: ExportFormat) => {
    if (!data || data.length === 0) return;

    const count = data.length;
    const suggestedFilename = table
      ? `${table}-${count}-rows.${format}`
      : `export-${count}-rows.${format}`;

    exportDataMutation.mutate({
      format,
      data,
      suggestedFilename,
    });
  };

  const handleExportPng = async () => {
    if (!data || data.length === 0) return;

    if (onExportPng) {
      onExportPng();
    }
  };

  const hasData = data && data.length > 0;
  const isExporting = exportDataMutation.isPending;

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
                value && onViewModeChange?.(value as ViewMode)
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
                  onSelect={() => handleExport("json")}
                  disabled={!isLicenseActive}
                  className="gap-2 text-xs"
                >
                  <FileJson className="h-3.5 w-3.5" />
                  <span>Export JSON</span>
                  {!isLicenseActive && (
                    <Crown className="h-3 w-3 text-amber-500 ml-auto" />
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => handleExport("csv")}
                  disabled={!isLicenseActive}
                  className="gap-2 text-xs"
                >
                  <FileType className="h-3.5 w-3.5" />
                  <span>Export CSV</span>
                  {!isLicenseActive && (
                    <Crown className="h-3 w-3 text-amber-500 ml-auto" />
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={handleExportPng}
                  disabled={!isLicenseActive}
                  className="gap-2 text-xs"
                >
                  <ImageIcon className="h-3.5 w-3.5" />
                  <span>Export PNG</span>
                  {!isLicenseActive && (
                    <Crown className="h-3 w-3 text-amber-500 ml-auto" />
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
    </div>
  );
}
