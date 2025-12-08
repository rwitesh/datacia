// FloatingBar.tsx
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { useEditorContext } from "@/modules/Context/Editor/Index";
import { useGetTableData } from "@/services/hooks";
import { QueryResult } from "@/services/database";

export function FloatingBar() {
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
    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 mb-3 select-none cursor-default">
      <div className="flex items-center gap-3 bg-background border rounded-2xl shadow-lg px-4 py-0">
        <Button
          size="icon"
          variant="ghost"
          onClick={handlePrev}
          disabled={isExecuting || offset === 0}
          className="cursor-pointer"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <label className="flex items-center gap-1 text-sm text-muted-foreground">
          Limit:
          <input
            type="number"
            className="w-16 border rounded px-1 text-sm"
            value={limit ?? ""}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val) && val > 0) updateTab(id, { limit: val });
            }}
            disabled={isExecuting}
          />
        </label>

        <label className="flex items-center gap-1 text-sm text-muted-foreground">
          Offset:
          <input
            type="number"
            className="w-20 border rounded px-1 text-sm"
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
          className="cursor-pointer"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        <Button
          size="icon"
          variant="ghost"
          onClick={handleRefresh}
          disabled={isExecuting}
          className="cursor-pointer"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
