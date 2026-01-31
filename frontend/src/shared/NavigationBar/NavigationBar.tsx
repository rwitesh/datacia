import { useLocation } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { MenuBar } from "./Menubar";
import { useAppContext } from "@/context/app/Index";
import { DatabaseMenuBar } from "./DatabaseMenubar";
import {
  RotateCw,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  PanelBottomClose,
  PanelBottomOpen,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CloseCurrentConnection } from "@/services/bindings/connection";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type EditorViewToggles = {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  resultCollapsed: boolean;
  onToggleResult: () => void;
  dataViewOpen: boolean;
  onToggleDataView: () => void;
};

type NavigationBarProps = Partial<EditorViewToggles>;

export function NavigationBar({
  sidebarCollapsed,
  onToggleSidebar,
  resultCollapsed,
  onToggleResult,
  dataViewOpen,
  onToggleDataView,
}: NavigationBarProps = {}) {
  const location = useLocation();
  const queryClient = useQueryClient();
  const { reload } = useAppContext();
  const DisconnectHandler = async () => {
    try {
      await CloseCurrentConnection();
      // Invalidate current connection query so it refetches (will return null)
      queryClient.invalidateQueries({ queryKey: ["current-connection"] });
      // Window transition handled by backend
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error("Error disconnecting:", error.message);
      } else {
        console.error("Unknown error disconnecting:", error);
      }
    }
  };

  const isEditorPage = location.pathname === "/editor";
  const hasViewToggles =
    isEditorPage &&
    onToggleSidebar != null &&
    onToggleResult != null &&
    onToggleDataView != null;

  const toggleButtonClass =
    "cursor-pointer my-1 mx-0.5 data-[state=on]:bg-muted hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50";

  return (
    <div className="flex cursor-default border-b border-border bg-transparent w-full justify-end">
      <div className="flex items-center">
        {hasViewToggles && (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className={toggleButtonClass}
                  onClick={onToggleSidebar}
                  title="Toggle sidebar"
                  data-state={sidebarCollapsed ? "off" : "on"}
                >
                  {sidebarCollapsed ? (
                    <PanelLeftOpen className="h-5 w-5" />
                  ) : (
                    <PanelLeftClose className="h-5 w-5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Toggle sidebar</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className={toggleButtonClass}
                  onClick={onToggleResult}
                  title="Toggle result panel"
                  data-state={resultCollapsed ? "off" : "on"}
                >
                  {resultCollapsed ? (
                    <PanelBottomOpen className="h-5 w-5" />
                  ) : (
                    <PanelBottomClose className="h-5 w-5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Toggle result panel</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className={toggleButtonClass}
                  onClick={onToggleDataView}
                  title="Toggle DataView"
                  data-state={dataViewOpen ? "on" : "off"}
                >
                  {dataViewOpen ? (
                    <PanelRightClose className="h-5 w-5" />
                  ) : (
                    <PanelRightOpen className="h-5 w-5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Toggle DataView</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {isEditorPage && (
          <>
            <Button
              size="icon"
              variant="ghost"
              className="cursor-pointer"
              onClick={reload}
              title="Refresh"
            >
              <RotateCw className="h-5 w-5" />
            </Button>
            <DatabaseMenuBar />
          </>
        )}
        <Button
          size="icon"
          variant="ghost"
          className="cursor-pointer"
          onClick={DisconnectHandler}
          title="Disconnect"
        >
          <LogOut className="h-5 w-5" />
        </Button>
        <MenuBar />
      </div>
    </div>
  );
}
