import { Button } from "@/components/ui/button";
import { Play, StopCircle } from "lucide-react";
import { TabBar } from "./Tab";

export function QueryToolbar({
  isExecuting,
  runQuery,
  stopQuery,
}: {
  isExecuting: boolean | undefined;
  runQuery: () => void;
  stopQuery: () => void;
}) {
  return (
    <div className="flex items-center justify-between bg-muted/50">
      <TabBar />
      <div className="flex items-center gap-2 mx-1">
        {!isExecuting ? (
          <Button
            variant="outline"
            className="h-6 p-1 cursor-pointer"
            onClick={runQuery}
          >
            <Play color="limegreen" strokeWidth={2} /> Run
          </Button>
        ) : (
          <Button
            variant="outline"
            className="h-6 p-1 cursor-pointer"
            onClick={stopQuery}
          >
            <StopCircle color="limegreen" strokeWidth={2} /> Stop
          </Button>
        )}
      </div>
    </div>
  );
}
