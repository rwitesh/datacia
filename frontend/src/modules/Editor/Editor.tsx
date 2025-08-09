import { useState } from "react";
import { RunQuery } from "../../../wailsjs/go/database/ClickHouse";
import { QueryResult } from "./QueryResult/QueryResult";
import { QueryInput } from "./QueryInput/QueryInput";
import { QueryToolbar } from "./QueryToolbar/QueryToolbar";
import { EditorSidebar } from "./EditorSidebar/EditorSidebar";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"; // ← no .tsx in import

export const Editor = () => {
  const [sqlQuery, setSqlQuery] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
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
      setError(err?.message || "Error executing query");
      setResults(null);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="h-full w-full overflow-hidden">
      <ResizablePanelGroup direction="horizontal" className="h-full w-full">
        <ResizablePanel
          defaultSize={25}
          minSize={0}
          maxSize={100}
          collapsible
          className="min-w-0"
        >
          <div className="h-full w-full overflow-hidden">
            <EditorSidebar />
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />
        <ResizablePanel minSize={5} className="min-w-0">
          <div className="flex h-full w-full flex-col overflow-hidden">
            <div className="shrink-0 border-b">
              <QueryToolbar runQuery={runQuery} />
            </div>

            <ResizablePanelGroup direction="vertical" className="flex-1">
              <ResizablePanel
                defaultSize={45}
                minSize={0}
                className="min-h-0"
              >
                <div className="h-full">
                  <QueryInput sqlQuery={sqlQuery} setSqlQuery={setSqlQuery} />
                </div>
              </ResizablePanel>

              <ResizableHandle withHandle />

              <ResizablePanel minSize={0} className="min-h-0">
                <div className="h-full overflow-hidden">
                  <QueryResult isExecuting={isExecuting} error={error} results={results} />
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};
