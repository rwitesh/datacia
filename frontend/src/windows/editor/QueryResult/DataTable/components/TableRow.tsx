import { type VirtualItem } from "@tanstack/react-virtual";
import { type Row as TanStackRow } from "@tanstack/react-table";
import { TableCell } from "./TableCell";
import type { DataRow } from "../types";
import { TableContextMenu } from "./TableContextMenu";
import type { CellType } from "../hooks/useTableSelection";


interface TableRowProps {
    virtualItem: VirtualItem;
    row: TanStackRow<DataRow> | null;
    isDataRow: boolean;
    colWidths: number[];
    totalWidth: number;
    gridTemplateColumns: string;
    selectedCells: Set<string>;
    onMouseDown: (cellType: CellType, row: number, col: number, event: React.MouseEvent) => void;
    onMouseEnter: (cellType: CellType, row: number, col: number) => void;
    selectedData?: DataRow[];
    onOpenDataView?: () => void;
}

export function TableRow({
    virtualItem,
    row,
    isDataRow,
    colWidths,
    totalWidth,
    gridTemplateColumns,
    selectedCells,
    onMouseDown,
    onMouseEnter,
    selectedData = [],
    onOpenDataView,
}: TableRowProps) {
    const rowContent = (
        <div
            key={isDataRow ? row!.id : `blank-row-${virtualItem.index}`}
            role="row"
            style={{
                position: "absolute",
                insetInlineStart: 0,
                transform: `translateY(${virtualItem.start}px)`,
                width: totalWidth,
                height: virtualItem.size,
                display: "grid",
                gridTemplateColumns,
            }}
        >
            {isDataRow
                ? row!.getVisibleCells().map((cell, ci) => (
                    <TableCell
                        key={cell.id}
                        cell={cell}
                        rowIndex={virtualItem.index}
                        colIndex={ci}
                        colWidth={colWidths[ci]}
                        selectedCells={selectedCells}
                        isSerialColumn={ci === 0}
                        onMouseDown={onMouseDown}
                        onMouseEnter={onMouseEnter}
                    />
                ))
                : colWidths.map((w, ci) => (
                    <div
                        key={`blank-cell-${virtualItem.index}-${ci}`}
                        role="cell"
                        className="relative border-r-[0.5px] border-border/60 px-2"
                        style={{ width: w }}
                    >
                        <div className="h-full flex items-center cursor-default select-none">
                            {/* Empty content for blank rows */}
                        </div>
                    </div>
                ))}
        </div>
    );

    if (!isDataRow || !row) {
        return rowContent;
    }

    return (
        <TableContextMenu
            row={row.original}
            selectedData={selectedData}
            onOpenDataView={onOpenDataView}
        >
            {rowContent}
        </TableContextMenu>
    );
}
