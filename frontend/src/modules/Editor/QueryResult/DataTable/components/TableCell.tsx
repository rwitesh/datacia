import { flexRender, type Cell } from "@tanstack/react-table";
import { isCellSelected, getCellBoxShadow } from "../utils/cellSelection";
import type { DataRow } from "../types";

interface TableCellProps {
    cell: Cell<DataRow, unknown>;
    rowIndex: number;
    colIndex: number;
    colWidth: number;
    selectedCells: Set<string>;
    onMouseDown: (rowIndex: number, colIndex: number, event: React.MouseEvent) => void;
    onMouseEnter: (rowIndex: number, colIndex: number) => void;
}

export function TableCell({
    cell,
    rowIndex,
    colIndex,
    colWidth,
    selectedCells,
    onMouseDown,
    onMouseEnter,
}: TableCellProps) {
    const isSelected = isCellSelected(selectedCells, rowIndex, colIndex);
    const boxShadow = getCellBoxShadow(selectedCells, rowIndex, colIndex);

    return (
        <div
            key={cell.id}
            role="cell"
            className={`relative border border-border px-2 cursor-pointer transition-colors ${isSelected
                ? "bg-blue-500/30"
                : "hover:bg-blue-500/10 hover:border-blue-500"
                }`}
            style={{
                width: colWidth,
                boxShadow: boxShadow,
            }}
            onMouseDown={(e) => onMouseDown(rowIndex, colIndex, e)}
            onMouseEnter={() => onMouseEnter(rowIndex, colIndex)}
        >
            <div className="overflow-hidden text-ellipsis whitespace-nowrap text-xs h-full flex items-center cursor-default select-none">
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </div>
        </div>
    );
}
