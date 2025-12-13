import { useState, useRef, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  type ColumnResizeMode,
  type SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";

import type { DataRow } from "./types";
import { useTableDimensions } from "./hooks/useTableDimensions";
import { useTableColumns } from "./hooks/useTableColumns";
import { useTableSelection } from "./hooks/useTableSelection";
import { TableHeader } from "./components/TableHeader";
import { TableRow } from "./components/TableRow";

interface DataTableProps {
  columns: string[];
  data: DataRow[];
  onSelectionChange: (selected: Array<DataRow>) => void;
  extraBlankRows?: number;
  // Server-side sorting props (only used in table-view mode)
  isTableViewMode?: boolean;
  currentOrderBy?: string;
  currentOrderDir?: "asc" | "desc";
  onServerSort?: (column: string, direction: "asc" | "desc") => void;
  isLoading?: boolean;
}

export function DataTable({
  columns,
  data,
  onSelectionChange,
  extraBlankRows = 0,
  isTableViewMode = false,
  currentOrderBy,
  currentOrderDir,
  onServerSort,
  isLoading = false,
}: DataTableProps) {
  const [columnSizing, setColumnSizing] = useState<Record<string, number>>({});
  // Only use client-side sorting when not in table-view mode
  const [sorting, setSorting] = useState<SortingState>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Custom hooks
  const { containerWidth, containerHeight } = useTableDimensions(containerRef);
  const columnDefs = useTableColumns(columns);
  const {
    selection,
    selectedData,
    handleCellMouseDown,
    handleCellMouseEnter,
    handleColumnHeaderClick,
  } = useTableSelection({ columns, data, onSelectionChange });

  // Table setup
  const table = useReactTable({
    data,
    columns: columnDefs,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    columnResizeMode: "onChange" as ColumnResizeMode,
    state: { columnSizing, sorting },
    onColumnSizingChange: setColumnSizing,
    onSortingChange: setSorting,
    enableMultiRowSelection: true,
  });

  const rows = table.getRowModel().rows;
  const headers = table.getFlatHeaders();

  // Calculate column widths
  let colWidths = headers.map((h) => Math.max(40, Math.floor(h.getSize())));
  let totalWidth = colWidths.reduce((a, b) => a + b, 0);
  const rowHeight = 24;

  // Stretch columns to fill container if needed
  if (containerWidth > totalWidth && colWidths.length > 0) {
    const extraSpace = containerWidth - totalWidth;
    const extraPerCol = extraSpace / colWidths.length;
    colWidths = colWidths.map((w) => w + extraPerCol);
    totalWidth = containerWidth;
  }

  const gridTemplateColumns = useMemo(
    () => colWidths.map((w) => `${w}px`).join(" "),
    [colWidths]
  );

  // Virtualization setup
  const totalRows = rows.length + extraBlankRows;
  const rowVirtualizer = useVirtualizer({
    count: totalRows,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
  });

  // Calculate filler rows
  const visibleHeight = rowVirtualizer.getTotalSize();
  const additionalFillerRows =
    containerHeight > visibleHeight
      ? Math.ceil((containerHeight - visibleHeight) / rowHeight)
      : 0;

  if (!columns.length) {
    return (
      <div className="p-3 text-muted-foreground text-xs">
        No columns to display.
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-hidden">
      <div
        ref={(el) => {
          scrollRef.current = el;
          containerRef.current = el;
        }}
        className="h-full w-full overflow-auto"
        style={{ contain: "strict" }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-muted">
          <table
            className="table-fixed border-separate border-spacing-0 text-xs cursor-default select-none"
            style={{ width: totalWidth }}
          >
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header, i) => (
                    <TableHeader
                      key={header.id}
                      header={header}
                      colIndex={i}
                      colWidth={colWidths[i]}
                      onColumnClick={handleColumnHeaderClick}
                      isTableViewMode={isTableViewMode}
                      serverSortColumn={currentOrderBy}
                      serverSortDir={currentOrderDir}
                      onServerSort={onServerSort}
                    />
                  ))}
                </tr>
              ))}
            </thead>
          </table>
        </div>

        {/* Body */}
        <div
          className="relative"
          style={{
            width: totalWidth,
            height: rowVirtualizer.getTotalSize() + additionalFillerRows * rowHeight,
          }}
        >
          {/* Loading overlay - only covers the body, not the header */}
          {isLoading && (
            <div
              className="absolute inset-0 bg-background/60 z-10 flex items-center justify-center"
              style={{ width: totalWidth }}
            >
              <div className="animate-spin h-6 w-6 border-b-2 border-primary rounded-full"></div>
            </div>
          )}

          {/* Virtualized rows */}
          {rowVirtualizer.getVirtualItems().map((vi) => {
            const isDataRow = vi.index < rows.length;
            const row = isDataRow ? rows[vi.index] : null;

            return (
              <TableRow
                key={isDataRow ? row!.id : `blank-row-${vi.index}`}
                virtualItem={vi}
                row={row}
                isDataRow={isDataRow}
                colWidths={colWidths}
                totalWidth={totalWidth}
                gridTemplateColumns={gridTemplateColumns}
                selectedCells={selection.selectedCells}
                onCellMouseDown={handleCellMouseDown}
                onCellMouseEnter={handleCellMouseEnter}
                selectedData={selectedData as DataRow[]}
              />
            );
          })}

          {/* Additional filler rows */}
          {additionalFillerRows > 0 &&
            Array.from({ length: additionalFillerRows }).map((_, idx) => {
              const top = rowVirtualizer.getTotalSize() + idx * rowHeight;
              const isEven = (totalRows + idx) % 2 === 0;
              return (
                <div
                  key={`filler-${idx}`}
                  role="row"
                  className={isEven ? "bg-muted" : "bg-background"}
                  style={{
                    position: "absolute",
                    insetInlineStart: 0,
                    transform: `translateY(${top}px)`,
                    width: totalWidth,
                    height: rowHeight,
                    display: "grid",
                    gridTemplateColumns,
                  }}
                >
                  {colWidths.map((w, ci) => (
                    <div
                      key={`filler-cell-${ci}`}
                      style={{ width: w }}
                      className="border-r border-border"
                    />
                  ))}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
