import { Button } from "@/components/ui/button";
import { Play, StopCircle, Paintbrush } from "lucide-react";
import { TabBar } from "./Tab";
import { useEditorContext } from "@/modules/Context/Editor/Index";
import { formatSQL } from "../QueryInput/utils/formatter";

export function QueryToolbar() {
  const { activeTab, runQuery, stopQuery, updateTab } = useEditorContext();

  const handleFormat = () => {
    if (activeTab && activeTab.mode === "query") {
      const formatted = formatSQL(activeTab.sql || "");
      updateTab(activeTab.id, { sql: formatted });
    }
  };

  return (
    <div className="flex items-center justify-between border-b border-border">
      <TabBar />
      <div className="flex items-center gap-2 mx-1">
        <Button
          variant="outline"
          className="h-6 p-1 cursor-pointer select-none gap-1"
          onClick={handleFormat}
        >
          <Paintbrush className="w-3.5 h-3.5" /> Format
        </Button>
        {!activeTab?.isExecuting ? (
          <Button
            variant="outline"
            className="h-6 p-1 cursor-pointer select-none gap-1"
            onClick={() => runQuery()}
          >
            <Play color="limegreen" strokeWidth={2} className="w-3.5 h-3.5" />{" "}
            Run
          </Button>
        ) : (
          <Button
            variant="outline"
            className="h-6 p-1 cursor-pointer select-none gap-1"
            onClick={() => stopQuery()}
          >
            <StopCircle
              color="limegreen"
              strokeWidth={2}
              className="w-3.5 h-3.5"
            />{" "}
            Stop
          </Button>
        )}
      </div>
    </div>
  );
}
