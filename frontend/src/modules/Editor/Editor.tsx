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
import { useEditorContext } from "../Context/EditorContext";

export const Editor = () => {
  const navigate = useNavigate();
  const { database } = useAppContext();
  const { activeTab, updateTab } = useEditorContext();
  const [selectedTable, setSelectedTable] = useState<string | undefined>(
    undefined
  );

  const { tables: tableData, error: tableError } = fetchTableData(
    selectedTable as string
  );

  const runQuery = async () => {
    if (!activeTab || !activeTab.sql.trim() || activeTab.mode !== "query")
      return;
    setSelectedTable(undefined);
    updateTab(activeTab.id, {
      isExecuting: true,
      results: null,
      error: undefined,
    });

    try {
      const response = await RunQuery(activeTab.sql);
      updateTab(activeTab.id, {
        results: response,
        isExecuting: false,
      });
    } catch (err: any) {
      updateTab(activeTab.id, {
        error: err?.message || String(err) || "Error executing query",
        results: null,
        isExecuting: false,
      });
    }
  };

  const stopQuery = async () => {
    if (!activeTab) return;

    await CancelRunningQuery();
    updateTab(activeTab.id, {
      error: "Query execution cancelled",
      results: null,
      isExecuting: false,
    });
  };

  if (database === "") {
    navigate("/connect/clickhouse");
    return null;
  }

  // Determine what to show in QueryResult
  const finalResults =
    activeTab?.mode === "query" ? activeTab?.results : tableData;
  const finalError =
    activeTab?.mode === "query" ? activeTab?.error : tableError;
  const isExecuting = activeTab?.isExecuting;

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
              <div className="shrink-0">
                <QueryToolbar
                  isExecuting={isExecuting}
                  runQuery={runQuery}
                  stopQuery={stopQuery}
                />
              </div>

              {activeTab && (
                <ResizablePanelGroup direction="vertical" className="flex-1">
                  {activeTab.mode === "query" && (
                    <>
                      <ResizablePanel
                        defaultSize={45}
                        minSize={0}
                        className="min-h-0"
                      >
                        <div className="h-full">
                          <QueryInput />
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
              )}
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
