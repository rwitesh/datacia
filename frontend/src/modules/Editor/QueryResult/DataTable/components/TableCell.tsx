import { flexRender, type Cell } from "@tanstack/react-table";
import { isCellSelected, getCellBoxShadow } from "../utils/cellSelection";
import type { DataRow } from "../types";
import type { CellType } from "../hooks/useTableSelection";

interface TableCellProps {
    cell: Cell<DataRow, unknown>;
    rowIndex: number;
    colIndex: number;
    colWidth: number;
    selectedCells: Set<string>;
    isSerialColumn?: boolean;
    onMouseDown: (cellType: CellType, row: number, col: number, event: React.MouseEvent) => void;
    onMouseEnter: (cellType: CellType, row: number, col: number) => void;
}

export function TableCell({
    cell,
    rowIndex,
    colIndex,
    colWidth,
    selectedCells,
    isSerialColumn = false,
    onMouseDown,
    onMouseEnter,
}: TableCellProps) {
    // For data columns, adjust colIndex by -1 since selection excludes serial column
    const selectionColIndex = isSerialColumn ? -1 : colIndex - 1;
    const isSelected = !isSerialColumn && isCellSelected(selectedCells, rowIndex, selectionColIndex);
    const boxShadow = !isSerialColumn ? getCellBoxShadow(selectedCells, rowIndex, selectionColIndex) : undefined;

    // Determine cell type for unified handlers
    const cellType: CellType = isSerialColumn ? 'serial' : 'data';

    const handleMouseDown = (e: React.MouseEvent) => {
        onMouseDown(cellType, rowIndex, selectionColIndex, e);
    };

    const handleMouseEnter = () => {
        onMouseEnter(cellType, rowIndex, selectionColIndex);
    };

    return (
        <div
            key={cell.id}
            role="cell"
            data-row={rowIndex}
            data-col={selectionColIndex}
            className={`relative border-[0.5px] border-border/60 px-2 transition-colors ${isSerialColumn
                ? "bg-muted/30 cursor-pointer hover:bg-blue-500/10 font-medium text-muted-foreground"
                : isSelected
                    ? "bg-blue-500/30 cursor-pointer"
                    : "hover:bg-blue-500/10 hover:border-blue-500/80 cursor-pointer"
                }`}
            style={{
                width: colWidth,
                boxShadow: boxShadow,
            }}
            onMouseDown={handleMouseDown}
            onMouseEnter={handleMouseEnter}
        >
            <div className="overflow-hidden text-ellipsis whitespace-nowrap text-xs h-full flex items-center cursor-default select-none">
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </div>
        </div>
    );
}
