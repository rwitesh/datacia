import { useEffect, useState } from "react";
import {
  CancelRunningQuery,
  RunQuery,
  FetchTableData,
} from "@/services/clickhouse";
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
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { QueryResult } from "./QueryResult/QueryResult";

export const Editor = () => {
  const navigate = useNavigate();
  const { database } = useAppContext();
  const [sqlQuery, setSqlQuery] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  const runQuery = async () => {
    if (!sqlQuery.trim()) return;
    setSelectedTable(null);
    setIsExecuting(true);
    setResults(null);
    setError(null);
    try {
      const response = await RunQuery(sqlQuery);
      setResults(response);
    } catch (err: any) {
      setError(
        (prev) => prev || err?.message || err || "Error executing query"
      );
    } finally {
      setIsExecuting(false);
    }
  };

  const stopQuery = async () => {
    await CancelRunningQuery();
    setError("Query execution cancelled");
    setResults(null);
    setIsExecuting(false);
  };

  const { data: tableData, error: tableError } = useQuery({
    queryKey: ["tableData", selectedTable],
    queryFn: () => FetchTableData(selectedTable as string),
    enabled: !!selectedTable,
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (tableData) {
      setResults(tableData);
      setError(null);
    }
    if (tableError) {
      setResults(null);
      setError((tableError as Error).message);
    }
  }, [tableData, tableError]);

  useEffect(() => {
    if (database === "") navigate("/connect/clickhouse");
  }, [database]);

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
                {!tableData && (
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
                      error={error}
                      results={results}
                    />
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      <div className="shrink-0 border-t">
        <EditorFooter rowCount={results ? results.length : 0} />
      </div>
    </div>
  );
};
