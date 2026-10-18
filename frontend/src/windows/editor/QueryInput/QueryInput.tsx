import { useEffect } from "react";
import { useEditorContext } from "@/context/editor/Index";
import { useAppContext } from "@/context/app/Index";
import { formatSQL } from "./utils/formatter";
import { Button } from "@/components/ui/button";
import { Play, StopCircle, Paintbrush } from "lucide-react";
import { SQLCodeEditor } from "../components/SQLEditor";

export function QueryInput() {
  const { engine } = useAppContext();

  const {
    activeTab,
    updateTab,
    getSql,
    setDraftSql,
    commitDraftSql,
    runQuery,
    stopQuery,
  } = useEditorContext();

  // Typed text lives in the editor and is committed to the tab on blur and
  // when the editor goes away (tab switch, script mode), so a keystroke
  // doesn't re-render everything that reads the editor context.
  const tabId = activeTab?.id;
  useEffect(() => {
    if (!tabId) return;
    return () => commitDraftSql(tabId);
  }, [tabId, commitDraftSql]);

  const handleFormat = () => {
    if (activeTab && activeTab.type === "query") {
      const formatted = formatSQL(getSql(activeTab.id), engine || "sql");
      updateTab(activeTab.id, { sql: formatted });
    }
  };

  if (!activeTab || activeTab.type !== "query") return null;

  return (
    <div className="relative h-full w-full">
      {/* Keyed per tab so each tab gets its own undo history. */}
      <SQLCodeEditor
        key={activeTab.id}
        value={activeTab.sql || ""}
        onChange={(val) => setDraftSql(activeTab.id, val)}
        onBlur={() => commitDraftSql(activeTab.id)}
        className="h-full"
      />

      {/* Floating Action Buttons */}
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

        {!activeTab?.isExecuting ? (
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
