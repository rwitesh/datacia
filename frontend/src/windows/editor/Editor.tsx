import { QueryInput } from "./QueryInput/QueryInput";
import { TabBar } from "./TabBar/TabBar";
import { EditorSidebar } from "./EditorSidebar/EditorSidebar";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { QueryResult } from "./QueryResult/QueryResult";
import { ResultBar } from "./QueryResult/ResultBar/ResultBar";
import { useEditorContext } from "@/context/editor/Index";
import { getTabSql, setTabSql } from "@/context/editor/store";
import { EditorFooter } from "./EditorFooter/EditorFooter";
import { NavigationBar } from "@/shared/NavigationBar/NavigationBar";
import { DataView, type DataViewTab } from "./DataView";
import { useState, useEffect, useRef } from "react";
import { FileUp } from "lucide-react";
import { useWriteFile } from "@/services/queries";
import { toast } from "sonner";
import type { PanelImperativeHandle } from "react-resizable-panels";
import { ScriptMode } from "./ScriptMode/ScriptMode";

type ViewPanels = { resultCollapsed: boolean; dataViewOpen: boolean };

export const Editor = () => {
  const { activeTab, createTab } = useEditorContext();
  const [viewPanels, setViewPanels] = useState<ViewPanels>({
    resultCollapsed: false,
    dataViewOpen: false,
  });
  const [dataViewTab, setDataViewTab] = useState<DataViewTab>("data");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isScriptMode, setIsScriptMode] = useState(false);
  const sidebarRef = useRef<PanelImperativeHandle>(null);
  const { mutate: writeFile } = useWriteFile();

  const { resultCollapsed, dataViewOpen } = viewPanels;
  const togglePanel = (panel: keyof ViewPanels) =>
    setViewPanels((prev) => ({ ...prev, [panel]: !prev[panel] }));
  const openDataView = () => {
    setDataViewTab("data");
    setViewPanels((prev) => ({ ...prev, dataViewOpen: true }));
  };
  const toggleAIChat = () => {
    const isAIOpen = dataViewOpen && dataViewTab === "ai";
    setDataViewTab("ai");
    setViewPanels((prev) => ({ ...prev, dataViewOpen: !isAIOpen }));
  };

  const handleToggleSidebar = () => {
    if (sidebarRef.current?.isCollapsed()) {
      sidebarRef.current.expand();
    } else {
      sidebarRef.current?.collapse();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (activeTab && activeTab.type === "query") {
          if (activeTab.savedPath) {
            writeFile({
              path: activeTab.savedPath,
              content: getTabSql(activeTab.id),
            });
          } else {
            toast(
              "This query is not saved to a file. Create a file in Queries tab first.",
            );
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
    // Moving onto a child (such as the overlay) also fires dragleave here.
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
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
        setTabSql(activeTab.id, text);
      } else {
        const newTab = createTab(sqlFile.name, "query");
        setTabSql(newTab.id, text);
      }
    }
  };

  const showQueryInput = activeTab?.type === "query";
  const isResultPanelVisible = !resultCollapsed;

  return (
    <div className="h-full w-full flex flex-col bg-card font-display">
      <div className="shrink-0">
        <NavigationBar
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={handleToggleSidebar}
          resultCollapsed={resultCollapsed}
          onToggleResult={() => togglePanel("resultCollapsed")}
          dataViewOpen={dataViewOpen}
          onToggleDataView={() => togglePanel("dataViewOpen")}
          isScriptMode={isScriptMode}
          onToggleScriptMode={() => setIsScriptMode((prev) => !prev)}
        />
      </div>

      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          <ResizablePanel
            id="sidebar"
            panelRef={sidebarRef}
            defaultSize={25}
            minSize={25}
            collapsible
            className="overflow-hidden"
            onResize={(size) => setSidebarCollapsed(size.inPixels === 0)}
          >
            <EditorSidebar />
          </ResizablePanel>

          <ResizableHandle />

          <ResizablePanel className="min-w-0" defaultSize={80}>
            {/* Always mounted so its blocks survive toggling the mode. */}
            <div className={isScriptMode ? "h-full" : "hidden"}>
              <ScriptMode />
            </div>
            {!isScriptMode && (
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

                <div className="shrink-0 border-b border-border">
                  <TabBar />
                </div>

                <div className="flex-1 min-h-0">
                  <ResizablePanelGroup direction="horizontal" className="h-full">
                    <ResizablePanel
                      className="min-w-0"
                      defaultSize={dataViewOpen ? 58 : 100}
                    >
                      <ResizablePanelGroup
                        direction="vertical"
                        className="h-full"
                      >
                        {showQueryInput && (
                          <>
                            <ResizablePanel
                              defaultSize={isResultPanelVisible ? 50 : 100}
                              minSize={20}
                              className="min-h-0 overflow-hidden"
                            >
                              <QueryInput />
                            </ResizablePanel>
                            {isResultPanelVisible && <ResizableHandle />}
                          </>
                        )}

                        {isResultPanelVisible && (
                          <ResizablePanel
                            defaultSize={showQueryInput ? 50 : 100}
                            minSize={20}
                            className="min-h-0 overflow-hidden"
                          >
                            <QueryResult onOpenDataView={openDataView} />
                          </ResizablePanel>
                        )}
                      </ResizablePanelGroup>
                    </ResizablePanel>

                    {dataViewOpen && (
                      <>
                        <ResizableHandle />
                        <ResizablePanel
                          minSize={25}
                          defaultSize={42}
                          maxSize={60}
                          className="min-w-0 overflow-hidden"
                        >
                          <DataView
                            activeTab={dataViewTab}
                            onTabChange={setDataViewTab}
                          />
                        </ResizablePanel>
                      </>
                    )}
                  </ResizablePanelGroup>
                </div>

                <div className="shrink-0">
                  <ResultBar />
                </div>
              </div>
            )}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      <div className="shrink-0 border-t border-border">
        <EditorFooter
          onToggleAI={toggleAIChat}
          aiActive={dataViewOpen && dataViewTab === "ai"}
        />
      </div>
    </div>
  );
};
