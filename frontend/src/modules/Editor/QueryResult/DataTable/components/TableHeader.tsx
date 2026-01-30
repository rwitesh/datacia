import { useRef } from "react";
import { flexRender, type Header, type HeaderContext } from "@tanstack/react-table";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import type { DataRow } from "../types";
import type { CellType } from "../hooks/useTableSelection";

interface TableHeaderProps {
    header: Header<DataRow, unknown>;
    colIndex: number;
    colWidth: number;
    isSerialColumn?: boolean;
    onMouseDown?: (cellType: CellType, row: number, col: number, event: React.MouseEvent) => void;
    onMouseEnter?: (cellType: CellType, row: number, col: number) => void;
    isTableViewMode?: boolean;
    serverSortColumn?: string;
    serverSortDir?: "asc" | "desc";
    onServerSort?: (column: string, direction: "asc" | "desc") => void;
    onResizeStart?: () => void;
    onResizeEnd?: () => void;
}

export function TableHeader({
    header,
    colIndex,
    colWidth,
    isSerialColumn = false,
    onMouseDown,
    onMouseEnter,
    isTableViewMode = false,
    serverSortColumn,
    serverSortDir,
    onServerSort,
    onResizeStart,
    onResizeEnd,
}: TableHeaderProps) {
    const resizeHandleRef = useRef<HTMLDivElement>(null);
    const columnName = header.column.id;
    const isServerSorted = isTableViewMode && serverSortColumn === columnName;
    const clientSortDir = header.column.getIsSorted();

    const handleSortClick = (e: React.MouseEvent) => {
        e.stopPropagation();

        if (isTableViewMode && onServerSort) {
            if (isServerSorted) {
                if (serverSortDir === "desc") {
                    onServerSort(columnName, "asc");
                } else {
                    onServerSort("", "asc");
                }
            } else {
                onServerSort(columnName, "desc");
            }
        } else {
            if (clientSortDir === "desc") {
                header.column.toggleSorting(false);
            } else if (clientSortDir === "asc") {
                header.column.clearSorting();
            } else {
                header.column.toggleSorting(true);
            }
        }
    };

    const sortDir = isTableViewMode ? (isServerSorted ? serverSortDir : null) : clientSortDir;
    const isSorted = !!sortDir;

    const handleResizeStart = (e: React.MouseEvent | React.TouchEvent) => {
        onResizeStart?.();
        e.stopPropagation();

        const handler = header.getResizeHandler();
        if (handler) handler(e);

        const handleResizeEnd = () => {
            onResizeEnd?.();
            document.removeEventListener("mouseup", handleResizeEnd);
            document.removeEventListener("touchend", handleResizeEnd);
        };

        document.addEventListener("mouseup", handleResizeEnd);
        document.addEventListener("touchend", handleResizeEnd);
    };

    const handleMouseDownLocal = (e: React.MouseEvent) => {
        // Skip serial column and resize handle
        if (isSerialColumn) return;

        const target = e.target as HTMLElement;
        if (resizeHandleRef.current?.contains(target)) return;

        e.preventDefault();

        // Pass data column index (visual - 1 since serial is at 0)
        onMouseDown?.('header', -1, colIndex - 1, e);
    };

    const handleMouseEnterLocal = () => {
        if (isSerialColumn) return;
        onMouseEnter?.('header', -1, colIndex - 1);
    };

    return (
        <th
            key={header.id}
            colSpan={header.colSpan}
            style={{ width: colWidth }}
            className="relative border-[0.5px] border-border/60 bg-card px-2 py-1 font-medium"
            onMouseDown={handleMouseDownLocal}
            onMouseEnter={handleMouseEnterLocal}
        >
            <div className="flex items-center justify-center h-full gap-1">
                <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                    {flexRender(
                        header.column.columnDef.header,
                        header.getContext() as HeaderContext<DataRow, unknown>
                    )}
                </span>
                {!isSerialColumn && (
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
                )}
            </div>
            {header.column.getCanResize() && (
                <div
                    ref={resizeHandleRef}
                    onMouseDown={handleResizeStart}
                    onTouchStart={handleResizeStart}
                    className="absolute right-0 top-0 h-full w-2 cursor-col-resize bg-transparent hover:bg-blue-500/30"
                />
            )}
        </th>
    );
}
