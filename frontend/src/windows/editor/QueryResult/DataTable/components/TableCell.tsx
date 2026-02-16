import { flexRender, type Cell } from "@tanstack/react-table";
import { isCellInSelection, getCellBoxShadow } from "../utils/cellSelection";
import { parseTimestamp, formatTimestampTooltip } from "../utils/timestamp";
import type { DataRow } from "../types";
import type { CellType } from "../hooks/useTableSelection";
import type { SelectionGeometry } from "../utils/cellSelection";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface TableCellProps {
    cell: Cell<DataRow, unknown>;
    rowIndex: number;
    colIndex: number;
    colWidth: number;
    selection: SelectionGeometry | null;
    isSerialColumn?: boolean;
    onMouseDown: (cellType: CellType, row: number, col: number, event: React.MouseEvent) => void;
    onMouseEnter: (cellType: CellType, row: number, col: number) => void;
}

export function TableCell({
    cell,
    rowIndex,
    colIndex,
    colWidth,
    selection,
    isSerialColumn = false,
    onMouseDown,
    onMouseEnter,
}: TableCellProps) {
    const selectionColIndex = isSerialColumn ? -1 : colIndex - 1;
    const isSelected = !isSerialColumn && isCellInSelection(selection, rowIndex, selectionColIndex);
    const boxShadow = !isSerialColumn ? getCellBoxShadow(selection, rowIndex, selectionColIndex) : undefined;

    const cellType: CellType = isSerialColumn ? 'serial' : 'data';

    const handleMouseDown = (e: React.MouseEvent) => {
        onMouseDown(cellType, rowIndex, selectionColIndex, e);
    };

    const handleMouseEnter = () => {
        onMouseEnter(cellType, rowIndex, selectionColIndex);
    };

    const rawValue = cell.getValue();
    const timestampDate =
        !isSerialColumn && rawValue !== undefined ? parseTimestamp(rawValue) : null;
    const tooltipStrings =
        timestampDate !== null ? formatTimestampTooltip(timestampDate) : null;

    const cellContent = (
        <div className="overflow-hidden text-ellipsis whitespace-nowrap text-xs h-full flex items-center cursor-default select-none">
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </div>
    );

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
            {tooltipStrings ? (
                <TooltipProvider delayDuration={350}>
                    <Tooltip>
                        <TooltipTrigger asChild>{cellContent}</TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                            <div className="flex flex-col gap-0.5">
                                <span>Local: {tooltipStrings.local}</span>
                                <span>UTC: {tooltipStrings.utc}</span>
                            </div>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            ) : (
                cellContent
            )}
        </div>
    );
}
