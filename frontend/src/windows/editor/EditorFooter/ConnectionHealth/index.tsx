import { useConnectionHealth } from "@/services/connections";
import { Circle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { DISCONNECTED_STATUS, RTT_STATUSES } from "./constants";

function formatRTT(ms: number) {
  if (ms < 1) return "<1ms";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export const ConnectionHealthIndicator = () => {
  const { data: rtt, error, isError } = useConnectionHealth();

  let status, label, detail;
  if (isError) {
    status = DISCONNECTED_STATUS;
    label = "Disconnected";
    detail = error?.message || "Connection error";
  } else if (rtt != null && rtt > 0) {
    status = RTT_STATUSES.find((range) => rtt < range.upperBound);
    label = formatRTT(rtt);
    detail = `RTT: ${label}`;
  }
  if (!status) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1.5">
          <Circle className={cn("h-2.5 w-2.5 fill-current", status.color)} />
          <span className={cn("text-xs", status.color)}>{label}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <div className="space-y-1">
          <p className="font-medium">{status.name}</p>
          <p className="text-xs">{detail}</p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
};
