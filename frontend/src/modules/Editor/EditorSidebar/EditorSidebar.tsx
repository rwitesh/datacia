import { RefreshCw, Table } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEditorContext } from "@/modules/Context/EditorContext";

export function EditorSidebar({
  table,
  setTable,
}: {
  table: string | undefined;
  setTable: (value: string) => void;
}) {
  const {
    tables: { data, loading, error, refresh }, createTab
  } = useEditorContext();

  const handleTableClick = (table: string) => {
    createTab(table, "table")
    setTable(table);
  };

  return (
    <div className="h-full w-full flex flex-col bg-sidebar text-sidebar-foreground select-none cursor-default">
      <div className="sticky top-0 z-10 flex items-center gap-2 px-3 py-2 border-b border-sidebar-border bg-sidebar">
        <Table className="h-4 w-4" />
        <span className="text-sm font-medium ">Tables</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={refresh}
          disabled={loading}
          className="ml-auto h-6 w-6 cursor-pointer"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2">
        <div className="space-y-1">
          {data.map((t: string) => (
            <button
              key={t}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-sidebar-accent ${
                table === t ? "bg-sidebar-accent" : ""
              }`}
              title={t}
              onClick={() => handleTableClick(t)}
            >
              <Table className="h-3 w-3 opacity-60" />
              <span className="truncate">{t}</span>
            </button>
          ))}

          {!loading &&
            data.length === 0 &&
            (error ? (
              <div className="px-2 py-1.5 text-xs text-red-500 bg-transparent cursor-default select-none">
                {error.message}
              </div>
            ) : (
              <div className="px-2 py-1.5 text-xs text-muted-foreground bg-muted rounded-md cursor-default select-none">
                No tables found
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
