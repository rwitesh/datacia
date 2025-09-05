import {Table } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useEditorContext } from "@/modules/Context/Editor/Index";
// import { useRunQuery } from "@/services/hooks";

export function EditorSidebar() {
  const {
    tables: { data, isLoading, error},
    createTab,
    runQuery,
  } = useEditorContext();
  // const { mutateAsync } = useRunQuery();

  const handleTableClick = async (table: string) => {
    const tab = createTab(table, "table");
    const sql = `SELECT * FROM ${tab.table} LIMIT ${tab.limit}  OFFSET ${tab.offset}`;
    await runQuery(tab.id, sql, true);
  };

  const handleOpenTableSchema = async (table: string) => {
    const tab = createTab(table, "table");
    const sql = `DESCRIBE TABLE ${tab.table}`;
    await runQuery(tab.id, sql);
  };

  return (
    <div className="h-full w-full flex flex-col bg-sidebar text-sidebar-foreground select-none cursor-default">
      <div className="sticky top-0 z-10 flex items-center gap-2 px-3 py-2 border-b border-sidebar-border bg-sidebar">
        <Table className="h-4 w-4" />
        <span className="text-sm font-medium ">Tables</span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2">
        <div className="space-y-1">
          {data.map((t: string) => (
            <ContextMenu key={t}>
              <ContextMenuTrigger asChild>
                <button
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-sidebar-accent"
                  title={t}
                  onClick={() => handleTableClick(t)}
                >
                  <Table className="h-3 w-3 opacity-60" />
                  <span className="truncate">{t}</span>
                </button>
              </ContextMenuTrigger>

              <ContextMenuContent>
                <ContextMenuItem
                  className="text-xs"
                  onClick={() => handleTableClick(t)}
                >
                  View Data
                </ContextMenuItem>
                <ContextMenuItem
                  className="text-xs"
                  onClick={() => handleOpenTableSchema(t)}
                >
                  View Schema
                </ContextMenuItem>
                <ContextMenuItem
                  className="text-xs"
                  onClick={() => navigator.clipboard.writeText(t)}
                >
                  Copy name
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem className="text-xs">Rename</ContextMenuItem>
                <ContextMenuItem className="text-xs">Clone</ContextMenuItem>
                <ContextMenuItem className="text-xs">Truncate</ContextMenuItem>
                <ContextMenuItem className="text-xs">Drop</ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))}

          {!isLoading &&
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
