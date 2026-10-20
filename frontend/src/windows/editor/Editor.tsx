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
import { cn } from "@/lib/utils";
import type { PanelImperativeHandle } from "react-resizable-panels";
import { AIChat } from "./AIChat/AIChat";

type ViewPanels = { resultCollapsed: boolean; dataViewOpen: boolean };

export const Editor = () => {
  const { activeTab, createTab, editorMode, setEditorMode } = useEditorContext();
  const [viewPanels, setViewPanels] = useState<ViewPanels>({
    resultCollapsed: false,
    dataViewOpen: false,
  });
  const [dataViewTab, setDataViewTab] = useState<DataViewTab>("data");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
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
      if ((e.metaKey || e.ctrlKey) && e.key === "s" && editorMode === "query") {
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
  }, [activeTab, writeFile, editorMode]);

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
  const isAIMode = editorMode === "ai";
  // A panel left on the chat hides in AI mode and returns in query mode.
  const sidePanelOpen = dataViewOpen && !(isAIMode && dataViewTab === "ai");
  const toggleSidePanel = () =>
    isAIMode && !sidePanelOpen ? openDataView() : togglePanel("dataViewOpen");

  return (
    <div className="h-full w-full flex flex-col bg-card font-display">
      <div className="shrink-0">
        <NavigationBar
          mode={editorMode}
          onModeChange={setEditorMode}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={handleToggleSidebar}
          resultCollapsed={resultCollapsed}
          onToggleResult={() => togglePanel("resultCollapsed")}
          dataViewOpen={sidePanelOpen}
          onToggleDataView={toggleSidePanel}
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

          <ResizablePanel id="workspace" className="min-w-0" defaultSize={75}>
            <ResizablePanelGroup direction="horizontal" className="h-full">
              <ResizablePanel id="main" className="min-w-0 relative" defaultSize={sidePanelOpen ? 62 : 100}>
                {isAIMode && <AIChat wide />}
                {/* Kept mounted in AI mode so the editor, results and selection survive. */}
                <div
                  className={cn(
                    "flex h-full w-full flex-col overflow-hidden relative",
                    isAIMode && "invisible absolute inset-0",
                  )}
                  inert={isAIMode}
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
                    <ResizablePanelGroup direction="vertical" className="h-full">
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
                  </div>

                  <div className="shrink-0">
                    <ResultBar />
                  </div>
                </div>
              </ResizablePanel>

              {sidePanelOpen && (
                <>
                  <ResizableHandle />
                  <ResizablePanel
                    id="side-panel"
                    minSize={25}
                    defaultSize={38}
                    maxSize={60}
                    className="min-w-0 overflow-hidden"
                  >
                    <DataView
                      activeTab={dataViewTab}
                      onTabChange={setDataViewTab}
                      showAI={!isAIMode}
                    />
                  </ResizablePanel>
                </>
              )}
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      <div className="shrink-0 border-t border-border">
        <EditorFooter
          onToggleAI={isAIMode ? undefined : toggleAIChat}
          aiActive={dataViewOpen && dataViewTab === "ai"}
        />
      </div>
    </div>
  );
};
