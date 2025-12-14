import { flexRender, type Header, type HeaderContext } from "@tanstack/react-table";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import type { DataRow } from "../types";

interface TableHeaderProps {
    header: Header<DataRow, unknown>;
    colIndex: number;
    colWidth: number;
    onColumnClick: (colIndex: number, event: React.MouseEvent) => void;
    // Server-side sorting props
    isTableViewMode?: boolean;
    serverSortColumn?: string;
    serverSortDir?: "asc" | "desc";
    onServerSort?: (column: string, direction: "asc" | "desc") => void;
}

export function TableHeader({ 
    header, 
    colIndex, 
    colWidth, 
    onColumnClick,
    isTableViewMode = false,
    serverSortColumn,
    serverSortDir,
    onServerSort,
}: TableHeaderProps) {
    const columnName = header.column.id;
    const isServerSorted = isTableViewMode && serverSortColumn === columnName;
    const clientSortDir = header.column.getIsSorted();

    const handleSortClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent column selection
        
        if (isTableViewMode && onServerSort) {
            // Server-side sorting: DESC → ASC → reset
            if (isServerSorted) {
                if (serverSortDir === "desc") {
                    onServerSort(columnName, "asc");
                } else {
                    onServerSort("", "asc"); // Reset
                }
            } else {
                onServerSort(columnName, "desc");
            }
        } else {
            // Client-side sorting: DESC → ASC → reset
            if (clientSortDir === "desc") {
                header.column.toggleSorting(false);
            } else if (clientSortDir === "asc") {
                header.column.clearSorting();
            } else {
                header.column.toggleSorting(true);
            }
        }
    };

    // Determine current sort direction
    const sortDir = isTableViewMode ? (isServerSorted ? serverSortDir : null) : clientSortDir;
    const isSorted = !!sortDir;

    return (
        <th
            key={header.id}
            colSpan={header.colSpan}
            style={{ width: colWidth }}
            className="relative border-[0.5px] border-border/60 bg-muted/80 px-2 py-1 font-medium"
            onClick={(e) => {
                onColumnClick(colIndex, e);
            }}
        >
            <div className="flex items-center justify-center h-full gap-1">
                <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                    {flexRender(
                        header.column.columnDef.header,
                        header.getContext() as HeaderContext<DataRow, unknown>
                    )}
                </span>
                <button
                    type="button"
                    onClick={handleSortClick}
                    className={`
                        flex items-center justify-center p-0.5 rounded
                        transition-all duration-150
                        hover:bg-blue-500 hover:text-white
                        ${isSorted ? "text-blue-500" : "text-muted-foreground"}
                    `}
                    title={isSorted ? "Click to change sort order" : "Click to sort"}
                >
                    {sortDir === "asc" ? (
                        <ArrowUp className="h-3 w-3" />
                    ) : sortDir === "desc" ? (
                        <ArrowDown className="h-3 w-3" />
                    ) : (
                        <ArrowUpDown className="h-3 w-3" />
                    )}
                </button>
            </div>
            {header.column.getCanResize() && (
                <div
                    onMouseDown={header.getResizeHandler()}
                    onTouchStart={header.getResizeHandler()}
                    className="absolute right-0 top-0 h-full w-2 cursor-col-resize bg-transparent hover:bg-blue-500/30"
                />
            )}
        </th>
    );
}
