import { useEditorContext } from "@/context/editor/Index";
import { useAppContext } from "@/context/app/Index";
import { formatSQL } from "./utils/formatter";
import { Button } from "@/components/ui/button";
import { Play, StopCircle, Paintbrush } from "lucide-react";
import { SQLCodeEditor } from "./SQLCodeEditor";
import { getTabSql, setTabSql, useTabSql } from "@/context/editor/store";

export function QueryInput() {
  const { engine } = useAppContext();

  const { activeTab, runQuery, stopQuery } = useEditorContext();
  const sql = useTabSql(activeTab?.id);

  if (!activeTab || activeTab.type !== "query") return null;

  const handleFormat = () =>
    setTabSql(activeTab.id, formatSQL(getTabSql(activeTab.id), engine || "sql"));

  return (
    <div className="relative h-full w-full">
      {/* Keyed per tab so each tab gets its own undo history. */}
      <SQLCodeEditor
        key={activeTab.id}
        value={sql}
        onChange={(val) => setTabSql(activeTab.id, val)}
        className="h-full"
      />

      <div className="absolute bottom-3 right-3 flex items-center gap-2 z-10">
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-3 cursor-pointer select-none gap-1.5 bg-background/80 backdrop-blur-sm hover:bg-background shadow-md border-border/50"
          onClick={handleFormat}
        >
          <Paintbrush className="w-3.5 h-3.5" />
          Format
        </Button>

        {!activeTab.isExecuting ? (
          <Button
            size="sm"
            className="h-7 px-4 cursor-pointer select-none gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-500/25 border-0 font-medium"
            onClick={() => runQuery()}
          >
            <Play className="w-3.5 h-3.5" strokeWidth={2.5} />
            Run
          </Button>
        ) : (
          <Button
            size="sm"
            className="h-7 px-4 cursor-pointer select-none gap-1.5 bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white shadow-lg shadow-red-500/25 border-0 font-medium"
            onClick={() => stopQuery()}
          >
            <StopCircle className="w-3.5 h-3.5" strokeWidth={2.5} />
            Stop
          </Button>
        )}
      </div>
    </div>
  );
}
