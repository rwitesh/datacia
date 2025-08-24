import { QueryInput } from "./QueryInput/QueryInput";
import { QueryToolbar } from "./QueryToolbar/QueryToolbar";
import { EditorSidebar } from "./EditorSidebar/EditorSidebar";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useAppContext } from "../Context/AppContext";
import { useNavigate } from "react-router";
import { QueryResult } from "./QueryResult/QueryResult";
import { useEditorContext } from "../Context/EditorContext";
import { EditorFooter } from "./EditorFooter/EditorFooter";

export const Editor = () => {
  const navigate = useNavigate();
  const { database } = useAppContext();
  const { activeTab } = useEditorContext();

  if (database === "") {
    navigate("/connect/clickhouse");
    return null;
  }

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
              <EditorSidebar />
            </div>
          </ResizablePanel>

          <ResizableHandle />
          <ResizablePanel className="min-w-0">
            <div className="flex h-full w-full flex-col overflow-hidden">
              <div className="shrink-0">
                <QueryToolbar />
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
                      <QueryResult />
                    </div>
                  </ResizablePanel>
                </ResizablePanelGroup>
              )}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      <div className="shrink-0 border-t">
        <EditorFooter/>
      </div>
    </div>
  );
};
