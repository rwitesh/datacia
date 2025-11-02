import { QueryInput } from "./QueryInput/QueryInput";
import { QueryToolbar } from "./QueryToolbar/QueryToolbar";
import { EditorSidebar } from "./EditorSidebar/EditorSidebar";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { QueryResult } from "./QueryResult/QueryResult";
import { useEditorContext } from "../Context/Editor/Index";
import { EditorFooter } from "./EditorFooter/EditorFooter";
import { NavigationBar } from "../NavigationBar/NavigationBar";
import { DataView } from "./DataView/DataView";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { useState, useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight, Copy } from "lucide-react";

export const Editor = () => {
  const { activeTab, tables } = useEditorContext();
  const [isDataViewOpen, setIsDataViewOpen] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // Selected Data
  const [selectedData, setSelectedData] = useState<
    Array<Record<string, unknown>>
  >([]);

  // Handle initial loading state
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialLoading(false);
    }, 1500); // Show loading for 1.5 seconds

    return () => clearTimeout(timer);
  }, []);

  const handleCopy = useCallback(() => {
    navigator.clipboard
      .writeText(JSON.stringify(selectedData, null, 2))
      .catch((err) => console.error("Copy failed:", err));
  }, [selectedData]);

  return (
    <div className="h-full w-full flex flex-col bg-card relative">
      {/* Loading Overlay */}
      <LoadingOverlay 
        isVisible={isInitialLoading || tables.isLoading}
      >
        Initializing Editor...
      </LoadingOverlay>

      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal" className="h-full w-full">
          <ResizablePanel
            defaultSize={25}
            minSize={0}
            maxSize={100}
            collapsible
            className="min-w-30"
          >
            <div className="h-full w-full overflow-hidden">
              <EditorSidebar />
            </div>
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel className="min-w-0">
            <div className="flex h-full w-full flex-col overflow-hidden">
              <div className="shrink-0">
                <NavigationBar />
                <QueryToolbar />
              </div>
              {activeTab && (
                <div className="flex-1 min-h-0">
                  <ResizablePanelGroup
                    direction="horizontal"
                    className="h-full w-full"
                  >
                    {/* Main Query Editor Area */}
                    <ResizablePanel className="min-w-0">
                      <ResizablePanelGroup
                        direction="vertical"
                        className="h-full"
                      >
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
                            <QueryResult onSelectionChange={setSelectedData} />
                          </div>
                        </ResizablePanel>
                      </ResizablePanelGroup>
                    </ResizablePanel>

                    {/* DataView Sidebar Toggle Button */}
                    <div className="relative">
                      <button
                        onClick={() => setIsDataViewOpen(!isDataViewOpen)}
                        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-border hover:bg-border/80 rounded-l-md p-1 transition-colors"
                        style={{ marginLeft: isDataViewOpen ? "0" : "-24px" }}
                      >
                        {isDataViewOpen ? (
                          <ChevronRight className="h-4 w-4" />
                        ) : (
                          <ChevronLeft className="h-4 w-4" />
                        )}
                      </button>
                    </div>

                    {/* DataView Sidebar */}
                    {isDataViewOpen && (
                      <>
                        <ResizableHandle />
                        <ResizablePanel
                          defaultSize={25}
                          minSize={15}
                          maxSize={50}
                          className="min-w-60"
                        >
                          <div className="relative h-full w-full overflow-hidden border-l">
                            {/* Header */}
                            <div className="flex items-center justify-between p-2 border-b bg-muted/50">
                              <h3 className="text-sm font-medium">Data View</h3>
                              <button
                                onClick={handleCopy}
                                className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-background shadow hover:bg-accent transition-colors"
                              >
                                <Copy className="h-4 w-4" />
                                Copy
                              </button>
                            </div>

                            {/* Body */}
                            <DataView selectedData={selectedData} />
                          </div>
                        </ResizablePanel>
                      </>
                    )}
                  </ResizablePanelGroup>
                </div>
              )}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      <div className="shrink-0 border-t">
        <EditorFooter />
      </div>
    </div>
  );
};
