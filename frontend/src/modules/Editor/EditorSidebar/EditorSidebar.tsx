import { useEffect, useState } from "react";
import { RefreshCw, Table } from "lucide-react";
import { ListTables } from "@/services/clickhouse";
import { Button } from "@/components/ui/button";
import { useAppContext } from "@/modules/Context/AppContext";

export function EditorSidebar() {
  const { database, tables = [], setTables } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const listTables = async () => {
    setLoading(true);
    setError(undefined);
    try {
      const result = await ListTables(database);
      setTables(result || []);
    } catch (e: any) {
      setError(e);
      setTables([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    listTables();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [database]);

  return (
    <div className="h-full w-full flex flex-col bg-sidebar text-sidebar-foreground">
      <div className="sticky top-0 z-10 flex items-center gap-2 px-3 py-2 border-b border-sidebar-border bg-sidebar">
        <Table className="h-4 w-4" />
        <span className="text-sm font-medium">Tables</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={listTables}
          disabled={loading}
          className="ml-auto h-6 w-6 cursor-pointer"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2">
        <div className="space-y-1">
          {tables.map((table: string) => (
            <button
              key={table}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-sidebar-accent"
              title={table}
            >
              <Table className="h-3 w-3 opacity-60" />
              <span className="truncate">{table}</span>
            </button>
          ))}

          {!loading && tables.length === 0 && (
            error ? (
              <div className="px-2 py-1.5 text-xs text-red-500 bg-transparent">
                {error}
              </div>
            ) : (
              <div className="px-2 py-1.5 text-xs text-muted-foreground bg-muted rounded-md">
                No tables found
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
