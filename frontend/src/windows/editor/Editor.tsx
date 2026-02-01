import { QueryInput } from "./QueryInput/QueryInput";
import { TabBar } from "./TabBar/Tab";
import { EditorSidebar } from "./EditorSidebar/EditorSidebar";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { QueryResult } from "./QueryResult/QueryResult";
import { ResultBar } from "./QueryResult/ResultBar/ResultBar";
import { useEditorContext } from "@/context/editor/Index";
import { EditorFooter } from "./EditorFooter/EditorFooter";
import { NavigationBar } from "@/shared/NavigationBar/NavigationBar";
import { DataView } from "./DataView/DataView";
import { useState, useEffect, useRef } from "react";
import { FileUp } from "lucide-react";
import { useWriteFile } from "@/services/queries";
import { toast } from "sonner";
import type { ImperativePanelHandle } from "react-resizable-panels";

export const Editor = () => {
  const { activeTab, createTab, updateTab } = useEditorContext();
  const [isDataViewOpen, setIsDataViewOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [resultCollapsed, setResultCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const sidebarRef = useRef<ImperativePanelHandle>(null);
  const resultRef = useRef<ImperativePanelHandle>(null);
  const writeFile = useWriteFile();

  const handleToggleSidebar = () => {
    if (sidebarRef.current?.isCollapsed()) {
      sidebarRef.current.expand();
    } else {
      sidebarRef.current?.collapse();
    }
  };

  const handleToggleResult = () => {
    if (resultRef.current?.isCollapsed()) {
      resultRef.current.expand();
    } else {
      resultRef.current?.collapse();
    }
  };

  // Handle Save Shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (activeTab && activeTab.type === "query") {
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

      if (activeTab && activeTab.type === "query") {
        updateTab(activeTab.id, { sql: text });
      } else {
        const newTab = createTab(sqlFile.name, "query");
        updateTab(newTab.id, { sql: text });
      }
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-card relative font-display">
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal" className="h-full w-full">
          <ResizablePanel
            id="sidebar"
            ref={sidebarRef}
            defaultSize={25}
            minSize={0}
            maxSize={100}
            collapsible
            onCollapse={() => setSidebarCollapsed(true)}
            onExpand={() => setSidebarCollapsed(false)}
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
                <NavigationBar
                  sidebarCollapsed={sidebarCollapsed}
                  onToggleSidebar={handleToggleSidebar}
                  resultCollapsed={resultCollapsed}
                  onToggleResult={handleToggleResult}
                  dataViewOpen={isDataViewOpen}
                  onToggleDataView={() => setIsDataViewOpen((v) => !v)}
                />
                <div className="border-b border-border">
                  <TabBar />
                </div>
              </div>
              <div className="flex-1 min-h-0 bg-card flex flex-col">
                <ResizablePanelGroup
                  direction="horizontal"
                  className="h-full w-full flex-1 min-h-0"
                >
                  <ResizablePanel className="min-w-0">
                    <ResizablePanelGroup
                      direction="vertical"
                      className="h-full"
                    >
                      {activeTab?.type === "query" && (
                        <>
                          <ResizablePanel
                            defaultSize={75}
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
                      <ResizablePanel
                        id="result"
                        ref={resultRef}
                        defaultSize={25}
                        minSize={0}
                        collapsible
                        className="min-h-0"
                        onCollapse={() => setResultCollapsed(true)}
                        onExpand={() => setResultCollapsed(false)}
                      >
                        <div className="h-full overflow-hidden">
                          <QueryResult
                            onOpenDataView={() => setIsDataViewOpen(true)}
                          />
                        </div>
                      </ResizablePanel>
                    </ResizablePanelGroup>
                  </ResizablePanel>

                  {isDataViewOpen && (
                    <>
                      <ResizableHandle />
                      <ResizablePanel minSize={15} defaultSize={42}>
                        <DataView />
                      </ResizablePanel>
                    </>
                  )}
                </ResizablePanelGroup>
                <div className="shrink-0 border-t border-border">
                  <ResultBar />
                </div>
              </div>
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
