import { useConnectionHealth } from "@/services/connections";
import { Circle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DISCONNECTED_STATUS, RTT_STATUSES } from "./constants";

export const ConnectionHealthIndicator = () => {
  const { data: rtt, error, isError } = useConnectionHealth();

  const status = isError
    ? DISCONNECTED_STATUS
    : rtt != null && rtt > 0
      ? RTT_STATUSES.find((range) => rtt < range.upperBound)
      : undefined;

  if (!status) {
    return null;
  }

  const statusColor = status.color;
  const statusName = status.name;

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

