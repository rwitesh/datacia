import { Loader2, Table } from "lucide-react";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useEditorContext } from "@/context/editor/Index";
import { useGetTableData, useGetTableSchema } from "@/services/database";

export function TablesTab() {

    const {
        tables: { data, isLoading, error },
        createTab,
        updateTab,
        tabs,
        setActiveTab,
    } = useEditorContext();

    const getTableDataMutation = useGetTableData();
    const getTableSchemaMutation = useGetTableSchema();

    const handleTableClick = async (table: string) => {
        const existingTab = tabs.find((t) => t.type === "table" && t.table === table);
        if (existingTab) {
            setActiveTab(existingTab.id);
            return;
        }

        const tab = createTab(table, "table");
        if (!tab.table || tab.limit === undefined || tab.offset === undefined) {
            return;
        }

        updateTab(tab.id, {
            isExecuting: true,
            results: null,
            error: undefined,
        });

        getTableDataMutation.mutate(
            {
                table: tab.table,
                limit: tab.limit,
                offset: tab.offset,
            },
            {
                onSuccess: (response) => {
                    updateTab(tab.id, {
                        results: response,
                        isExecuting: false,
                        pagination: true,
                    });
                },
                onError: (err: unknown) => {
                    const message =
                        err instanceof Error
                            ? err.message
                            : String(err) || "Error fetching table data";
                    updateTab(tab.id, {
                        error: message,
                        results: null,
                        isExecuting: false,
                        pagination: false,
                    });
                },
            }
        );
    };

    const handleOpenTableSchema = async (table: string) => {
        const existingTab = tabs.find((t) => t.type === "table" && t.table === table);
        const tab = existingTab || createTab(table, "table");

        if (existingTab) {
            setActiveTab(existingTab.id);
        }

        if (!tab.table) {
            return;
        }

        updateTab(tab.id, {
            isExecuting: true,
            results: null,
            error: undefined,
        });

        getTableSchemaMutation.mutate(tab.table, {
            onSuccess: (response) => {
                updateTab(tab.id, {
                    results: response,
                    isExecuting: false,
                    pagination: false,
                });
            },
            onError: (err: unknown) => {
                const message =
                    err instanceof Error
                        ? err.message
                        : String(err) || "Error fetching table schema";
                updateTab(tab.id, {
                    error: message,
                    results: null,
                    isExecuting: false,
                    pagination: false,
                });
            },
        });
    };

    // Only show loading spinner on initial load, not during background refetch
    // This way users see the current list while fresh data loads
    const showLoading = isLoading && data.length === 0;

    return (
        <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="space-y-1">
                {showLoading ? (
                    <div className="px-2 py-1.5 text-muted-foreground bg-muted rounded-md cursor-default select-none flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Loading...</span>
                    </div>
                ) : data.length === 0 ? (
                    error ? (
                        <div className="px-2 py-1.5  text-red-500 bg-transparent cursor-default select-none">
                            {error.message}
                        </div>
                    ) : (
                        <div className="px-2 py-1.5 text-muted-foreground bg-muted rounded-md cursor-default select-none">
                            No tables found
                        </div>
                    )
                ) : (
                    data.map((t: string) => (
                        <ContextMenu key={t}>
                            <ContextMenuTrigger asChild>
                                <button
                                    className="flex w-full items-center gap-2 rounded-md px-2 py-[1px] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors duration-200 cursor-pointer"
                                    title={t}
                                    onClick={() => handleTableClick(t)}
                                >
                                    <Table className="h-3 w-3 text-blue-500 shrink-0" />
                                    <span className="truncate">{t}</span>
                                </button>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-48 p-1">
                                <ContextMenuItem
                                    onClick={() => handleTableClick(t)}
                                    className="gap-2 text-xs py-1"
                                >
                                    View Data
                                </ContextMenuItem>
                                <ContextMenuItem
                                    onClick={() => handleOpenTableSchema(t)}
                                    className="gap-2 text-xs py-1"
                                >
                                    View Schema
                                </ContextMenuItem>
                                <ContextMenuItem
                                    onClick={() => navigator.clipboard.writeText(t)}
                                    className="gap-2 text-xs py-1"
                                >
                                    Copy name
                                </ContextMenuItem>
                            </ContextMenuContent>
                        </ContextMenu>
                    ))
                )}
            </div>
        </div>
    );
}
