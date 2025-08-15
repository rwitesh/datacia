import { useState } from "react";
import { CancelRunningQuery, RunQuery } from "@/services/clickhouse";
import { QueryInput } from "./QueryInput/QueryInput";
import { QueryToolbar } from "./QueryToolbar/QueryToolbar";
import { EditorSidebar } from "./EditorSidebar/EditorSidebar";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { EditorFooter } from "./EditorFooter/EditorFooter";
import { useAppContext } from "../Context/AppContext";
import { useNavigate } from "react-router";
import { QueryResult } from "./QueryResult/QueryResult";
import { fetchTableData } from "@/services/hooks";

export const Editor = () => {
  const navigate = useNavigate();
  const { database } = useAppContext();

  const [sqlQuery, setSqlQuery] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [queryResults, setQueryResults] = useState<any[] | null>(null);
  const [error, setError] = useState<string | undefined>(undefined);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  const { tables: tableData, error: tableError } = fetchTableData(
    selectedTable as string
  );

  const runQuery = async () => {
    if (!sqlQuery.trim()) return;
    setSelectedTable(null); // switching to query mode
    setIsExecuting(true);
    setQueryResults(null);
    setError(undefined);
    try {
      const response = await RunQuery(sqlQuery);
      setQueryResults(response);
    } catch (err: any) {
      setError(err?.message || String(err) || "Error executing query");
    } finally {
      setIsExecuting(false);
    }
  };

  const stopQuery = async () => {
    await CancelRunningQuery();
    setError("Query execution cancelled");
    setQueryResults(null);
    setIsExecuting(false);
  };

  if (database === "") {
    navigate("/connect/clickhouse");
    return null;
  }

  // Determine what to show in QueryResult
  const finalResults = selectedTable ? tableData : queryResults;
  const finalError = selectedTable ? tableError : error;

  return (
    <div className="h-full w-full flex flex-col">
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal" className="h-full w-full">
          <ResizablePanel
            defaultSize={25}
            minSize={0}
            maxSize={100}
            collapsible
            className="min-w-0"
          >
            <div className="h-full w-full overflow-hidden">
              <EditorSidebar
                table={selectedTable}
                setTable={setSelectedTable}
              />
            </div>
          </ResizablePanel>

          <ResizableHandle />
          <ResizablePanel className="min-w-0">
            <div className="flex h-full w-full flex-col overflow-hidden">
              <div className="shrink-0 border-b">
                <QueryToolbar
                  isExecuting={isExecuting}
                  runQuery={runQuery}
                  stopQuery={stopQuery}
                />
              </div>

              <ResizablePanelGroup direction="vertical" className="flex-1">
                {!selectedTable && (
                  <>
                    <ResizablePanel
                      defaultSize={45}
                      minSize={0}
                      className="min-h-0"
                    >
                      <div className="h-full">
                        <QueryInput
                          sqlQuery={sqlQuery}
                          setSqlQuery={setSqlQuery}
                        />
                      </div>
                    </ResizablePanel>
                    <ResizableHandle />
                  </>
                )}
                <ResizablePanel minSize={0} className="min-h-0">
                  <div className="h-full overflow-hidden">
                    <QueryResult
                      isExecuting={isExecuting}
                      error={finalError}
                      results={finalResults}
                    />
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      <div className="shrink-0 border-t">
        <EditorFooter rowCount={finalResults ? finalResults.length : 0} />
      </div>
    </div>
  );
};
