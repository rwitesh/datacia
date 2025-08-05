import { useState } from "react";
import { EditorSidebar } from "./EditorSidebar/EditorSidebar";
import { ExecuteQuery } from "../../../wailsjs/go/database/ClickHouse";
import { QueryResult } from "./QueryResult/QueryResult";
import { QueryInput } from "./QueryInput/QueryInput";
import { QueryToolbar } from "./QueryToolbar/QueryToolbar";

export const Editor = () => {
  const [sqlQuery, setSqlQuery] = useState<string>("");
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [results, setResults] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const executeQuery = async () => {
    if (!sqlQuery.trim()) return;
    setIsExecuting(true);
    setError(null);

    try {
      const response = await ExecuteQuery(sqlQuery);
      setResults(response);
    } catch (err: any) {
      setError(err?.message || "Error executing query");
      setResults(null);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="h-full w-full flex overflow-hidden">
      <EditorSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="shrink-0">
          <QueryToolbar
            executeQuery={executeQuery}
            sqlQuery={sqlQuery}
            setSqlQuery={setSqlQuery}
            isExecuting={isExecuting}
          />
        </div>
        <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">
          <div className="shrink-0">
            <QueryInput sqlQuery={sqlQuery} setSqlQuery={setSqlQuery} />
          </div>
          <div className="flex-1 overflow-hidden">
            <QueryResult isExecuting={isExecuting} error={error} results={results} />
          </div>
        </div>
      </div>
    </div>
  );
};