import { DataTable } from "./DataTable"

export function QueryResult({
  isExecuting,
  error,
  results,
}: {
  isExecuting: boolean;
  error: string | null;
  results: any[] | null;
}) {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="shrink-0 text-xs font-medium p-2 text-muted-foreground">
        Results
      </div>
      <div className="flex-1 overflow-hidden border rounded-lg">
        {isExecuting ? (
          <div className="flex justify-center items-center h-full">
            <div className="animate-spin h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="flex justify-center text-center items-center h-full text-red-500 p-4">
            {error}
          </div>
        ) : results && results.length > 0 ? (
          <DataTable columns={Object.keys(results[0])} data={results} />
        ) : (
          <div className="flex justify-center items-center h-full text-muted-foreground">
            {results && results.length === 0
              ? "Query executed successfully"
              : "Run a query to see results"}
          </div>
        )}
      </div>
    </div>
  );
}