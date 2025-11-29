import { type VirtualItem } from "@tanstack/react-virtual";
import { type Row as TanStackRow } from "@tanstack/react-table";
import { TableCell } from "./TableCell";
import type { DataRow } from "../types";

interface TableRowProps {
    virtualItem: VirtualItem;
    row: TanStackRow<DataRow> | null;
    isDataRow: boolean;
    colWidths: number[];
    totalWidth: number;
    gridTemplateColumns: string;
    selectedCells: Set<string>;
    onCellMouseDown: (rowIndex: number, colIndex: number, event: React.MouseEvent) => void;
    onCellMouseEnter: (rowIndex: number, colIndex: number) => void;
}

export function TableRow({
    virtualItem,
    row,
    isDataRow,
    colWidths,
    totalWidth,
    gridTemplateColumns,
    selectedCells,
    onCellMouseDown,
    onCellMouseEnter,
}: TableRowProps) {
    const even = virtualItem.index % 2 === 0;

    return (
        <div
            key={isDataRow ? row!.id : `blank-row-${virtualItem.index}`}
            role="row"
            className={`${even ? "bg-muted" : "bg-background"}`}
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
                        onMouseDown={onCellMouseDown}
                        onMouseEnter={onCellMouseEnter}
                    />
                ))
                : colWidths.map((w, ci) => (
                    <div
                        key={`blank-cell-${virtualItem.index}-${ci}`}
                        role="cell"
                        className="relative border-r border-border px-2"
                        style={{ width: w }}
                    >
                        <div className="h-full flex items-center cursor-default select-none">
                            {/* Empty content for blank rows */}
                        </div>
                    </div>
                ))}
        </div>
    );
}
