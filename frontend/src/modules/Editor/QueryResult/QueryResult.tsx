import { DataTable } from "./DataTable"

export function QueryResult({
  isExecuting,
  error,
  results,
}: {
  isExecuting: boolean | undefined;
  error: string | undefined;
  results: any[] | null | undefined;
}) {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-hidden">
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
          <div className="flex justify-center items-center h-full cursor-default select-none">
            {results && results.length === 0 ? (
              <span className="text-green-600">Query executed successfully</span>
            ) : (
              <span className="text-muted-foreground">Run a query to see results</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}