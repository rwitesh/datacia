// PaginationBar.tsx
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { useEditorContext } from "@/modules/Context/Editor/Index";
import { useGetTableData } from "@/services/database";
import type { QueryResult } from "@/services/bindings/database";

export function PaginationBar() {
    const { activeTab, updateTab } = useEditorContext();
    const getTableDataMutation = useGetTableData();

    if (!activeTab) return null;
    const { id, table, limit, offset, isExecuting, orderBy, orderDir } = activeTab;

    const fetchData = (limit: number, offset: number) => {
        if (!table || limit === undefined) return;

        updateTab(id, {
            isExecuting: true,
            error: undefined,
            limit,
            offset,
        });

        getTableDataMutation.mutate(
            {
                table,
                limit,
                offset,
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

    return (
        <div className="flex items-center justify-center gap-3 bg-card border-t border-border px-4 py-1.5 select-none">
            <Button
                size="icon"
                variant="ghost"
                onClick={handlePrev}
                disabled={isExecuting || offset === 0}
                className="h-7 w-7"
            >
                <ChevronLeft className="h-4 w-4" />
            </Button>

            <label className="flex items-center gap-1 text-xs text-muted-foreground">
                Limit:
                <input
                    type="number"
                    className="w-14 border rounded px-1 text-xs bg-background"
                    value={limit ?? ""}
                    onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val) && val > 0) updateTab(id, { limit: val });
                    }}
                    disabled={isExecuting}
                />
            </label>

            <label className="flex items-center gap-1 text-xs text-muted-foreground">
                Offset:
                <input
                    type="number"
                    className="w-16 border rounded px-1 text-xs bg-background"
                    value={offset ?? ""}
                    onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val) && val >= 0) updateTab(id, { offset: val });
                    }}
                    disabled={isExecuting}
                />
            </label>

            <Button
                size="icon"
                variant="ghost"
                onClick={handleNext}
                disabled={isExecuting}
                className="h-7 w-7"
            >
                <ChevronRight className="h-4 w-4" />
            </Button>

            <Button
                size="icon"
                variant="ghost"
                onClick={handleRefresh}
                disabled={isExecuting}
                className="h-7 w-7"
            >
                <RefreshCw className={`h-4 w-4 ${isExecuting ? "animate-spin" : ""}`} />
            </Button>
        </div>
    );
}
