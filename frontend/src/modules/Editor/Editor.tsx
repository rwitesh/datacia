import { QueryInput } from "./QueryInput/QueryInput";
import { TabBar } from "./TabBar/Tab";
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
import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, FileUp } from "lucide-react";
import { useWriteFile } from "@/services/queries";
import { toast } from "sonner";

export const Editor = () => {
  const { activeTab, tables, createTab, updateTab } = useEditorContext();
  const [isDataViewOpen, setIsDataViewOpen] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const writeFile = useWriteFile();

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

  // Handle Save Shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (activeTab && activeTab.mode === "query") {
          if (activeTab.savedPath) {
            writeFile.mutate({
              path: activeTab.savedPath,
              content: activeTab.sql || "",
            });
          } else {
            // Optional: Handle "Save As" flow or prompt user
            // For now, only files opened from Queries tab support direct saving
            toast("This query is not saved to a file. Create a file in Queries tab first.");
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTab, writeFile]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const sqlFile = files.find((file) => file.name.endsWith(".sql"));

    if (sqlFile) {
      const text = await sqlFile.text();

      if (activeTab && activeTab.mode === "query") {
        updateTab(activeTab.id, { sql: text });
      } else {
        const newTab = createTab(sqlFile.name, "query");
        updateTab(newTab.id, { sql: text });
      }
    }
  };

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
            <div
              className="flex h-full w-full flex-col overflow-hidden relative"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {isDragging && (
                <div className="absolute inset-0 z-50 bg-background/90 backdrop-blur-sm flex flex-col items-center justify-center border-2 border-dashed border-primary m-4 rounded-lg animate-in fade-in duration-200">
                  <div className="bg-primary/10 p-6 rounded-full mb-4">
                    <FileUp className="w-12 h-12 text-primary" />
                  </div>
                  <h3 className="text-2xl font-semibold text-primary mb-2">
                    Import SQL File
                  </h3>
                  <p className="text-muted-foreground text-lg">
                    Drop your .sql file here to open it in the editor
                  </p>
                </div>
              )}
              <div className="shrink-0">
                <NavigationBar />
                <div className="border-b border-border">
                  <TabBar />
                </div>
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
                            <QueryResult 
                              onSelectionChange={setSelectedData} 
                              onOpenDataView={() => setIsDataViewOpen(true)}
                            />
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
                          <DataView selectedData={selectedData} />
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
