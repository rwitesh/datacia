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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CloseCurrentConnection } from "@/services/bindings/connection";
import { errorMessage } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type NavigationBarProps = {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  resultCollapsed: boolean;
  onToggleResult: () => void;
  dataViewOpen: boolean;
  onToggleDataView: () => void;
  isScriptMode: boolean;
  onToggleScriptMode: () => void;
};

export function NavigationBar({
  sidebarCollapsed,
  onToggleSidebar,
  resultCollapsed,
  onToggleResult,
  dataViewOpen,
  onToggleDataView,
  isScriptMode,
  onToggleScriptMode,
}: NavigationBarProps) {
  const queryClient = useQueryClient();
  const { reload } = useAppContext();
  const DisconnectHandler = async () => {
    try {
      await CloseCurrentConnection();
      // Invalidate current connection query so it refetches (will return null)
      queryClient.invalidateQueries({ queryKey: ["current-connection"] });
      // Window transition handled by backend
    } catch (error: unknown) {
      console.error("Error disconnecting:", errorMessage(error));
    }
  };

  const toggleButtonClass =
    "cursor-pointer my-1 mx-0.5 data-[state=on]:bg-muted hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50";

  return (
    <div className="flex cursor-default border-b border-border w-full justify-end">
      <div className="flex items-center">
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
        <div className="mr-2 flex items-center border-r border-border pr-2">
          <ToggleGroup
            type="single"
            value={isScriptMode ? "script" : "sql"}
            onValueChange={(val) => {
              if (!val) return;
              if (
                (val === "script" && !isScriptMode) ||
                (val === "sql" && isScriptMode)
              ) {
                onToggleScriptMode();
              }
            }}
            className="gap-1 bg-muted/50 p-0.5 rounded-lg border border-border"
          >
            <ToggleGroupItem
              value="sql"
              size="sm"
              className="h-6 px-2 text-xs rounded-md data-[state=on]:bg-background data-[state=on]:shadow-sm transition-all"
            >
              SQL
            </ToggleGroupItem>
            <ToggleGroupItem
              value="script"
              size="sm"
              className="h-6 px-2 text-xs rounded-md data-[state=on]:bg-background data-[state=on]:shadow-sm transition-all text-emerald-600 font-medium"
            >
              Script
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
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
