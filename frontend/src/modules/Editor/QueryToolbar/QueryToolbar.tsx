import { Button } from "@/components/ui/button";
import { Play, StopCircle } from "lucide-react";
import { TabBar } from "./Tab";
import { useEditorContext } from "@/modules/Context/Editor/Index";

export function QueryToolbar() {
  const {activeTab, runQuery, stopQuery} = useEditorContext();
  return (
    <div className="flex items-center justify-between">
      <TabBar />
      <div className="flex items-center gap-2 mx-1">
        {!activeTab?.isExecuting ? (
          <Button
            variant="outline"
            className="h-6 p-1 cursor-pointer"
            onClick={() => runQuery()}
          >
            <Play color="limegreen" strokeWidth={2} /> Run
          </Button>
        ) : (
          <Button
            variant="outline"
            className="h-6 p-1 cursor-pointer"
            onClick={() => stopQuery()}
          >
            <StopCircle color="limegreen" strokeWidth={2} /> Stop
          </Button>
        )}
      </div>
    </div>
  );
}
