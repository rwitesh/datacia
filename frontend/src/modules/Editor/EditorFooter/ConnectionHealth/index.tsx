import { useLocation } from "react-router";
import { useConnectionHealth } from "@/services/connections";
import { Circle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RTT_RANGES, STATUS_COLORS, STATUS_NAMES, type ConnectionStatus } from "./constants";

export const ConnectionHealthIndicator = () => {
  const location = useLocation();
  const isEditorPage = location.pathname === "/editor";
  const { data: rtt, error, isError } = useConnectionHealth(isEditorPage);

  if (!isEditorPage) {
    return null;
  }

  // Determine status based on RTT
  let status: ConnectionStatus = "unknown";
  if (isError) {
    status = "disconnected";
  } else if (rtt != null && rtt > 0) {
    for (const range of RTT_RANGES) {
      if (rtt < range.upperBound) {
        status = range.name.toLowerCase() as ConnectionStatus;
        break;
      }
    }
  }

  const statusColor = STATUS_COLORS[status];
  const statusName = STATUS_NAMES[status];

  const formatRTT = (ms: number) => {
    if (ms < 1) return "<1ms";
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const errorMessage = error?.message || "Connection error";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1.5">
          <Circle className={`h-2.5 w-2.5 fill-current ${statusColor}`} />
          {isError ? (
            <span className={`text-xs ${statusColor}`}>
              Disconnected
            </span>
          ) : rtt != null && rtt > 0 && (
            <span className={`text-xs ${statusColor}`}>
              {formatRTT(rtt)}
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <div className="space-y-1">
          <p className="font-medium">{statusName}</p>
          {isError ? (
            <p className="text-xs">
              {errorMessage}
            </p>
          ) : rtt != null && rtt > 0 && (
            <p className="text-xs">
              RTT: {formatRTT(rtt)}
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

