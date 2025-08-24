import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useEditorContext } from "@/modules/Context/EditorContext";
import { ChevronLeft, ChevronRight, RotateCw } from "lucide-react";
import { DataTable } from "./DataTable";

export function QueryResult() {
  const { activeTab, runQuery, updateTab } = useEditorContext();
  const [hovered, setHovered] = useState(false);

  if (!activeTab) return null;
  const { isExecuting, error, results, limit, offset } = activeTab;

  const handlePrev = () => {
    if (typeof limit === "number" && typeof offset === "number") {
      const newOffset = Math.max(0, offset - limit);
      const sql = `SELECT * FROM ${activeTab.table} LIMIT ${limit} OFFSET ${newOffset}`;

      updateTab(activeTab.id, { offset: newOffset });
      runQuery(activeTab.id, sql);
    }
  };

  const handleNext = () => {
    if (typeof limit === "number" && typeof offset === "number") {
      const newOffset = offset + limit;
      const sql = `SELECT * FROM ${activeTab.table} LIMIT ${limit} OFFSET ${newOffset}`;
      updateTab(activeTab.id, { offset: newOffset });
      runQuery(activeTab.id, sql);
    }
  };

  const handleLimitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val > 0) {
      updateTab(activeTab.id, { limit: val });
    }
  };

  const handleOffsetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 0) {
      updateTab(activeTab.id, { offset: val });
    }
  };

  const handleRefresh = () => {
    if (typeof limit === "number" && typeof offset === "number") {
      const sql = `SELECT * FROM ${activeTab.table} LIMIT ${limit} OFFSET ${offset}`;
      runQuery(activeTab.id, sql);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden relative">
      <div className="flex-1 overflow-hidden">
        {isExecuting ? (
          <div className="flex justify-center items-center h-full">
            <div className="animate-spin h-8 w-8 border-b-2 border-primary rounded-full"></div>
          </div>
        ) : error ? (
          <div className="flex justify-center text-center items-center h-full text-red-500 p-4">
            {error}
          </div>
        ) : results && results.length > 0 ? (
          <DataTable columns={Object.keys(results[0])} data={results} />
        ) : (
          <div className="flex justify-center items-center h-full cursor-default select-none">
            {results && results.length === 0 ? (
              <span className="text-green-600">
                Query executed successfully
              </span>
            ) : (
              <span className="text-muted-foreground">
                Run a query to see results
              </span>
            )}
          </div>
        )}
      </div>

      {/* Hover zone */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-40 h-6"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />

      {/* Floating Bar */}
      {activeTab.mode === "table" && (
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: hovered ? "0%" : "100%" }}
          transition={{ duration: 0.2 }}
          className="absolute bottom-0 left-1/2 -translate-x-1/2 mb-2"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <div className="flex items-center gap-3 bg-background border rounded-2xl shadow-lg px-4 py-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={handlePrev}
              disabled={isExecuting || activeTab.offset === 0}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>

            <label className="flex items-center gap-1 text-sm text-muted-foreground">
              Limit:
              <input
                type="number"
                className="w-16 border rounded px-1 text-sm
            [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none 
            [&::-webkit-inner-spin-button]:appearance-none"
                value={limit ?? ""}
                onChange={handleLimitChange}
                disabled={isExecuting}
              />
            </label>

            <label className="flex items-center gap-1 text-sm text-muted-foreground">
              Offset:
              <input
                type="number"
                className="w-20 border rounded px-1 text-sm
            [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none 
            [&::-webkit-inner-spin-button]:appearance-none"
                value={offset ?? ""}
                onChange={handleOffsetChange}
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

            {/* Refresh button */}
            <Button
              size="icon"
              variant="ghost"
              onClick={handleRefresh}
              disabled={isExecuting}
            >
              <RotateCw className="h-5 w-5" />
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
