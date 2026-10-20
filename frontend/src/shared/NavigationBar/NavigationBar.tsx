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
  SquareTerminal,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CloseCurrentConnection } from "@/services/bindings/connection";
import { errorMessage } from "@/lib/utils";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { queryKeys } from "@/services/queryKeys";
import type { EditorMode } from "@/context/editor/Context";

type NavigationBarProps = {
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  resultCollapsed: boolean;
  onToggleResult: () => void;
  dataViewOpen: boolean;
  onToggleDataView: () => void;
};

export function NavigationBar({
  mode,
  onModeChange,
  sidebarCollapsed,
  onToggleSidebar,
  resultCollapsed,
  onToggleResult,
  dataViewOpen,
  onToggleDataView,
}: NavigationBarProps) {
  const queryClient = useQueryClient();
  const { reload } = useAppContext();
  const handleDisconnect = async () => {
    try {
      await CloseCurrentConnection();
      queryClient.invalidateQueries({ queryKey: queryKeys.currentConnection });
    } catch (error) {
      toast.error(errorMessage(error));
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
                aria-label="Toggle sidebar"
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
          {mode === "query" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className={toggleButtonClass}
                  onClick={onToggleResult}
                  aria-label="Toggle result panel"
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
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className={toggleButtonClass}
                onClick={onToggleDataView}
                aria-label="Toggle side panel"
                data-state={dataViewOpen ? "on" : "off"}
              >
                {dataViewOpen ? (
                  <PanelRightClose className="h-5 w-5" />
                ) : (
                  <PanelRightOpen className="h-5 w-5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Toggle side panel</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <div className="mr-2 flex items-center border-r border-border pr-2">
          <ToggleGroup
            type="single"
            value={mode}
            onValueChange={(value) => value && onModeChange(value as EditorMode)}
            aria-label="Editor mode"
            className="gap-1 bg-muted/50 p-0.5 rounded-lg border border-border"
          >
            <ToggleGroupItem
              value="query"
              size="sm"
              className="h-6 px-2 gap-1 text-xs rounded-md cursor-pointer data-[state=on]:bg-background data-[state=on]:shadow-sm transition-all"
            >
              <SquareTerminal className="size-3.5" />
              Query
            </ToggleGroupItem>
            <ToggleGroupItem
              value="ai"
              size="sm"
              className="h-6 px-2 gap-1 text-xs rounded-md cursor-pointer data-[state=on]:bg-background data-[state=on]:text-primary data-[state=on]:shadow-sm transition-all"
            >
              <Sparkles className="size-3.5" />
              AI
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
          onClick={handleDisconnect}
          title="Disconnect"
        >
          <LogOut className="h-5 w-5" />
        </Button>
        <MenuBar />
      </div>
    </div>
  );
}
