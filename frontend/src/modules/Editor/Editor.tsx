import { useState } from "react";
import { EditorSidebar } from "./EditorSidebar/EditorSidebar";
import { RunQuery } from "../../../wailsjs/go/database/ClickHouse";
import { QueryResult } from "./QueryResult/QueryResult";
import { QueryInput } from "./QueryInput/QueryInput";
import { QueryToolbar } from "./QueryToolbar/QueryToolbar";

export const Editor = () => {
  const [sqlQuery, setSqlQuery] = useState<string>("");
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [results, setResults] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runQuery = async () => {
    if (!sqlQuery.trim()) return;
    setIsExecuting(true);
    setError(null);

    try {
      const response = await RunQuery(sqlQuery);
      setResults(response);
    } catch (err: any) {
      setError(err || "Error executing query");
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
            runQuery={runQuery}
          />
        </div>
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
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