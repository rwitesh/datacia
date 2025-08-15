import { useState, useRef, useMemo, useLayoutEffect } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type ColumnResizeMode,
  getPaginationRowModel,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";

type Props = {
  columns: string[];
  data: Record<string, any>[];
  // Optional pagination props
  initialPageSize?: number;
  enablePagination?: boolean;
};

export function DataTable({ 
  columns, 
  data, 
  initialPageSize = 50,
  enablePagination = true
}: Props) {
  const [columnSizing, setColumnSizing] = useState<Record<string, number>>({});
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: initialPageSize,
  });
  
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerwidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  // Track container size
  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
      setContainerHeight(entry.contentRect.height);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  if (!columns.length) {
    return (
      <div className="p-3 text-muted-foreground text-xs">
        No columns to display.
      </div>
    );
  }

  // Generate Column Definitions
  const columnDefs = useMemo<ColumnDef<any>[]>(() => {
    return columns.map((colKey) => ({
      accessorKey: colKey,
      header: colKey,
      cell: (info) => {
        const value = info.getValue();
        return value === null
          ? "NULL"
          : typeof value === "object"
          ? JSON.stringify(value)
          : String(value);
      },
    }));
  }, [columns]);

  const table = useReactTable({
    data,
    columns: columnDefs,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: enablePagination ? getPaginationRowModel() : undefined,
    columnResizeMode: "onChange" as ColumnResizeMode,
    state: { 
      columnSizing,
      ...(enablePagination && { pagination })
    },
    onColumnSizingChange: setColumnSizing,
    ...(enablePagination && {
      onPaginationChange: setPagination,
    }),
  });

  const rows = table.getRowModel().rows;
  const headers = table.getFlatHeaders();
  let colWidths = headers.map((h) => Math.max(40, Math.floor(h.getSize())));
  let totalWidth = colWidths.reduce((a, b) => a + b, 0);
  const rowHeight = 24;

  // Stretch columns to fill container proportionally if total width < container width
  if (containerwidth > totalWidth && colWidths.length > 0) {
    const extraSpace = containerwidth - totalWidth;
    const extraPerCol = extraSpace / colWidths.length;
    colWidths = colWidths.map((w) => w + extraPerCol);
    totalWidth = containerwidth;
  }

  const gridTemplateColumns = useMemo(
    () => colWidths.map((w) => `${w}px`).join(" "),
    [colWidths]
  );

  // Virtualize Rows
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
  });

  // Calculate filler rows to fill remaining height
  const visibleHeight = rowVirtualizer.getTotalSize();
  const extraRowsCount =
    containerHeight > visibleHeight
      ? Math.ceil((containerHeight - visibleHeight) / rowHeight)
      : 0;

  return (
    <div className="h-full w-full overflow-hidden flex flex-col">
      {/* Pagination Controls */}
      {enablePagination && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/50">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{' '}
              {Math.min(
                (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                data.length
              )}{' '}
              of {data.length} rows
            </span>
          </div>
          
          <div className="flex items-center gap-2">

            
            {/* Page navigation */}
            <div className="flex items-center gap-1">
              <button
                className="px-2 py-1 text-xs border border-border rounded hover:bg-muted disabled:opacity-50"
                onClick={() => table.firstPage()}
                disabled={!table.getCanPreviousPage()}
              >
                {'<<'}
              </button>
              <button
                className="px-2 py-1 text-xs border border-border rounded hover:bg-muted disabled:opacity-50"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                {'<'}
              </button>
              
              <span className="flex items-center gap-1 text-xs">
                <span>Page</span>
                <input
                  className="w-12 px-1 py-0.5 text-xs border border-border rounded text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  type="number"
                  value={table.getState().pagination.pageIndex + 1}
                  onChange={e => {
                    const page = e.target.value ? Number(e.target.value) - 1 : 0
                    table.setPageIndex(page)
                  }}
                  min="1"
                  max={table.getPageCount()}
                />
                <span>of {table.getPageCount()}</span>
              </span>
              
              <button
                className="px-2 py-1 text-xs border border-border rounded hover:bg-muted disabled:opacity-50"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                {'>'}
              </button>
              <button
                className="px-2 py-1 text-xs border border-border rounded hover:bg-muted disabled:opacity-50"
                onClick={() => table.lastPage()}
                disabled={!table.getCanNextPage()}
              >
                {'>>'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table Container */}
      <div className="flex-1 overflow-hidden">
        <div
          ref={(el) => {
            scrollRef.current = el;
            containerRef.current = el;
          }}
          className="h-full w-full overflow-auto"
          style={{ contain: "strict" }}
        >
          <div className="sticky top-0 z-10 bg-muted">
            <table
              className="table-fixed border-separate border-spacing-0 text-xs cursor-default select-none"
              style={{ width: totalWidth }}
            >
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header, i) => (
                      <th
                        key={header.id}
                        colSpan={header.colSpan}
                        style={{ width: colWidths[i] }}
                        className="relative border border-border bg-muted px-2 py-1 font-medium"
                      >
                        <div className="flex items-center justify-center h-full">
                          <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                          </span>
                        </div>
                        {header.column.getCanResize() && (
                          <div
                            onMouseDown={header.getResizeHandler()}
                            onTouchStart={header.getResizeHandler()}
                            className="absolute right-0 top-0 h-full w-2 cursor-col-resize bg-transparent"
                          />
                        )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
            </table>
          </div>
          <div
            className="relative"
            style={{ width: totalWidth, height: rowVirtualizer.getTotalSize() }}
          >
            {rowVirtualizer.getVirtualItems().map((vi) => {
              const row = rows[vi.index];
              const even = vi.index % 2 === 0;

              return (
                <div
                  key={row.id}
                  role="row"
                  className={`${even ? "bg-muted" : "bg-background"}`}
                  style={{
                    position: "absolute",
                    insetInlineStart: 0,
                    transform: `translateY(${vi.start}px)`,
                    width: totalWidth,
                    height: vi.size,
                    display: "grid",
                    gridTemplateColumns,
                  }}
                >
                  {row.getVisibleCells().map((cell, ci) => (
                    <div
                      key={cell.id}
                      role="cell"
                      className="relative border-r border-border px-2"
                      style={{ width: colWidths[ci] }}
                    >
                      <div className="overflow-hidden text-ellipsis whitespace-nowrap text-xs h-full flex items-center cursor-default select-none">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}

            {extraRowsCount > 0 &&
              Array.from({ length: extraRowsCount }).map((_, idx) => {
                const top = visibleHeight + idx * rowHeight;
                const isEven = (rows.length + idx) % 2 === 0;
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
    </div>
  );
}