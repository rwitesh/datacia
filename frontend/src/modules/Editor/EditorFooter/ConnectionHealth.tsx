import { useLocation } from "react-router";
import { useConnectionHealth } from "@/services/hooks"
import { Circle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export const ConnectionHealthIndicator = () => {
  const location = useLocation();
  const isEditorPage = location.pathname === "/editor";
  const { data: latency, error, isError } = useConnectionHealth(isEditorPage);

  const getStatus = () => {
    if (isError) return "disconnected";
    if (!latency) return "unknown";
    if (latency > 500) return "degraded";
    return "healthy";
  };

  const status = getStatus();

  if (!isEditorPage) {
    return null;
  }

  const getStatusColor = () => {
    switch (status) {
      case "healthy":
        return "text-green-500";
      case "degraded":
        return "text-yellow-500";
      case "disconnected":
        return "text-red-500";
      default:
        return "text-foreground";
    }
  };

  const getStatusText = () => {
    switch (status) {
      case "healthy":
        return "Connection healthy";
      case "degraded":
        return "Connection degraded";
      case "disconnected":
        return "Disconnected";
      default:
        return "Connection status unknown";
    }
  };

  const formatLatency = (ms: number) => {
    if (ms < 1) return "<1ms";
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const errorMessage = error?.message || "Connection error";

  return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5">
            <Circle className={`h-2.5 w-2.5 fill-current ${getStatusColor()}`} />
            {isError ? (
              <span className={`text-xs ${getStatusColor()}`}>
                Disconnected
              </span>
            ) : latency != null && latency > 0 && (
              <span className={`text-xs ${getStatusColor()}`}>
                {formatLatency(latency)}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p className="font-medium">{getStatusText()}</p>
            {isError ? (
              <p className="text-xs">
                {errorMessage}
              </p>
            ) : latency != null && latency > 0 && (
              <p className="text-xs">
                Latency: {formatLatency(latency)}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
  );
};

