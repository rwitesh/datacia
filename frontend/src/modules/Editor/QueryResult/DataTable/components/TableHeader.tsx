import { flexRender, type Header, type HeaderContext } from "@tanstack/react-table";
import type { DataRow } from "../types";

interface TableHeaderProps {
    header: Header<DataRow, unknown>;
    colIndex: number;
    colWidth: number;
    onColumnClick: (colIndex: number, event: React.MouseEvent) => void;
}

export function TableHeader({ header, colIndex, colWidth, onColumnClick }: TableHeaderProps) {
    return (
        <th
            key={header.id}
            colSpan={header.colSpan}
            style={{ width: colWidth }}
            className="relative border border-border bg-muted px-2 py-1 font-medium hover:bg-blue-500/20 hover:border-blue-500 transition-colors"
            onClick={(e) => {
                onColumnClick(colIndex, e);
                const isSorted = header.column.getIsSorted();
                if (isSorted === "asc") {
                    header.column.toggleSorting(true); // Switch to desc
                } else if (isSorted === "desc") {
                    header.column.toggleSorting(false); // Switch to asc
                }
            }}
            onDoubleClick={() => {
                if (header.column.getIsSorted()) {
                    header.column.clearSorting();
                } else {
                    header.column.toggleSorting(false);
                }
            }}
        >
            <div className="flex items-center justify-center h-full gap-2">
                <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                    {flexRender(
                        header.column.columnDef.header,
                        header.getContext() as HeaderContext<DataRow, unknown>
                    )}
                </span>
                {header.column.getCanSort() && (
                    <span>
                        {header.column.getIsSorted() === "asc" && <span>▲</span>}
                        {header.column.getIsSorted() === "desc" && <span>▼</span>}
                    </span>
                )}
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
