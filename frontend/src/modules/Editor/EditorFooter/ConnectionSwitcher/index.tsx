import { useFetchConnections, useCurrentConnection } from "@/services/connections";
import { useSwitchConnection } from "./useSwitchConnection";
import { type DatabaseEngine } from "@/modules/utils/engines";
import { DatabaseIcon } from "@/modules/utils/DatabaseIcon";
import { ChevronDown, Check, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function ConnectionSwitcher() {
  const { data: currentConnection } = useCurrentConnection();
  const { data: savedConnections = {}, isLoading } = useFetchConnections();
  const { mutate: switchTo, isPending } = useSwitchConnection();

  const connectionEntries = Object.entries(savedConnections);
  const hasOtherConnections = connectionEntries.some(([id]) => id !== currentConnection?.id);

  const handleSwitch = (id: string, name: string, engine: string) => {
    if (id === currentConnection?.id) return;
    switchTo({ id, name, engine: engine as DatabaseEngine });
  };

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs font-normal"
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <DatabaseIcon engine={currentConnection?.engine} size={14} />
              )}
              <span className="max-w-[30vw] truncate select-none">
                {currentConnection?.name || currentConnection?.host || "Connected"}
              </span>
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <div className="flex flex-col gap-1">
            <div><span>Engine:</span> {currentConnection?.engine || "-"}</div>
            <div><span>Host:</span> {currentConnection?.host || "-"}</div>
            <div><span>User:</span> {currentConnection?.username || "-"}</div>
          </div>
        </TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="start" className="w-[200px]">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          Switch Connection
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : connectionEntries.length === 0 ? (
          <div className="py-2 px-2 text-[10px] text-muted-foreground text-center">
            No saved connections
          </div>
        ) : (
          connectionEntries.map(([id, conn]) => (
            <DropdownMenuItem
              key={id}
              className="flex items-center gap-2 cursor-pointer text-xs"
              onClick={() => handleSwitch(id, conn.name, conn.engine)}
              disabled={id === currentConnection?.id || isPending}
            >
              <DatabaseIcon engine={conn.engine} size={12} />
              <span className="flex-1 truncate">{conn.name}</span>
              {id === currentConnection?.id && <Check className="h-3 w-3 text-primary" />}
            </DropdownMenuItem>
          ))
        )}

        {!hasOtherConnections && connectionEntries.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="py-2 px-2 text-[10px] text-muted-foreground text-center">
              No other connections available
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
