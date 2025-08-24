// FloatingBar.tsx
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, RotateCw } from "lucide-react";
import { useEditorContext } from "@/modules/Context/EditorContext";

export function FloatingBar() {
  const {activeTab,  runQuery, updateTab } = useEditorContext();
  if (!activeTab) return null; 
  const { id, table, limit, offset, isExecuting} = activeTab;

  const handlePrev = () => {
    if (typeof limit === "number" && typeof offset === "number") {
      const newOffset = Math.max(0, offset - limit);
      const sql = `SELECT * FROM ${table} LIMIT ${limit} OFFSET ${newOffset}`;
      updateTab(id, { offset: newOffset });
      runQuery(id, sql);
    }
  };

  const handleNext = () => {
    if (typeof limit === "number" && typeof offset === "number") {
      const newOffset = offset + limit;
      const sql = `SELECT * FROM ${table} LIMIT ${limit} OFFSET ${newOffset}`;
      updateTab(id, { offset: newOffset });
      runQuery(id, sql);
    }
  };

  const handleRefresh = () => {
    if (typeof limit === "number" && typeof offset === "number") {
      const sql = `SELECT * FROM ${table} LIMIT ${limit} OFFSET ${offset}`;
      runQuery(id, sql);
    }
  };

  return (
    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 mb-2 select-none cursor-default">
      <div className="flex items-center gap-3 bg-background border rounded-2xl shadow-lg px-4 py-2">
        <Button
          size="icon"
          variant="ghost"
          onClick={handlePrev}
          disabled={isExecuting || offset === 0}
        >
          <ChevronLeft className="h-5 w-5" />
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
        >
          <ChevronRight className="h-5 w-5" />
        </Button>

        <Button
          size="icon"
          variant="ghost"
          onClick={handleRefresh}
          disabled={isExecuting}
        >
          <RotateCw className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
