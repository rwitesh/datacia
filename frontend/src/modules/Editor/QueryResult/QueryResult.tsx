// QueryResult.tsx
import { useEditorContext } from "@/modules/Context/Editor/Index";
import { DataTable } from "./DataTable/DataTable";
import { FloatingBar } from "./FloatingBar/FloatingBar";

export function QueryResult() {
  const { activeTab } = useEditorContext();

  if (!activeTab) return null;

  const { isExecuting, error, results } = activeTab;
  const isReadQuery = results && results.Type === "read";
  const isCommandQuery = results && results.Type === "command";

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
        ) : isReadQuery ? (
          <DataTable
            columns={results.Columns}
            data={results.Data ?? []}
            showIndex
          />
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

      {activeTab.pagination && <FloatingBar />}
    </div>
  );
}
