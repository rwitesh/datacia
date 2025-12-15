import { useLocation } from "react-router";
import { useConnectionHealth } from "@/services/connectionHealth";
import { Circle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export const ConnectionHealthIndicator = () => {
  const location = useLocation();
  const isEditorPage = location.pathname === "/editor";
  const { data } = useConnectionHealth(isEditorPage);

  const latency = data?.latency ?? 0;
  const isOnline = data?.isOnline ?? false;

  const getStatus = () => {
    if (!data) return "unknown";
    if (!isOnline) return "unhealthy";
    if (latency > 5000) return "unhealthy";
    if (latency > 1000) return "degraded";
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
      case "unhealthy":
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
      case "unhealthy":
        return "Connection lost";
      default:
        return "Connection status unknown";
    }
  };

  const formatLatency = (ms: number) => {
    if (ms < 1) return "<1ms";
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5">
            <Circle className={`h-2.5 w-2.5 fill-current ${getStatusColor()}`} />
            {latency >= 0 && (
              <span className={`text-xs ${getStatusColor()}`}>
                {formatLatency(latency)}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p className="font-medium">{getStatusText()}</p>
            {latency >= 0 && (
              <p className="text-xs">
                Latency: {formatLatency(latency)}
              </p>
            )}
            {!isOnline && status === "unhealthy" && (
              <p className="text-xs text-destructive">
                Attempting to reconnect...
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
  );
};

