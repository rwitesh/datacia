import { useState, useRef, useMemo, useEffect, forwardRef, useImperativeHandle } from "react";
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
import { useColumnResize } from "./hooks/useColumnResize";
import { TableHeader } from "./components/TableHeader";
import { TableRow } from "./components/TableRow";
import { ColumnResizeHandles } from "./components/ColumnResizeHandles";
import { calculateContentWidths, distributeExtraSpace } from "./utils/columnWidths";

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
  onOpenDataView?: () => void;
  scrollPosition?: { left: number; top: number };
  onScrollChange?: (scroll: { left: number; top: number }) => void;
  // Pagination offset for serial number calculation
  offset?: number;
}

export const DataTable = forwardRef<HTMLDivElement, DataTableProps>(function DataTable({
  columns,
  data,
  onSelectionChange,
  extraBlankRows = 0,
  isTableViewMode = false,
  currentOrderBy,
  currentOrderDir,
  onServerSort,
  isLoading = false,
  onOpenDataView,
  scrollPosition,
  onScrollChange,
  offset = 0,
}, ref) {
  const [columnSizing, setColumnSizing] = useState<Record<string, number>>({});
  // Only use client-side sorting when not in table-view mode
  const [sorting, setSorting] = useState<SortingState>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  // Separate internal ref for dimensions hook
  const containerRef = useRef<HTMLDivElement>(null);

  // Expose scrollRef to parent via forwarded ref
  useImperativeHandle(ref, () => scrollRef.current as HTMLDivElement);

  // Restore scroll position when scrollPosition prop changes
  useEffect(() => {
    if (scrollRef.current && scrollPosition) {
      scrollRef.current.scrollLeft = scrollPosition.left;
      scrollRef.current.scrollTop = scrollPosition.top;
    }
  }, [scrollPosition]);

  // Save scroll position when user scrolls (throttled with RAF for performance)
  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement || !onScrollChange) return;

    let rafId: number | null = null;
    let isScheduled = false;

    const handleScroll = () => {
      if (isScheduled) return;

      isScheduled = true;
      rafId = requestAnimationFrame(() => {
        onScrollChange({
          left: scrollElement.scrollLeft,
          top: scrollElement.scrollTop,
        });
        isScheduled = false;
      });
    };

    scrollElement.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      scrollElement.removeEventListener("scroll", handleScroll);
    };
  }, [onScrollChange]);

  // Custom hooks
  const { containerWidth, containerHeight } = useTableDimensions(containerRef);
  const columnDefs = useTableColumns(columns, offset);

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
  const rowHeight = 24;

  // Calculate content-based column widths using utility function
  const baseColWidths = useMemo(
    () => calculateContentWidths(headers, data, offset),
    [headers, data, offset]
  );

  // Distribute extra space evenly across all columns
  const { finalColWidths: distributedWidths } = useMemo(
    () => distributeExtraSpace(baseColWidths, containerWidth),
    [baseColWidths, containerWidth]
  );

  // Column resize hook - applies user resize deltas to distributed widths
  const {
    columnWidths: finalColWidths,
    isResizing,
    startResize,
  } = useColumnResize({
    columns,
    baseWidths: distributedWidths,
  });

  // Calculate total width after resize
  const totalWidth = useMemo(
    () => finalColWidths.reduce((a, b) => a + b, 0),
    [finalColWidths]
  );

  // Selection hook - needs rowHeight and colWidths
  // Note: selection works on data columns (excludes serial # column from selection indices)
  const {
    selection,
    selectedData,
    handleMouseDown,
    handleMouseEnter,
  } = useTableSelection({
    columns,
    data,
    onSelectionChange,
    scrollRef,
    rowHeight,
    colWidths: finalColWidths.slice(1), // Exclude serial column width for selection
  });

  const gridTemplateColumns = useMemo(
    () => finalColWidths.map((w) => `${w}px`).join(" "),
    [finalColWidths]
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
    <div className="h-full w-full overflow-hidden bg-card">
      <div
        ref={(el) => {
          scrollRef.current = el;
          containerRef.current = el;
        }}
        className="h-full w-full overflow-auto"
        style={{ contain: "strict" }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10">
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
                      colWidth={finalColWidths[i]}
                      isSerialColumn={i === 0}
                      onMouseDown={handleMouseDown}
                      onMouseEnter={handleMouseEnter}
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
          {/* Full-height column resize handles */}
          <ColumnResizeHandles
            colWidths={finalColWidths}
            totalHeight={rowVirtualizer.getTotalSize() + additionalFillerRows * rowHeight}
            onResizeStart={startResize}
            isResizing={isResizing}
          />
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
                colWidths={finalColWidths}
                totalWidth={totalWidth}
                gridTemplateColumns={gridTemplateColumns}
                selectedCells={selection.selectedCells}
                onMouseDown={handleMouseDown}
                onMouseEnter={handleMouseEnter}
                selectedData={selectedData as DataRow[]}
                onOpenDataView={onOpenDataView}
              />
            );
          })}

          {/* Additional filler rows */}
          {additionalFillerRows > 0 &&
            Array.from({ length: additionalFillerRows }).map((_, idx) => {
              const top = rowVirtualizer.getTotalSize() + idx * rowHeight;
              return (
                <div
                  key={`filler-${idx}`}
                  role="row"
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
                  {finalColWidths.map((w, ci) => (
                    <div
                      key={`filler-cell-${ci}`}
                      style={{ width: w }}
                      className="border-r-[0.5px] border-border/60"
                    />
                  ))}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
});
